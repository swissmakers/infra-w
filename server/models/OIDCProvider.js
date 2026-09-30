const Sequelize = require("sequelize");
const logger = require("../utils/logger");
const db = require("../utils/database");
const { encrypt, decrypt } = require("../utils/encryption");

// raw queries return the JSON group lists as text
const prepareProvider = (provider) => {
    if (!provider) return;
    if (provider.clientSecret) {
        try {
            provider.clientSecret = decrypt(provider.clientSecret, provider.clientSecretIV, provider.clientSecretAuthTag);
        } catch (error) {
            logger.error("Failed to decrypt client secret for OIDC provider", { providerId: provider.id, error: error.message });
        }
    }
    for (const field of ["adminGroups", "organizationGroups"]) {
        if (typeof provider[field] === "string") {
            try {
                provider[field] = JSON.parse(provider[field]);
            } catch {
                provider[field] = [];
            }
        }
        if (field in provider && !Array.isArray(provider[field])) provider[field] = [];
    }
};

module.exports = db.define("oidc_providers", {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        issuer: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        clientId: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        clientSecret: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        clientSecretIV: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        clientSecretAuthTag: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        redirectUri: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        scope: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "openid profile",
        },
        enabled: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        firstNameAttribute: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: "given_name",
        },
        lastNameAttribute: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: "family_name",
        },
        usernameAttribute: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: "preferred_username",
        },
        isInternal: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        groupsClaim: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "groups",
        },
        adminGroups: {
            type: Sequelize.JSON,
            allowNull: false,
            defaultValue: [],
        },
        organizationGroups: {
            type: Sequelize.JSON,
            allowNull: false,
            defaultValue: [],
        },
    },
    {
        freezeTableName: true,
        createdAt: false,
        updatedAt: false,
        hooks: {
            beforeCreate: (provider) => {
                if (provider.clientSecret) {
                    const encrypted = encrypt(provider.clientSecret);
                    provider.clientSecret = encrypted.encrypted;
                    provider.clientSecretIV = encrypted.iv;
                    provider.clientSecretAuthTag = encrypted.authTag;
                }
            },
            beforeUpdate: (provider) => {
                if (provider.clientSecret && provider.clientSecret !== "********") {
                    const encrypted = encrypt(provider.clientSecret);
                    provider.clientSecret = encrypted.encrypted;
                    provider.clientSecretIV = encrypted.iv;
                    provider.clientSecretAuthTag = encrypted.authTag;
                }
            },
            afterFind: (providers) => {
                (Array.isArray(providers) ? providers : [providers]).forEach(prepareProvider);
                return providers;
            },
        },
    },
);