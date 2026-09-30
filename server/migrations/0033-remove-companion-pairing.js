module.exports = {
    async up(queryInterface) {
        await queryInterface.dropTable("device_codes");
    },
};
