const HostKey = require("../models/HostKey");
const Entry = require("../models/Entry");

module.exports.listHostKeys = async () => {
    const [keys, entries] = await Promise.all([HostKey.findAll(), Entry.findAll({ attributes: ["id", "name", "config", "type"] })]);
    const serversAt = (host, port) => entries
        .filter(entry => entry.type === "server" && String(entry.config?.ip || "").toLowerCase() === host && Number(entry.config?.port || 22) === port)
        .map(entry => entry.name);
    return keys.map(key => ({ ...key, servers: serversAt(key.host, key.port) }))
        .sort((a, b) => Boolean(b.pendingFingerprint) - Boolean(a.pendingFingerprint) || a.host.localeCompare(b.host) || a.port - b.port);
};

module.exports.acceptHostKey = async (id) => {
    const key = await HostKey.findByPk(id);
    if (!key) return { code: 404, message: "The host key does not exist" };
    if (!key.pendingFingerprint) return { code: 409, message: "The host key has not changed" };
    await HostKey.update({ keyType: key.pendingKeyType, fingerprint: key.pendingFingerprint, pendingKeyType: null, pendingFingerprint: null,
        pendingSeenAt: null, lastSeenAt: new Date() }, { where: { id: key.id } });
    return { host: key.host, port: key.port, previous: key.fingerprint, fingerprint: key.pendingFingerprint };
};

module.exports.forgetHostKey = async (id) => {
    const key = await HostKey.findByPk(id);
    if (!key) return { code: 404, message: "The host key does not exist" };
    await HostKey.destroy({ where: { id: key.id } });
    return { host: key.host, port: key.port, fingerprint: key.fingerprint };
};
