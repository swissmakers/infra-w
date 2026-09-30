const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            const table = await queryInterface.describeTable("ldap_providers");
            const accountsTable = await queryInterface.describeTable("accounts");

            if (!table.organizationIds) {
                await queryInterface.addColumn("ldap_providers", "organizationIds", {
                    type: Sequelize.JSON,
                    allowNull: false,
                    defaultValue: [],
                }, { transaction });
            }

            if (!table.adminGroupDNs) {
                await queryInterface.addColumn("ldap_providers", "adminGroupDNs", {
                    type: Sequelize.JSON,
                    allowNull: false,
                    defaultValue: [],
                }, { transaction });
            }

            if (!table.emailAttribute) {
                await queryInterface.addColumn("ldap_providers", "emailAttribute", {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: "mail",
                }, { transaction });
            }

            if (!table.groupSearchBaseDN) {
                await queryInterface.addColumn("ldap_providers", "groupSearchBaseDN", {
                    type: Sequelize.STRING,
                    allowNull: true,
                }, { transaction });
            }

            if (!table.groupSearchFilter) {
                await queryInterface.addColumn("ldap_providers", "groupSearchFilter", {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: "(member={{dn}})",
                }, { transaction });
            }

            if (!table.groupNameAttribute) {
                await queryInterface.addColumn("ldap_providers", "groupNameAttribute", {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: "cn",
                }, { transaction });
            }

            if (!table.groupMemberAttribute) {
                await queryInterface.addColumn("ldap_providers", "groupMemberAttribute", {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: "member",
                }, { transaction });
            }

            if (!table.connectionTimeoutMs) {
                await queryInterface.addColumn("ldap_providers", "connectionTimeoutMs", {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 10000,
                }, { transaction });
            }

            if (!table.searchTimeoutMs) {
                await queryInterface.addColumn("ldap_providers", "searchTimeoutMs", {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 10000,
                }, { transaction });
            }

            if (!accountsTable.authProviderType) {
                await queryInterface.addColumn("accounts", "authProviderType", {
                    type: Sequelize.STRING,
                    allowNull: true,
                }, { transaction });
            }

            if (!accountsTable.authProviderName) {
                await queryInterface.addColumn("accounts", "authProviderName", {
                    type: Sequelize.STRING,
                    allowNull: true,
                }, { transaction });
            }

            await transaction.commit();
            logger.info("Migration 0032-add-ldap-org-admin-mapping completed successfully");
        } catch (error) {
            await transaction.rollback();
            logger.error("Migration 0032-add-ldap-org-admin-mapping failed", { error: error.message });
            throw error;
        }
    },
};
