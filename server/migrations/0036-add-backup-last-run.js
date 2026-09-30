module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable("backup_settings");
        if (!table.lastScheduledRunAt) {
            await queryInterface.addColumn("backup_settings", "lastScheduledRunAt", { type: Sequelize.DATE, allowNull: true });
        }
    },
};
