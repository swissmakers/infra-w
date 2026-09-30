const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            const entriesTable = await queryInterface.describeTable("entries");
            const integrationsTable = await queryInterface.describeTable("integrations");

            if (!entriesTable.managedBy) {
                await queryInterface.addColumn("entries", "managedBy", {
                    type: Sequelize.STRING,
                    allowNull: true,
                }, { transaction });
            }

            if (!entriesTable.externalId) {
                await queryInterface.addColumn("entries", "externalId", {
                    type: Sequelize.STRING,
                    allowNull: true,
                }, { transaction });
            }

            if (!entriesTable.isManagedDisabled) {
                await queryInterface.addColumn("entries", "isManagedDisabled", {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                }, { transaction });
            }

            if (!integrationsTable.lastSyncStatus) {
                await queryInterface.addColumn("integrations", "lastSyncStatus", {
                    type: Sequelize.STRING,
                    allowNull: true,
                }, { transaction });
            }

            if (!integrationsTable.lastSyncMessage) {
                await queryInterface.addColumn("integrations", "lastSyncMessage", {
                    type: Sequelize.TEXT,
                    allowNull: true,
                }, { transaction });
            }

            await queryInterface.addIndex("entries", ["integrationId", "managedBy", "externalId"], {
                name: "entries_integration_managed_external_idx",
                transaction,
            }).catch(() => {});

            await transaction.commit();
            logger.info("Migration 0031-add-netbox-sync-fields completed successfully");
        } catch (error) {
            await transaction.rollback();
            logger.error("Migration 0031-add-netbox-sync-fields failed", { error: error.message });
            throw error;
        }
    },
};
