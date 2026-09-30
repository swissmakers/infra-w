module.exports = {
    async up(queryInterface, Sequelize) {
        const sessions = await queryInterface.describeTable("sessions");
        const tables = await queryInterface.showAllTables();
        await queryInterface.sequelize.transaction(async transaction => {
            if (!sessions.createdAt) {
                await queryInterface.addColumn("sessions", "createdAt", { type: Sequelize.DATE, allowNull: true }, { transaction });
                await queryInterface.sequelize.query("UPDATE sessions SET createdAt = ? WHERE createdAt IS NULL",
                    { replacements: [new Date().toISOString()], transaction });
            }
            if (!sessions.impersonatorId) {
                await queryInterface.addColumn("sessions", "impersonatorId", { type: Sequelize.INTEGER, allowNull: true }, { transaction });
            }
            if (!tables.includes("system_settings")) {
                await queryInterface.createTable("system_settings", {
                    id: { type: Sequelize.INTEGER, primaryKey: true },
                    sessionIdleHours: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 12 },
                    sessionMaxDays: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
                    auditRetentionDays: { type: Sequelize.INTEGER, allowNull: true },
                }, { transaction });
                await queryInterface.bulkInsert("system_settings", [{ id: 1, sessionIdleHours: 12, sessionMaxDays: 30, auditRetentionDays: null }], { transaction });
            }
        });
    },
};
