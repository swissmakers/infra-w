const Joi = require("joi");

module.exports.updateStatusCheckerSettingsValidation = Joi.object({
    statusCheckerEnabled: Joi.boolean(),
    statusInterval: Joi.number().integer().min(10).max(300),
});
