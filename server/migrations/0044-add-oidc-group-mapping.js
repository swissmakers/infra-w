module.exports = {
    async up(queryInterface, Sequelize) {
        const columns = await queryInterface.describeTable("oidc_providers");
        const add = async (name, definition) => { if (!columns[name]) await queryInterface.addColumn("oidc_providers", name, definition); };
        await add("groupsClaim", { type: Sequelize.STRING, allowNull: false, defaultValue: "groups" });
        await add("adminGroups", { type: Sequelize.TEXT, allowNull: false, defaultValue: "[]" });
        await add("organizationGroups", { type: Sequelize.TEXT, allowNull: false, defaultValue: "[]" });
    },
};
