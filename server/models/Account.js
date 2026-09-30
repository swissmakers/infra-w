const Sequelize = require("sequelize");
const db = require("../utils/database");
const speakeasy = require("speakeasy");

module.exports = db.define("accounts", {
    firstName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    lastName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    totpEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
    },
    role: {
        type: Sequelize.STRING,
        defaultValue: "user",
    },
    disabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    authProviderType: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    authProviderName: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    totpSecret: {
        type: Sequelize.STRING,
        defaultValue: () => {
            return speakeasy.generateSecret().base32;
        },
    },
    sessionSync: {
        type: Sequelize.STRING,
        defaultValue: "same_browser",
    },
    preferences: {
        type: Sequelize.JSON,
        defaultValue: {},
    },
}, { 
    freezeTableName: true, 
    createdAt: false, 
    updatedAt: false,
    hooks: {
        afterFind: (accounts) => {
            const parsePreferences = (account) => {
                if (account && account.preferences && typeof account.preferences === 'string') {
                    try {
                        account.preferences = JSON.parse(account.preferences);
                    } catch {
                        account.preferences = {};
                    }
                }
            };

            if (Array.isArray(accounts)) {
                accounts.forEach(parsePreferences);
            } else if (accounts) {
                parsePreferences(accounts);
            }
        },
    },
});