module.exports = {
    async up(queryInterface, Sequelize) {
        const entriesTable = await queryInterface.describeTable("entries");
        await queryInterface.sequelize.transaction(async transaction => {
            if (!entriesTable.osName) {
                await queryInterface.addColumn("entries", "osName", { type: Sequelize.STRING, allowNull: true }, { transaction });
            }
            if (!entriesTable.osDetectedAt) {
                await queryInterface.addColumn("entries", "osDetectedAt", { type: Sequelize.DATE, allowNull: true }, { transaction });
            }
        });
    },
};
