module.exports = {
    async up(queryInterface, Sequelize) {
        const accounts = await queryInterface.describeTable("accounts");
        if (!accounts.disabled) {
            await queryInterface.addColumn("accounts", "disabled", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
        }
    },
};
