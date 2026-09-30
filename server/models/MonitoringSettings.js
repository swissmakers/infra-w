const { INTEGER, BOOLEAN, DATE, NOW } = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("monitoring_settings", {
    id: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    statusCheckerEnabled: {
        type: BOOLEAN,
        defaultValue: true,
        allowNull: false,
    },
    statusInterval: {
        type: INTEGER,
        defaultValue: 30,
        allowNull: false,
    },
    createdAt: {
        type: DATE,
        defaultValue: NOW,
    },
    updatedAt: {
        type: DATE,
        defaultValue: NOW,
    },
});