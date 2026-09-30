const Joi = require("joi");
const { passwordRule } = require("./account");

module.exports.createUserValidation = Joi.object({
    username: Joi.string().min(3).max(15).alphanum().required(),
    password: passwordRule.required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    role: Joi.string().valid("user", "admin").optional(),
});

module.exports.updateRoleValidation = Joi.object({
    role: Joi.string().valid("user", "admin").required()
});

module.exports.lockValidation = Joi.object({
    locked: Joi.boolean().required(),
});