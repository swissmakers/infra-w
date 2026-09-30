const { Router } = require("express");
const express = require("express");
const { resolveSession } = require("../utils/sessionAuth");
const SessionManager = require("../lib/SessionManager");
const Entry = require("../models/Entry");
const { resolveIdentity } = require("../utils/identityResolver");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { createSshClient, waitForReady } = require("../utils/sshClient");
const { addFolderToArchive, ensureSftpParentDirs } = require("../utils/sftpHelpers");
const logger = require("../utils/logger");
const { ZipArchive } = require("archiver");
const sharp = require("sharp");
const { getClientIp } = require("../utils/requestIp");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = Router();
const THUMB_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
const TIMEOUT = 30000;
const MIME_TYPES = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4",
    webm: "video/webm", mp3: "audio/mpeg", txt: "text/plain", json: "application/json",
    html: "text/html", css: "text/css", js: "application/javascript",
};

const getExt = (p) => p.split(".").pop()?.toLowerCase();

const cleanup = (ssh, streams = [], closeSsh = true) => {
    streams.forEach(s => { try { s?.destroyed || s?.destroy(); } catch {} });
    if (!closeSsh) return;
    try { ssh?.end(); } catch {}
};

const sftpConnect = (ssh) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("SFTP timeout")), TIMEOUT);
    ssh.sftp((err, sftp) => { clearTimeout(t); err ? reject(err) : resolve(sftp); });
});

const validateSession = async (sessionToken, sessionId) => {
    const resolved = await resolveSession(sessionToken);
    if (!resolved) return { error: "Invalid session", status: 401 };

    const user = resolved.account;
    const serverSession = SessionManager.get(sessionId);
    if (!serverSession) return { error: "Session not found", status: 404 };
    if (serverSession.accountId !== user.id) return { error: "Unauthorized", status: 403 };

    const entry = await Entry.findByPk(serverSession.entryId);
    if (!entry) return { error: "Entry not found", status: 404 };

    const { identityId, directIdentity = null } = serverSession.configuration || {};
    const connection = SessionManager.getConnection(sessionId);
    const result = await resolveIdentity(entry, identityId, directIdentity, user.id);
    if (result.accessDenied) return { error: "You don't have access to this identity", status: 403 };
    const identity = result.identity !== undefined ? result.identity : result;

    if (!identity && !connection?.ssh) {
        return { error: "No identity configured", status: 400 };
    }

    return { user, serverSession, entry, identity, connection };
};

const setupSSH = async (v, req, res, cleanupFn) => {
    if (v.connection?.ssh && v.connection.type === "ssh") {
        return { ssh: v.connection.ssh, reused: true };
    }

    const ssh = await createSshClient(v.entry, v.identity, v.user.id);
    req.on("close", () => { if (!res.writableEnded) cleanupFn(); });
    ssh.on("error", (err) => { cleanupFn(); if (!res.headersSent) res.status(500).json({ code: 500, message: err.message }); });
    return { ssh, reused: false };
};

const handleError = (res, err) => {
    const code = err?.code;
    const message = String(err?.message || "");
    const status = (code === 2 || code === "ENOENT")
        ? 404
        : (code === 3 || code === "EACCES" || code === "EPERM" || /permission denied/i.test(message))
            ? 403
            : 500;
    const msg = status === 404 ? "Not found" : status === 403 ? "Permission denied" : (message || "Internal server error");
    if (!res.headersSent) res.status(status).json({ code: status, message: msg });
};

const isPermissionError = (err) => {
    const code = err?.code;
    const message = String(err?.message || "");
    return code === 3 || code === "EACCES" || code === "EPERM" || /permission denied/i.test(message);
};

const withPathContext = (err, remotePath) => {
    const wrapped = err instanceof Error ? err : new Error(String(err || "Unknown error"));
    wrapped.code = wrapped.code || err?.code;
    wrapped.path = wrapped.path || remotePath;
    return wrapped;
};

const assertReadablePath = async (sftp, remotePath) => {
    const ensureReadableFile = (filePath) => new Promise((resolve, reject) => {
        sftp.open(filePath, "r", (openErr, handle) => {
            if (openErr) return reject(withPathContext(openErr, filePath));
            sftp.close(handle, (closeErr) => closeErr ? reject(withPathContext(closeErr, filePath)) : resolve());
        });
    });

    const walk = async (currentPath) => {
        const stats = await new Promise((resolve, reject) => {
            sftp.stat(currentPath, (err, fileStats) => err ? reject(withPathContext(err, currentPath)) : resolve(fileStats));
        });

        if (!stats.isDirectory()) {
            await ensureReadableFile(currentPath);
            return;
        }

        const list = await new Promise((resolve, reject) => {
            sftp.readdir(currentPath, (err, entries) => err ? reject(withPathContext(err, currentPath)) : resolve(entries || []));
        });

        for (const file of list) {
            if (file.longname.startsWith("l")) continue;
            const fullPath = currentPath === "/" ? `/${file.filename}` : `${currentPath}/${file.filename}`;
            if (file.longname.startsWith("d")) await walk(fullPath);
            else await ensureReadableFile(fullPath);
        }
    };

    await walk(remotePath);
};

const audit = (v, req, action, resource, details) => {
    createAuditLog({
        accountId: v.user.id, organizationId: v.entry.organizationId,
        action, resource, details, ipAddress: getClientIp(req), userAgent: req.headers["user-agent"],
    });
};

/**
 * POST /entries/sftp/upload
 * @summary Upload File via SFTP
 * @description Uploads a file to a remote server via SFTP. The file content should be sent as the raw request body. Requires an active session with SFTP capabilities.
 * @tags SFTP
 * @produces application/json
 * @param {string} sessionToken.query.required - Session authentication token
 * @param {string} sessionId.query.required - Active server session ID
 * @param {string} path.query.required - Remote destination path for the uploaded file
 * @return {object} 200 - Upload successful with file path and size
 * @return {object} 400 - Missing parameters or invalid path
 * @return {object} 401 - Invalid session token
 * @return {object} 403 - Permission denied
 * @return {object} 404 - Session or entry not found
 * @return {object} 500 - Upload error
 */
app.post("/upload", async (req, res) => {
    const { sessionToken, sessionId, path: remotePath } = req.query;
    if (!sessionToken || !sessionId || !remotePath) return res.status(400).json({ code: 400, message: "Missing parameters" });
    if (remotePath.includes("..")) return res.status(400).json({ code: 400, message: "Invalid path" });

    let ssh = null, sftp = null, tempFile = null, cleaned = false, ownsSsh = true;
    const cleanupAll = () => {
        if (cleaned) return;
        cleaned = true;
        if (tempFile) try { fs.unlinkSync(tempFile); } catch {}
        try { sftp?.end?.(); } catch {}
        sftp = null;
        cleanup(ssh, [], ownsSsh);
    };

    try {
        const v = await validateSession(sessionToken, sessionId);
        if (v.error) return res.status(v.status).json({ code: v.status, message: v.error });

        tempFile = path.join(os.tmpdir(), `infra-w-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const writeStream = fs.createWriteStream(tempFile);

        await new Promise((resolve, reject) => {
            req.pipe(writeStream);
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
            req.on("error", reject);
        });

        const stats = fs.statSync(tempFile);
        const setup = await setupSSH(v, req, res, cleanupAll);
        ssh = setup.ssh;
        ownsSsh = !setup.reused;
        if (!setup.reused) {
            await waitForReady(ssh);
        }
        sftp = await sftpConnect(ssh);

        await ensureSftpParentDirs(sftp, remotePath);
        await new Promise((resolve, reject) => {
            sftp.fastPut(tempFile, remotePath, { concurrency: 64, chunkSize: 32768 }, (err) => err ? reject(err) : resolve());
        });

        cleanupAll();
        res.json({ success: true, path: remotePath, size: stats.size });
        audit(v, req, AUDIT_ACTIONS.FILE_UPLOAD, RESOURCE_TYPES.FILE, { filePath: remotePath, fileSize: stats.size });
    } catch (err) {
        cleanupAll();
        logger.error("Upload error", { error: err.message, path: remotePath });
        handleError(res, err);
    }
});

/**
 * GET /entries/sftp
 * @summary Download or Preview File via SFTP
 * @description Downloads a file or folder from a remote server via SFTP. Supports file preview, thumbnail generation for images, and folder download as ZIP archive.
 * @tags SFTP
 * @produces application/octet-stream
 * @produces application/zip
 * @produces image/jpeg
 * @param {string} sessionToken.query.required - Session authentication token
 * @param {string} sessionId.query.required - Active server session ID
 * @param {string} path.query.required - Remote file or folder path to download
 * @param {string} preview.query - Set to "true" to display file inline instead of downloading
 * @param {string} thumbnail.query - Set to "true" to generate a thumbnail (images only, max 10MB)
 * @param {number} size.query - Thumbnail size in pixels (50-300, default: 100)
 * @return {file} 200 - File content, ZIP archive, or thumbnail image
 * @return {object} 400 - Missing parameters or invalid path
 * @return {object} 401 - Invalid session token
 * @return {object} 403 - Permission denied
 * @return {object} 404 - File, session, or entry not found
 * @return {object} 500 - Download error
 */
app.get("/", async (req, res) => {
    const { sessionToken, sessionId, path: remotePath, preview, thumbnail, size } = req.query;
    if (!sessionToken || !sessionId || !remotePath) return res.status(400).json({ code: 400, message: "Missing parameters" });
    if (remotePath.includes("..")) return res.status(400).json({ code: 400, message: "Invalid path" });

    const thumbSize = Math.min(Math.max(parseInt(size) || 100, 50), 300);
    let ssh = null, sftp = null, ownsSsh = true;
    const streams = [];
    let cleaned = false;
    const cleanupAll = () => {
        if (cleaned) return;
        cleaned = true;
        try { sftp?.end?.(); } catch {}
        cleanup(ssh, streams, ownsSsh);
    };

    try {
        const v = await validateSession(sessionToken, sessionId);
        if (v.error) return res.status(v.status).json({ code: v.status, message: v.error });

        const setup = await setupSSH(v, req, res, cleanupAll);
        ssh = setup.ssh;
        ownsSsh = !setup.reused;
        if (!setup.reused) {
            ssh.on("end", cleanupAll);
        }

        const runDownload = async () => {
            try {
                sftp = await sftpConnect(ssh);
                const stats = await new Promise((r, j) => sftp.stat(remotePath, (e, s) => e ? j(e) : r(s)));
                const fileName = remotePath.split("/").pop();
                const safeFileName = fileName.replace(/[^\w\s.-]/g, "_").substring(0, 255);

                if (stats.isDirectory()) {
                    res.header("Content-Disposition", `attachment; filename="${safeFileName}.zip"`);
                    res.header("Content-Type", "application/zip");
                    const archive = new ZipArchive({ zlib: { level: 1 } });
                    streams.push(archive);
                    archive.on("error", () => { archive.abort(); cleanupAll(); });
                    archive.on("end", cleanupAll);
                    archive.pipe(res);
                    await addFolderToArchive(sftp, remotePath, archive, safeFileName, streams, { concurrency: 8 });
                    archive.finalize();
                    audit(v, req, AUDIT_ACTIONS.FOLDER_DOWNLOAD, RESOURCE_TYPES.FOLDER, { folderPath: remotePath });
                    return;
                }

                if (thumbnail === "true" && THUMB_EXTS.has(getExt(remotePath)) && stats.size <= 10 * 1024 * 1024) {
                    res.header("Content-Type", "image/jpeg");
                    res.header("Cache-Control", "public, max-age=3600");
                    const rs = sftp.createReadStream(remotePath);
                    const tf = sharp().resize(thumbSize, thumbSize, { fit: "cover" }).jpeg({ quality: 80 });
                    streams.push(rs, tf);
                    rs.on("error", (err) => { cleanupAll(); handleError(res, err); });
                    tf.on("end", cleanupAll);
                    rs.pipe(tf).pipe(res);
                    return;
                }

                res.header("Content-Disposition", `${preview === "true" ? "inline" : "attachment"}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
                res.header("Content-Length", stats.size);
                const ext = getExt(remotePath);
                if (MIME_TYPES[ext]) res.header("Content-Type", MIME_TYPES[ext]);

                const rs = sftp.createReadStream(remotePath);
                streams.push(rs);
                rs.on("error", (err) => { cleanupAll(); handleError(res, err); });
                rs.on("end", cleanupAll);
                rs.pipe(res);

                audit(v, req, AUDIT_ACTIONS.FILE_DOWNLOAD, RESOURCE_TYPES.FILE, { filePath: remotePath, fileSize: stats.size });
            } catch (err) {
                cleanupAll();
                handleError(res, err);
            }
        };
        if (setup.reused) runDownload();
        else ssh.on("ready", runDownload);
    } catch (err) {
        cleanupAll();
        handleError(res, err);
    }
});

const addFileToArchive = (sftp, remotePath, archive, archiveName, streams) => new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, stats) => {
        if (err) return reject(err);

        if (stats.isDirectory()) {
            addFolderToArchive(sftp, remotePath, archive, archiveName, streams)
                .then(resolve)
                .catch(reject);
        } else {
            const stream = sftp.createReadStream(remotePath);
            streams.push(stream);
            stream.on("error", reject);
            archive.append(stream, { name: archiveName });
            stream.on("end", resolve);
        }
    });
});

/**
 * POST /entries/sftp/multi
 * @summary Download Multiple Files via SFTP
 * @description Downloads multiple files and/or folders as a single ZIP archive. Supports mixed selection of files and folders. Failed items are skipped and logged.
 * @tags SFTP
 * @consumes application/x-www-form-urlencoded
 * @produces application/zip
 * @param {string} sessionToken.query.required - Session authentication token
 * @param {string} sessionId.query.required - Active server session ID
 * @param {object} request.body.required - Request body containing paths array
 * @return {file} 200 - ZIP archive containing all requested files and folders
 * @return {object} 400 - Missing parameters, invalid paths format, or no paths provided
 * @return {object} 401 - Invalid session token
 * @return {object} 403 - Permission denied
 * @return {object} 404 - Session or entry not found
 * @return {object} 500 - Download error
 */
app.post("/multi", express.json(), express.urlencoded({ extended: true }), async (req, res) => {
    const { sessionToken, sessionId } = req.query;
    let paths = req.body.paths;

    if (typeof paths === "string") {
        try { paths = JSON.parse(paths); }
        catch { return res.status(400).json({ code: 400, message: "Invalid paths format" }); }
    }

    if (!sessionToken || !sessionId) return res.status(400).json({ code: 400, message: "Missing session parameters" });
    if (!paths || !Array.isArray(paths) || paths.length === 0) return res.status(400).json({ code: 400, message: "No paths provided" });
    if (paths.some(p => p.includes(".."))) return res.status(400).json({ code: 400, message: "Invalid path" });

    let ssh = null, sftp = null, ownsSsh = true;
    const streams = [];
    let cleaned = false;
    const cleanupAll = () => {
        if (cleaned) return;
        cleaned = true;
        try { sftp?.end?.(); } catch {}
        cleanup(ssh, streams, ownsSsh);
    };

    try {
        const validation = await validateSession(sessionToken, sessionId);
        if (validation.error) return res.status(validation.status).json({ code: validation.status, message: validation.error });

        const setup = await setupSSH(validation, req, res, cleanupAll);
        ssh = setup.ssh;
        ownsSsh = !setup.reused;
        if (!setup.reused) {
            ssh.on("end", cleanupAll);
        }

        const runMultiDownload = async () => {
            try {
                sftp = await sftpConnect(ssh);
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

                for (const remotePath of paths) {
                    try {
                        await assertReadablePath(sftp, remotePath);
                    } catch (err) {
                        if (isPermissionError(err)) {
                            const deniedPath = err.path || remotePath;
                            cleanupAll();
                            return res.status(403).json({ code: 403, message: `Permission denied: ${deniedPath}` });
                        }
                        throw err;
                    }
                }

                res.header("Content-Disposition", `attachment; filename="infra-w-download-${timestamp}.zip"`);
                res.header("Content-Type", "application/zip");

                const archive = new ZipArchive({ zlib: { level: 5 } });
                streams.push(archive);
                archive.on("error", () => { archive.abort(); cleanupAll(); });
                archive.on("end", cleanupAll);
                archive.pipe(res);

                for (const remotePath of paths) {
                    try {
                        await addFileToArchive(sftp, remotePath, archive, remotePath.split("/").pop(), streams);
                    } catch (err) {
                        logger.warn("Failed to add file to archive", { path: remotePath, error: err.message });
                    }
                }

                archive.finalize();
                audit(validation, req, AUDIT_ACTIONS.FILE_DOWNLOAD, RESOURCE_TYPES.FILE, { 
                    paths, 
                    count: paths.length,
                    connectionReason: validation.serverSession.connectionReason || null 
                });
            } catch (err) {
                cleanupAll();
                handleError(res, err);
            }
        };
        if (setup.reused) runMultiDownload();
        else ssh.on("ready", runMultiDownload);
    } catch (err) {
        cleanupAll();
        handleError(res, err);
    }
});

module.exports = app;
