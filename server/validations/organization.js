const Joi = require("joi");

module.exports.createOrganizationSchema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).allow("", null),
});

module.exports.updateOrganizationSchema = Joi.object({
    name: Joi.string().trim().min(1).max(100),
    description: Joi.string().max(500).allow("", null),
}).min(1);

module.exports.memberRoleSchema = Joi.object({
    role: Joi.string().valid("manager", "member").required(),
});

module.exports.transferOwnershipSchema = Joi.object({
    accountId: Joi.number().integer().positive().required(),
});

module.exports.inviteUserSchema = Joi.object({
    username: Joi.string().required(),
});

module.exports.respondToInvitationSchema = Joi.object({
    accept: Joi.boolean().required(),
});