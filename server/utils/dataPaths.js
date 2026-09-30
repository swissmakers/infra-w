const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../../data");

const paths = {
    DATA_DIR,
    DB_PATH: path.join(DATA_DIR, "infra-w.db"),
    LOGS_DIR: path.join(DATA_DIR, "logs"),
    RECORDINGS_DIR: path.join(DATA_DIR, "recordings"),
    CERTS_DIR: path.join(DATA_DIR, "certs"),
    BACKUP_TEMP_DIR: path.join(DATA_DIR, ".backup-temp"),
};

const ensureDataDirs = () => {
    for (const dir of [paths.DATA_DIR, paths.LOGS_DIR, paths.CERTS_DIR]) fs.mkdirSync(dir, { recursive: true });
};

module.exports = { ...paths, ensureDataDirs };
