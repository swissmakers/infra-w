const { INTEGER, STRING, TEXT } = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("system_settings", {
    id: { type: INTEGER, primaryKey: true },
    sessionIdleHours: { type: INTEGER, allowNull: false, defaultValue: 12 },
    sessionMaxDays: { type: INTEGER, allowNull: false, defaultValue: 30 },
    auditRetentionDays: { type: INTEGER, allowNull: true },
    webhookUrl: { type: STRING(2048), allowNull: true },
    webhookEvents: { type: TEXT, allowNull: true },
    webhookSecretEncrypted: { type: TEXT, allowNull: true },
    webhookSecretIV: { type: STRING, allowNull: true },
    webhookSecretAuthTag: { type: STRING, allowNull: true },
}, { freezeTableName: true, timestamps: false });
