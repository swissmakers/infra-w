const Joi = require("joi");

// schedule in hours, 0 turns it off
module.exports.backupSettingsValidation = Joi.object({
    scheduleInterval: Joi.number().valid(0, 1, 6, 12, 24, 168),
    retention: Joi.number().integer().min(1).max(100),
    includeDatabase: Joi.boolean(),
    includeRecordings: Joi.boolean(),
    includeLogs: Joi.boolean(),
}).min(1);

const providerFields = {
    name: Joi.string().trim().min(1).max(100),
    type: Joi.string().valid("local", "smb", "webdav"),
    path: Joi.string().max(1024).allow(""),
    url: Joi.string().uri({ scheme: ["http", "https"] }).max(1024).allow(""),
    folder: Joi.string().max(1024).allow(""),
    username: Joi.string().max(255).allow(""),
    password: Joi.string().max(1024).allow(""),
    share: Joi.string().max(1024).allow(""),
    domain: Joi.string().max(255).allow(""),
};

module.exports.backupProviderValidation = Joi.object({
    ...providerFields,
    name: providerFields.name.required(),
    type: providerFields.type.required(),
});

module.exports.backupProviderUpdateValidation = Joi.object(providerFields).min(1);
