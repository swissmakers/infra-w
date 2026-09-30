const crypto = require("crypto");
const HostKey = require("../models/HostKey");
const logger = require("./logger");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const LAST_SEEN_WRITE_INTERVAL = 60 * 60 * 1000;

// same notation as OpenSSH, which drops the base64 padding
const fingerprintOf = (key) => `SHA256:${crypto.createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;

// the key blob starts with its type as an SSH string: uint32 length, then the name
const keyTypeOf = (key) => {
    try {
        return key.subarray(4, 4 + key.readUInt32BE(0)).toString("ascii") || "unknown";
    } catch {
        return "unknown";
    }
};

const verifyHostKey = async ({ host, port, key, accountId }) => {
    host = String(host).toLowerCase();
    port = Number(port) || 22;
    const keyType = keyTypeOf(key), fingerprint = fingerprintOf(key), now = new Date();
    const known = await HostKey.findOne({ where: { host, port } });

    if (!known) {
        const created = await HostKey.create({ host, port, keyType, fingerprint, firstSeenAt: now, lastSeenAt: now });
        await createAuditLog({ accountId, action: AUDIT_ACTIONS.HOST_KEY_TRUST, resource: RESOURCE_TYPES.HOST_KEY,
            resourceId: created.id, details: { host, port, keyType, fingerprint } });
        return { ok: true };
    }

    if (known.fingerprint === fingerprint && known.keyType === keyType) {
        if (now - new Date(known.lastSeenAt) > LAST_SEEN_WRITE_INTERVAL) await HostKey.update({ lastSeenAt: now }, { where: { id: known.id } });
        return { ok: true };
    }

    if (known.pendingFingerprint !== fingerprint) {
        await HostKey.update({ pendingKeyType: keyType, pendingFingerprint: fingerprint, pendingSeenAt: now }, { where: { id: known.id } });
        await createAuditLog({ accountId, action: AUDIT_ACTIONS.HOST_KEY_MISMATCH, resource: RESOURCE_TYPES.HOST_KEY, resourceId: known.id,
            details: { host, port, keyType, fingerprint, trustedKeyType: known.keyType, trustedFingerprint: known.fingerprint } });
        logger.warn("SSH host key changed; connection refused", { host, port, trusted: known.fingerprint, presented: fingerprint });
    }
    return { ok: false, message: `The host key of ${host}:${port} has changed (trusted ${known.keyType} ${known.fingerprint}, `
        + `presented ${keyType} ${fingerprint}). An administrator must accept the new key under Settings → Host keys.` };
};

// ssh2 only reports "Host denied (verification failed)", the returned function adds the reason
const withHostKeyCheck = (options, accountId) => {
    let rejection = null;
    options.hostVerifier = (key, verify) => {
        verifyHostKey({ host: options.host, port: options.port, key, accountId }).then(result => {
            rejection = result.ok ? null : result.message;
            verify(result.ok);
        }, error => {
            logger.error("Host key check failed", { host: options.host, error: error.message });
            rejection = "The host key could not be checked";
            verify(false);
        });
    };
    return (error) => {
        if (rejection && error) error.message = rejection;
        return error;
    };
};

module.exports = { verifyHostKey, withHostKeyCheck, fingerprintOf, keyTypeOf };
