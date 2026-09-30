const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const { authenticateDownload } = require("../middlewares/auth");
const db = require("../utils/database");
const logger = require("../utils/logger");
const { auditRequest, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { DATA_DIR, BACKUP_TEMP_DIR } = require("../utils/dataPaths");

const app = Router();

const streamFile = (res, filePath, filename, onClose) => {
    const stat = fs.statSync(filePath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (onClose) res.on("close", onClose);
    fs.createReadStream(filePath).pipe(res);
};

/**
 * GET /backup/export/database
 * @summary Export the database file
 * @description Downloads a consistent snapshot of the live database (VACUUM INTO). Administrators only; the download is audited.
 * @tags Backup
 * @param {string} token.query.required - Authentication token
 * @return {file} 200 - Database file download
 * @return {object} 500 - The snapshot could not be created
 */
app.get("/database", authenticateDownload, async (req, res) => {
    const snapshot = path.join(BACKUP_TEMP_DIR, `download-${Date.now()}.db`);
    try {
        fs.mkdirSync(BACKUP_TEMP_DIR, { recursive: true });
        await db.query("VACUUM INTO ?", { replacements: [snapshot] });
    } catch (error) {
        logger.error("Database snapshot for download failed", { error: error.message });
        fs.rmSync(snapshot, { force: true });
        return res.status(500).json({ code: 500, message: "The database snapshot could not be created" });
    }
    await auditRequest(req, { action: AUDIT_ACTIONS.DATABASE_DOWNLOAD, resource: RESOURCE_TYPES.BACKUP });
    streamFile(res, snapshot, `infra-w-${Date.now()}.db`, () => fs.rmSync(snapshot, { force: true }));
});

/**
 * GET /backup/export/{type}/{filename}
 * @summary Download a specific file from recordings or logs
 * @tags Backup
 * @param {string} type.path.required - File type (recordings or logs)
 * @param {string} filename.path.required - Name of the file to download
 * @param {string} token.query.required - Authentication token
 * @return {file} 200 - File download
 * @return {object} 400 - Invalid type
 * @return {object} 404 - File not found
 */
app.get("/:type/:filename", authenticateDownload, (req, res) => {
    const { type, filename } = req.params;
    if (type !== "recordings" && type !== "logs") return res.status(400).json({ message: "Invalid type" });

    const safeName = path.basename(filename);
    const filePath = path.join(DATA_DIR, type, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

    streamFile(res, filePath, safeName);
});

module.exports = app;
