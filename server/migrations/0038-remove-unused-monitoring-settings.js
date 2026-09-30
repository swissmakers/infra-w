module.exports = {
    async up(queryInterface) {
        const columns = await queryInterface.describeTable("monitoring_settings");
        for (const column of ["monitoringEnabled", "monitoringInterval", "dataRetentionHours", "connectionTimeout", "batchSize"]) {
            if (columns[column]) await queryInterface.removeColumn("monitoring_settings", column);
        }
    },
};
