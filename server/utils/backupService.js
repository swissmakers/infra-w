const fs = require("fs");
const path = require("path");
const { TarArchive } = require("archiver");
const { Sequelize } = require("sequelize");
const db = require("./database");
const { validateBackupName, extractBackupArchive } = require("./backupArchive");
const BackupSettings = require("../models/BackupSettings");
const BackupProvider = require("../models/BackupProvider");
const { createProvider } = require("./backupProviders");
const { AUDIT_ACTIONS, RESOURCE_TYPES } = require("./auditActions");
const logger = require("./logger");
const { notify } = require("./notifications");

const { DB_PATH, RECORDINGS_DIR, LOGS_DIR, BACKUP_TEMP_DIR: TEMP_DIR } = require("./dataPaths");

const SCHEDULE_CHECK_INTERVAL = 60 * 1000;
let scheduleTimer = null;

const getSettings = async () => {
    let settings = await BackupSettings.findOne({ raw: false });
    if (!settings) settings = await BackupSettings.create({});

    return {
        ...settings.dataValues,
        includeDatabase: settings.includeDatabase ?? true,
        includeRecordings: settings.includeRecordings ?? true,
        includeLogs: settings.includeLogs ?? false,
    };
};

module.exports.getSettings = getSettings;

const getProviderById = async (providerId) => {
    const provider = await BackupProvider.findByPk(providerId);
    if (!provider) throw new Error("Provider not found");
    return createProvider(provider);
};

const getDirSize = (dir) => {
    if (!fs.existsSync(dir)) return 0;
    let size = 0;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        size += stat.isDirectory() ? getDirSize(filePath) : stat.size;
    }
    return size;
};

module.exports.getStorageStats = () => ({
    database: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
    recordings: getDirSize(RECORDINGS_DIR),
    logs: getDirSize(LOGS_DIR),
});

module.exports.createBackup = async (providerId) => {
    const settings = await getSettings();
    const provider = await getProviderById(providerId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `backup-${timestamp}.tar.gz`;
    const tempPath = path.join(TEMP_DIR, backupName);

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    // copying the open file could catch a half-written state
    const snapshotPath = path.join(TEMP_DIR, `snapshot-${timestamp}.db`);
    if (settings.includeDatabase) await db.query("VACUUM INTO ?", { replacements: [snapshotPath] });

    try {
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(tempPath);
            const archive = new TarArchive({ gzip: true });

            output.on("close", resolve);
            output.on("error", reject);
            archive.on("error", reject);
            archive.on("warning", (err) => {
                if (err.code !== "ENOENT") reject(err);
            });
            archive.pipe(output);

            if (settings.includeDatabase) {
                archive.file(snapshotPath, { name: "infra-w.db" });
            }
            if (settings.includeRecordings && fs.existsSync(RECORDINGS_DIR)) {
                archive.directory(RECORDINGS_DIR, "recordings");
            }
            if (settings.includeLogs && fs.existsSync(LOGS_DIR)) {
                archive.directory(LOGS_DIR, "logs");
            }

            archive.finalize().catch(reject);
        });
    } finally {
        fs.rmSync(snapshotPath, { force: true });
    }

    const buffer = fs.readFileSync(tempPath);
    await provider.upload(buffer, backupName);
    fs.unlinkSync(tempPath);

    await module.exports.enforceRetention(providerId);

    logger.info(`Backup created: ${backupName}`);
    return backupName;
};

module.exports.enforceRetention = async (providerId) => {
    const settings = await getSettings();
    const provider = await getProviderById(providerId);
    const backups = await provider.list();

    if (backups.length > settings.retention) {
        const toDelete = backups.slice(settings.retention);
        for (const backup of toDelete) {
            await provider.delete(backup.name);
            logger.info(`Deleted old backup: ${backup.name}`);
        }
    }
};

module.exports.listBackups = async (providerId) => {
    const provider = await getProviderById(providerId);
    return provider.list();
};

// the live database is replaced next, so the restore is logged in the restored one
const prepareRestoredDatabase = async (file, { accountId, ipAddress = null, userAgent = null }, backupName) => {
    const restored = new Sequelize({ dialect: "sqlite", storage: file, logging: false });
    try {
        const [[{ integrity_check: result }]] = await restored.query("PRAGMA integrity_check");
        if (result !== "ok") throw new Error("The database in this backup is damaged");
        await restored.query(
            "INSERT INTO audit_logs (accountId, action, resource, details, ipAddress, userAgent, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            { replacements: [accountId, AUDIT_ACTIONS.BACKUP_RESTORE, RESOURCE_TYPES.BACKUP, JSON.stringify({ name: backupName }),
                ipAddress, userAgent, new Date().toISOString()] },
        ).catch(error => logger.warn("The restore could not be recorded in the restored audit log", { error: error.message }));
    } finally {
        await restored.close();
    }
};

// exits afterwards and relies on the container to restart the server
module.exports.restoreBackup = async (providerId, backupName, request) => {
    validateBackupName(backupName);
    const provider = await getProviderById(providerId);
    const buffer = await provider.download(backupName);
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    const workDir = fs.mkdtempSync(path.join(TEMP_DIR, "restore-"));
    const restorePath = path.join(workDir, "contents");
    fs.mkdirSync(restorePath);
    const tempFile = path.join(workDir, backupName);
    try {
        fs.writeFileSync(tempFile, buffer, { mode: 0o600 });
        await extractBackupArchive(tempFile, restorePath);

        const restoredDb = path.join(restorePath, "infra-w.db");
        const restoredRecordings = path.join(restorePath, "recordings");
        const restoredLogs = path.join(restorePath, "logs");

        if (fs.existsSync(restoredDb)) {
            await prepareRestoredDatabase(restoredDb, request, backupName);
            await db.close();
            for (const suffix of ["-journal", "-wal", "-shm"]) fs.rmSync(DB_PATH + suffix, { force: true });
            fs.renameSync(restoredDb, DB_PATH);
        }
        if (fs.existsSync(restoredRecordings)) {
            if (fs.existsSync(RECORDINGS_DIR)) fs.rmSync(RECORDINGS_DIR, { recursive: true });
            fs.renameSync(restoredRecordings, RECORDINGS_DIR);
        }
        if (fs.existsSync(restoredLogs)) {
            if (fs.existsSync(LOGS_DIR)) fs.rmSync(LOGS_DIR, { recursive: true });
            fs.renameSync(restoredLogs, LOGS_DIR);
        }

    } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
    logger.system(`Backup restored: ${backupName}, restarting server...`, { accountId: request.accountId });

    setTimeout(() => process.exit(0), 500);
};

module.exports.testProvider = async (providerConfig) => {
    const provider = createProvider(providerConfig);
    await provider.test();
    return true;
};

const runScheduledBackups = async () => {
    const providers = await BackupProvider.findAll();
    for (const provider of providers) {
        try {
            await module.exports.createBackup(provider.id);
        } catch (err) {
            logger.error(`Scheduled backup failed for provider ${provider.name}`, { error: err.message });
            await notify("backup.failed", { title: "Scheduled backup failed", message: `${provider.name}: ${err.message}`,
                details: { target: provider.name, type: provider.type } });
        }
    }
};

const runDueBackups = async () => {
    const settings = await getSettings();
    if (!settings.scheduleInterval) return;
    const lastRun = settings.lastScheduledRunAt ? new Date(settings.lastScheduledRunAt).getTime() : 0;
    if (Date.now() - lastRun < settings.scheduleInterval * 60 * 60 * 1000) return;
    await BackupSettings.update({ lastScheduledRunAt: new Date() }, { where: { id: settings.id } });
    await runScheduledBackups();
};

module.exports.runDueBackups = runDueBackups;

module.exports.start = () => {
    scheduleTimer = setInterval(() => runDueBackups().catch(error =>
        logger.error("Backup schedule check failed", { error: error.message })), SCHEDULE_CHECK_INTERVAL);
    scheduleTimer.unref();
    logger.system("Backup scheduler started");
};

module.exports.stop = () => {
    if (scheduleTimer) {
        clearInterval(scheduleTimer);
        scheduleTimer = null;
        logger.system("Backup scheduler stopped");
    }
};
