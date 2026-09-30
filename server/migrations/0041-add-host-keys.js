module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (tables.includes("host_keys")) return;
        await queryInterface.createTable("host_keys", {
            id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            host: { type: Sequelize.STRING, allowNull: false },
            port: { type: Sequelize.INTEGER, allowNull: false },
            keyType: { type: Sequelize.STRING, allowNull: false },
            fingerprint: { type: Sequelize.STRING, allowNull: false },
            pendingKeyType: { type: Sequelize.STRING, allowNull: true },
            pendingFingerprint: { type: Sequelize.STRING, allowNull: true },
            pendingSeenAt: { type: Sequelize.DATE, allowNull: true },
            firstSeenAt: { type: Sequelize.DATE, allowNull: false },
            lastSeenAt: { type: Sequelize.DATE, allowNull: false },
        });
        await queryInterface.addIndex("host_keys", ["host", "port"], { unique: true });
    },
};
