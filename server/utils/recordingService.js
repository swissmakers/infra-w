const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pipeline } = require("stream/promises");
const { Op } = require("sequelize");
const AuditLog = require("../models/AuditLog");
const logger = require("./logger");

const { RECORDINGS_DIR } = require("./dataPaths");
const { getOrgAuditSettings } = require("./orgAuditSettings");
const DEFAULT_RETENTION_DAYS = 90;
const { AUDIT_ACTIONS } = require("./auditActions");

const CONNECT_ACTIONS = [AUDIT_ACTIONS.SSH_CONNECT, AUDIT_ACTIONS.TELNET_CONNECT, AUDIT_ACTIONS.RDP_CONNECT, AUDIT_ACTIONS.VNC_CONNECT, AUDIT_ACTIONS.PVE_CONNECT];

const ensureRecordingsDir = () => {
    if (!fs.existsSync(RECORDINGS_DIR)) {
        fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
        logger.system("Created recordings directory", { path: RECORDINGS_DIR });
    }
};

const getRecordingPath = (id, type = "guac", compressed = true) => 
    path.join(RECORDINGS_DIR, `${id}${compressed ? `.${type}.gz` : `.${type}`}`);

const getGuacdRecordingPath = (id) => path.join(RECORDINGS_DIR, String(id));

const compressRecording = async (src, dest) => {
    if (!fs.existsSync(src)) return false;
    try {
        await pipeline(fs.createReadStream(src), zlib.createGzip({ level: 6 }), fs.createWriteStream(dest));
        fs.unlinkSync(src);
        return true;
    } catch (e) {
        logger.error("Failed to compress recording", { src, dest, error: e.message });
        return false;
    }
};

const waitForStableFile = async (filePath, { interval = 200, maxWait = 5000 } = {}) => {
    const appearDeadline = Date.now() + 2000;
    while (!fs.existsSync(filePath) && Date.now() < appearDeadline) {
        await new Promise(r => setTimeout(r, interval));
    }
    if (!fs.existsSync(filePath)) return false;

    let lastSize = -1;
    let stableChecks = 0;
    const deadline = Date.now() + maxWait;
    while (Date.now() < deadline) {
        let size;
        try { size = fs.statSync(filePath).size; } catch { return true; }
        if (size === lastSize) {
            if (++stableChecks >= 2) return true;
        } else {
            stableChecks = 0;
            lastSize = size;
        }
        await new Promise(r => setTimeout(r, interval));
    }
    return true;
};

const finalizeGuacRecording = async (id) => {
    await waitForStableFile(getGuacdRecordingPath(id));
    return compressRecording(getGuacdRecordingPath(id), getRecordingPath(id, "guac", true));
};

const computeCastDuration = (filePath, idleTimeLimit = 2) => {
    try {
        const lines = fs.readFileSync(filePath, "utf8").split("\n");
        let duration = 0;
        let lastTs = 0;
        for (const line of lines) {
            if (!line || line[0] !== "[") continue;
            let ts;
            try { ts = JSON.parse(line)[0]; } catch { continue; }
            if (typeof ts !== "number") continue;
            const gap = ts - lastTs;
            duration += gap > idleTimeLimit ? idleTimeLimit : Math.max(gap, 0);
            lastTs = ts;
        }
        return Math.round(duration);
    } catch {
        return null;
    }
};

const getRecordingInfo = (id) => {
    for (const type of ["guac", "cast"]) {
        const p = getRecordingPath(id, type, true);
        if (fs.existsSync(p)) return { exists: true, type, path: p };
    }
    return { exists: false, type: null, path: null };
};

const deleteRecording = (id) => {
    [getRecordingPath(id, "guac", true), getRecordingPath(id, "cast", true), getGuacdRecordingPath(id)]
        .forEach(p => { try { fs.existsSync(p) && fs.unlinkSync(p); } catch {} });
};

const getRetentionDays = async (orgId) =>
    (await getOrgAuditSettings(orgId))?.recordingRetentionDays || DEFAULT_RETENTION_DAYS;

const isRecordingEnabled = async (orgId) => {
    if (!orgId) return false;
    return (await getOrgAuditSettings(orgId))?.enableSessionRecording === true;
};

const cleanupOldRecordings = async () => {
    try {
        const logs = await AuditLog.findAll({
            where: { action: { [Op.in]: CONNECT_ACTIONS } },
            attributes: ["id", "organizationId", "timestamp", "details"]
        });

        const now = Date.now();
        const orgIds = [...new Set(logs.map(l => l.organizationId).filter(Boolean))];
        const retention = new Map([[null, DEFAULT_RETENTION_DAYS]]);
        await Promise.all(orgIds.map(async id => retention.set(id, await getRetentionDays(id))));

        let count = 0;
        for (const log of logs) {
            const details = log.details || {};
            if (!details.hasRecording) continue;

            if (now - new Date(log.timestamp).getTime() > retention.get(log.organizationId) * 86400000) {
                if (getRecordingInfo(log.id).exists) {
                    deleteRecording(log.id);
                    count++;
                    await AuditLog.update({ details: { ...details, hasRecording: false, recordingDeletedAt: new Date().toISOString() } }, { where: { id: log.id } });
                }
            }
        }
        if (count) logger.info(`Cleaned up ${count} old recordings`);
    } catch (e) {
        logger.error("Failed to cleanup old recordings", { error: e.message });
    }
};

const cleanupOrphanedRecordings = async () => {
    if (!fs.existsSync(RECORDINGS_DIR)) return;
    let count = 0;
    for (const file of fs.readdirSync(RECORDINGS_DIR)) {
        const match = file.match(/^(\d+)/);
        if (match && !(await AuditLog.findByPk(parseInt(match[1], 10)))) {
            try { fs.unlinkSync(path.join(RECORDINGS_DIR, file)); count++; } catch {}
        }
    }
    if (count) logger.info(`Cleaned up ${count} orphaned recording files`);
};

const compressUnfinishedRecordings = async () => {
    if (!fs.existsSync(RECORDINGS_DIR)) return;
    for (const file of fs.readdirSync(RECORDINGS_DIR)) {
        if (!/^\d+$/.test(file)) continue;
        const rawPath = path.join(RECORDINGS_DIR, file);
        try {
            const buf = Buffer.alloc(1);
            const fd = fs.openSync(rawPath, 'r');
            fs.readSync(fd, buf, 0, 1, 0);
            fs.closeSync(fd);
            const type = buf.toString() === "{" ? "cast" : "guac";
            await compressRecording(rawPath, getRecordingPath(parseInt(file, 10), type, true));
            logger.info(`Compressed unfinished recording`, { auditLogId: file, type });
        } catch {}
    }
};

let cleanupInterval = null;

const start = () => {
    ensureRecordingsDir();
    setTimeout(async () => {
        await compressUnfinishedRecordings();
        await cleanupOrphanedRecordings();
        await cleanupOldRecordings();
    }, 10000);
    cleanupInterval = setInterval(cleanupOldRecordings, 3600000);
    logger.system("Recording service started");
};

const stop = () => {
    if (cleanupInterval) { clearInterval(cleanupInterval); cleanupInterval = null; }
    logger.system("Recording service stopped");
};

module.exports = {
    getRecordingPath, compressRecording, finalizeGuacRecording, getRecordingInfo, isRecordingEnabled, computeCastDuration, start, stop,
};
