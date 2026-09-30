const Joi = require('joi');

const password = Joi.string().min(12).max(150);
module.exports.passwordRule = password;

module.exports.registerValidation = Joi.object({
    username: Joi.string().min(3).max(15).alphanum().required(),
    password: password.required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
});

module.exports.totpSetup = Joi.object({
    code: Joi.number().integer().required(),
});

module.exports.passwordChangeValidation = Joi.object({
    currentPassword: Joi.string().max(150).required(),
    password: password.required(),
});

module.exports.passwordResetValidation = Joi.object({
    password: password.required(),
});

module.exports.updateNameValidation = Joi.object({
    firstName: Joi.string().trim().max(50).allow(''),
    lastName: Joi.string().trim().max(50).allow(''),
}).or('firstName', 'lastName');

module.exports.updateSessionSyncValidation = Joi.object({
    sessionSync: Joi.string().valid('across_devices', 'same_browser', 'same_tab').required(),
});