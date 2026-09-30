const Sequelize = require("sequelize");
const db = require("../utils/database");
const crypto = require("crypto");

module.exports = db.define("sessions", {
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    token: {
        type: Sequelize.STRING,
        defaultValue: () => crypto.randomBytes(48).toString("hex"),
    },
    ip: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    userAgent: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    lastActivity: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
    createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
    impersonatorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
}, { freezeTableName: true, timestamps: false });