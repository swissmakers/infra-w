const MonitoringSettings = require("../models/MonitoringSettings");
const logger = require("../utils/logger");

const ensureSettingsRow = async () => {
    let settings = await MonitoringSettings.findOne();
    if (!settings) {
        settings = await MonitoringSettings.create({});
    }
    return settings;
};

module.exports.getStatusCheckerSettings = async () => {
    try {
        const settings = await ensureSettingsRow();
        return {
            statusCheckerEnabled: Boolean(settings.statusCheckerEnabled),
            statusInterval: settings.statusInterval,
        };
    } catch (error) {
        logger.error("Error getting status checker settings", { error: error.message });
        return { code: 500, message: "Failed to retrieve status checker settings" };
    }
};

module.exports.updateStatusCheckerSettings = async (updateData) => {
    try {
        const settings = await ensureSettingsRow();
        const updatePayload = {};

        if (updateData.statusCheckerEnabled !== undefined) {
            updatePayload.statusCheckerEnabled = Boolean(updateData.statusCheckerEnabled);
        }

        if (updateData.statusInterval !== undefined) {
            updatePayload.statusInterval = Math.max(10, Math.min(300, updateData.statusInterval));
        }

        await MonitoringSettings.update(updatePayload, { where: { id: settings.id } });
        return module.exports.getStatusCheckerSettings();
    } catch (error) {
        logger.error("Error updating status checker settings", { error: error.message });
        return { code: 500, message: "Failed to update status checker settings" };
    }
};

module.exports.getStatusCheckerSettingsInternal = async () => {
    try {
        return await ensureSettingsRow();
    } catch (error) {
        logger.error("Error getting status checker settings internally", { error: error.message });
        return null;
    }
};
