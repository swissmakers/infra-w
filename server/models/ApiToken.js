const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("api_tokens", {
    accountId: { type: Sequelize.INTEGER, allowNull: false },
    name: { type: Sequelize.STRING, allowNull: false },
    tokenHash: { type: Sequelize.STRING, allowNull: false, unique: true },
    prefix: { type: Sequelize.STRING, allowNull: false },
    scope: { type: Sequelize.ENUM("read", "write"), allowNull: false },
    expiresAt: { type: Sequelize.DATE, allowNull: false },
    lastUsedAt: { type: Sequelize.DATE, allowNull: true },
    createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
}, { freezeTableName: true, updatedAt: false });
