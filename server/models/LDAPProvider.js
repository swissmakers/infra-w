const Sequelize = require("sequelize");
const logger = require("../utils/logger");
const db = require("../utils/database");
const { encrypt, decrypt } = require("../utils/encryption");

const encryptPassword = (provider) => {
    if (provider.bindPassword && provider.bindPassword !== "********") {
        const encrypted = encrypt(provider.bindPassword);
        Object.assign(provider, {
            bindPassword: encrypted.encrypted,
            bindPasswordIV: encrypted.iv,
            bindPasswordAuthTag: encrypted.authTag,
        });
    }
};

const decryptPassword = (provider) => {
    if (!provider?.bindPassword) return;
    try {
        provider.bindPassword = decrypt(provider.bindPassword, provider.bindPasswordIV, provider.bindPasswordAuthTag);
    } catch (error) {
        logger.error("Failed to decrypt bind password for LDAP provider", {
            providerId: provider.id,
            error: error.message,
        });
    }
};

const parseJsonFields = (provider) => {
    if (!provider) return;
    ["organizationIds", "adminGroupDNs"].forEach((field) => {
        const value = provider[field];
        if (typeof value === "string") {
            try {
                provider[field] = JSON.parse(value);
            } catch {
                provider[field] = [];
            }
        }
        if (!Array.isArray(provider[field])) {
            provider[field] = [];
        }
    });
};

module.exports = db.define("ldap_providers", {
    id: { type: Sequelize.INTEGER, autoIncrement: true, allowNull: false, primaryKey: true },
    name: { type: Sequelize.STRING, allowNull: false },
    host: { type: Sequelize.STRING, allowNull: false },
    port: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 636 },
    bindDN: { type: Sequelize.STRING, allowNull: false },
    bindPassword: { type: Sequelize.STRING, allowNull: true },
    bindPasswordIV: { type: Sequelize.STRING, allowNull: true },
    bindPasswordAuthTag: { type: Sequelize.STRING, allowNull: true },
    baseDN: { type: Sequelize.STRING, allowNull: false },
    userSearchFilter: { type: Sequelize.STRING, allowNull: false, defaultValue: "(uid={{username}})" },
    usernameAttribute: { type: Sequelize.STRING, allowNull: false, defaultValue: "uid" },
    firstNameAttribute: { type: Sequelize.STRING, allowNull: true, defaultValue: "givenName" },
    lastNameAttribute: { type: Sequelize.STRING, allowNull: true, defaultValue: "sn" },
    emailAttribute: { type: Sequelize.STRING, allowNull: true, defaultValue: "mail" },
    organizationIds: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
    adminGroupDNs: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
    groupSearchBaseDN: { type: Sequelize.STRING, allowNull: true },
    groupSearchFilter: { type: Sequelize.STRING, allowNull: true, defaultValue: "(member={{dn}})" },
    groupNameAttribute: { type: Sequelize.STRING, allowNull: true, defaultValue: "cn" },
    groupMemberAttribute: { type: Sequelize.STRING, allowNull: true, defaultValue: "member" },
    connectionTimeoutMs: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10000 },
    searchTimeoutMs: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10000 },
    enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    useTLS: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    freezeTableName: true,
    createdAt: false,
    updatedAt: false,
    hooks: {
        beforeCreate: encryptPassword,
        beforeUpdate: encryptPassword,
        afterFind: (providers) => {
            if (!providers) return;
            (Array.isArray(providers) ? providers : [providers]).forEach((provider) => {
                decryptPassword(provider);
                parseJsonFields(provider);
            });
        },
    },
});
