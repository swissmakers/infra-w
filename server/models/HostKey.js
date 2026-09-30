const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("host_keys", {
    host: { type: Sequelize.STRING, allowNull: false },
    port: { type: Sequelize.INTEGER, allowNull: false },
    keyType: { type: Sequelize.STRING, allowNull: false },
    fingerprint: { type: Sequelize.STRING, allowNull: false },
    pendingKeyType: { type: Sequelize.STRING, allowNull: true },
    pendingFingerprint: { type: Sequelize.STRING, allowNull: true },
    pendingSeenAt: { type: Sequelize.DATE, allowNull: true },
    firstSeenAt: { type: Sequelize.DATE, allowNull: false },
    lastSeenAt: { type: Sequelize.DATE, allowNull: false },
}, { freezeTableName: true, timestamps: false, indexes: [{ unique: true, fields: ["host", "port"] }] });
