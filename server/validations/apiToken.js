const Joi = require("joi");

module.exports.createApiTokenValidation = Joi.object({
    name: Joi.string().trim().min(1).max(64).required(),
    scope: Joi.string().valid("read", "write").required(),
    days: Joi.number().integer().min(1).max(365).required(),
});
