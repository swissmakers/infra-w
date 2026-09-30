const SystemSettings = require("../models/SystemSettings");

const DEFAULTS = { sessionIdleHours: 12, sessionMaxDays: 30, auditRetentionDays: null };
let cached = null;

module.exports.getSystemSettings = async () => {
    if (!cached) {
        const row = await SystemSettings.findByPk(1);
        cached = Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, row?.[key] !== undefined ? row[key] : DEFAULTS[key]]));
    }
    return cached;
};

module.exports.updateSystemSettings = async (changes) => {
    await SystemSettings.upsert({ id: 1, ...(await module.exports.getSystemSettings()), ...changes });
    cached = null;
    return module.exports.getSystemSettings();
};
