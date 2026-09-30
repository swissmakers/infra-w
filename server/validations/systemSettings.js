const Joi = require("joi");

const NOTIFICATION_EVENTS = ["backup.failed", "integration.sync_failed", "integration.removals_held", "hosts.offline", "hosts.online"];

module.exports.systemSettingsValidation = Joi.object({
    sessionIdleHours: Joi.number().integer().min(1).max(720),
    sessionMaxDays: Joi.number().integer().min(1).max(365),
    auditRetentionDays: Joi.number().integer().min(30).max(3650).allow(null),
}).min(1);

module.exports.notificationSettingsValidation = Joi.object({
    webhookUrl: Joi.string().uri({ scheme: ["http", "https"] }).max(2048).allow("", null).required(),
    webhookEvents: Joi.array().items(Joi.string().valid(...NOTIFICATION_EVENTS)).unique().required(),
    webhookSecret: Joi.string().max(256).allow("").optional(),
});

module.exports.NOTIFICATION_EVENTS = NOTIFICATION_EVENTS;
