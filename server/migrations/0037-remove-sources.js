module.exports = {
    async up(queryInterface) {
        const tables = await queryInterface.showAllTables();
        await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");
        for (const table of ["snippets", "scripts"]) {
            const columns = await queryInterface.describeTable(table);
            if (!columns.sourceId) continue;
            await queryInterface.sequelize.query(`DELETE FROM ${table} WHERE sourceId IS NOT NULL`);
            await queryInterface.removeColumn(table, "sourceId");
        }
        if (tables.includes("sources")) await queryInterface.dropTable("sources");
        await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
    },
};
