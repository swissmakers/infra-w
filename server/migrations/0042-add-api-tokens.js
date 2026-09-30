module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (tables.includes("api_tokens")) return;
        await queryInterface.createTable("api_tokens", {
            id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            accountId: { type: Sequelize.INTEGER, allowNull: false, references: { model: "accounts", key: "id" }, onDelete: "CASCADE" },
            name: { type: Sequelize.STRING, allowNull: false },
            tokenHash: { type: Sequelize.STRING, allowNull: false, unique: true },
            prefix: { type: Sequelize.STRING, allowNull: false },
            scope: { type: Sequelize.STRING, allowNull: false },
            expiresAt: { type: Sequelize.DATE, allowNull: false },
            lastUsedAt: { type: Sequelize.DATE, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false },
        });
    },
};
