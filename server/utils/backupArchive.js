const fs = require("node:fs");
const path = require("node:path");
const { createGunzip } = require("node:zlib");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const tar = require("tar");

const validateBackupName = name => {
    if (typeof name !== "string" || !/^backup-[a-zA-Z0-9._-]+\.tar\.gz$/.test(name)) {
        throw new Error("Invalid backup filename");
    }
    return name;
};

const extractBackupArchive = async (file, destination, { maxBytes = 10 * 1024 ** 3 } = {}) => {
    let bytes = 0;
    let entries = 0;
    let invalidEntry = false;
    const limiter = new Transform({
        transform(chunk, _encoding, callback) {
            bytes += chunk.length;
            callback(bytes > maxBytes ? new Error("Backup exceeds the restore size limit") : null, chunk);
        },
    });
    const extractor = tar.x({
        cwd: destination,
        strict: true,
        noChmod: true,
        filter(name, entry) {
            const normalized = path.posix.normalize(name).replace(/^\.\//, "");
            const allowedPath = normalized === "infra-w.db" || /^(recordings|logs)(\/|$)/.test(normalized);
            const validPayloadType = normalized === "infra-w.db" ? entry.type === "File" :
                /^(recordings|logs)\/?$/.test(normalized) ? entry.type === "Directory" :
                    ["File", "Directory"].includes(entry.type);
            const safe = !name.includes("\\") && !name.split("/").includes("..") &&
                !path.posix.isAbsolute(name) && allowedPath &&
                validPayloadType && ++entries <= 100000;
            if (!safe) invalidEntry = true;
            return safe;
        },
    });
    await pipeline(fs.createReadStream(file), createGunzip(), limiter, extractor);
    if (invalidEntry) throw new Error("Backup contains unsafe or unsupported entries");
    if (!entries) throw new Error("Backup contains no restorable data");
};

module.exports = { validateBackupName, extractBackupArchive };
