const Joi = require('joi');

const fields = {
    name: Joi.string().min(1).max(50),
    host: Joi.string(),
    port: Joi.number().integer().min(1).max(65535),
    bindDN: Joi.string(),
    bindPassword: Joi.string().allow('', null),
    baseDN: Joi.string(),
    userSearchFilter: Joi.string(),
    usernameAttribute: Joi.string(),
    emailAttribute: Joi.string().allow('', null),
    firstNameAttribute: Joi.string(),
    lastNameAttribute: Joi.string(),
    organizationIds: Joi.array().items(Joi.number().integer().positive()),
    adminGroupDNs: Joi.array().items(Joi.string().trim()),
    groupSearchBaseDN: Joi.string().allow('', null),
    groupSearchFilter: Joi.string().allow('', null),
    groupNameAttribute: Joi.string().allow('', null),
    groupMemberAttribute: Joi.string().allow('', null),
    connectionTimeoutMs: Joi.number().integer().min(1000).max(120000),
    searchTimeoutMs: Joi.number().integer().min(1000).max(120000),
    enabled: Joi.boolean(),
    useTLS: Joi.boolean(),
};

module.exports.ldapProviderValidation = Joi.object({
    ...fields,
    name: fields.name.required(),
    host: fields.host.required(),
    port: fields.port.default(636),
    bindDN: fields.bindDN.required(),
    baseDN: fields.baseDN.required(),
    userSearchFilter: fields.userSearchFilter.default('(uid={{username}})'),
    usernameAttribute: fields.usernameAttribute.default('uid'),
    emailAttribute: fields.emailAttribute.default('mail'),
    firstNameAttribute: fields.firstNameAttribute.default('givenName'),
    lastNameAttribute: fields.lastNameAttribute.default('sn'),
    organizationIds: fields.organizationIds.default([]),
    adminGroupDNs: fields.adminGroupDNs.default([]),
    groupSearchBaseDN: fields.groupSearchBaseDN.allow(null).default(null),
    groupSearchFilter: fields.groupSearchFilter.default('(member={{dn}})'),
    groupNameAttribute: fields.groupNameAttribute.default('cn'),
    groupMemberAttribute: fields.groupMemberAttribute.default('member'),
    connectionTimeoutMs: fields.connectionTimeoutMs.default(10000),
    searchTimeoutMs: fields.searchTimeoutMs.default(10000),
    enabled: fields.enabled.default(false),
    useTLS: fields.useTLS.default(true),
});

module.exports.ldapProviderUpdateValidation = Joi.object(fields);

module.exports.ldapTestUsersValidation = Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(100),
}).unknown(false);

module.exports.ldapDraftTestValidation = module.exports.ldapProviderValidation.keys({
    existingProviderId: Joi.number().integer().positive(),
});
