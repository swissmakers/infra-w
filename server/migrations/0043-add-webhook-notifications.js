module.exports = {
    async up(queryInterface, Sequelize) {
        const columns = await queryInterface.describeTable("system_settings");
        const add = async (name, definition) => { if (!columns[name]) await queryInterface.addColumn("system_settings", name, definition); };
        await add("webhookUrl", { type: Sequelize.STRING(2048), allowNull: true });
        await add("webhookEvents", { type: Sequelize.TEXT, allowNull: true });
        await add("webhookSecretEncrypted", { type: Sequelize.TEXT, allowNull: true });
        await add("webhookSecretIV", { type: Sequelize.STRING, allowNull: true });
        await add("webhookSecretAuthTag", { type: Sequelize.STRING, allowNull: true });
    },
};
