const Joi = require('joi');

const protocolActionSchema = Joi.object({
    protocol: Joi.string().valid("ssh", "rdp", "telnet", "vnc").required(),
    port: Joi.number().integer().min(1).max(65535).optional(),
    renderer: Joi.string().valid("terminal", "guac").optional(),
});

const netboxRuleSchema = Joi.object({
    id: Joi.string().optional(),
    enabled: Joi.boolean().default(true),
    targetType: Joi.string().valid("any", "device", "vm").default("any"),
    tagsAny: Joi.array().items(Joi.string()).optional(),
    deviceRolesAny: Joi.array().items(Joi.string()).optional(),
    vmRolesAny: Joi.array().items(Joi.string()).optional(),
    platformsAny: Joi.array().items(Joi.string()).optional(),
    nameIncludes: Joi.string().allow("").optional(),
    customFieldKey: Joi.string().allow("").optional(),
    customFieldValue: Joi.string().allow("").optional(),
    action: protocolActionSchema.required(),
});

const netboxConfigSchema = Joi.object({
    apiUrl: Joi.string().uri({ scheme: ["http", "https"] }).required(),
    apiToken: Joi.string().min(1).required(),
    verifyTls: Joi.boolean().optional(),
    syncIntervalMinutes: Joi.number().integer().min(1).max(1440).optional(),
    includeDeviceRoles: Joi.array().items(Joi.string()).optional(),
    excludeDeviceRoles: Joi.array().items(Joi.string()).optional(),
    includeVmRoles: Joi.array().items(Joi.string()).optional(),
    excludeVmRoles: Joi.array().items(Joi.string()).optional(),
    includeTags: Joi.array().items(Joi.string()).optional(),
    excludeTags: Joi.array().items(Joi.string()).optional(),
    defaultAction: protocolActionSchema.optional(),
    protocolRules: Joi.array().items(netboxRuleSchema).optional(),
});

const proxmoxConfigSchema = Joi.object({
    ip: Joi.string().required(),
    port: Joi.number().required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
});

const createSchema = Joi.object({
    type: Joi.string().valid("proxmox", "netbox").default("proxmox"),
    name: Joi.string().required(),
    folderId: Joi.number().optional().allow(null),
    organizationId: Joi.number().optional().allow(null),
    ip: Joi.when("type", { is: "proxmox", then: Joi.required(), otherwise: Joi.forbidden() }),
    port: Joi.when("type", { is: "proxmox", then: Joi.required(), otherwise: Joi.forbidden() }),
    username: Joi.when("type", { is: "proxmox", then: Joi.required(), otherwise: Joi.forbidden() }),
    password: Joi.when("type", { is: "proxmox", then: Joi.required(), otherwise: Joi.forbidden() }),
    apiUrl: Joi.when("type", { is: "netbox", then: Joi.required(), otherwise: Joi.forbidden() }),
    apiToken: Joi.when("type", { is: "netbox", then: Joi.required(), otherwise: Joi.forbidden() }),
    verifyTls: Joi.when("type", { is: "netbox", then: Joi.boolean().optional(), otherwise: Joi.forbidden() }),
    syncIntervalMinutes: Joi.when("type", { is: "netbox", then: Joi.number().integer().min(1).max(1440).optional(), otherwise: Joi.forbidden() }),
    includeDeviceRoles: Joi.when("type", { is: "netbox", then: Joi.array().items(Joi.string()).optional(), otherwise: Joi.forbidden() }),
    excludeDeviceRoles: Joi.when("type", { is: "netbox", then: Joi.array().items(Joi.string()).optional(), otherwise: Joi.forbidden() }),
    includeVmRoles: Joi.when("type", { is: "netbox", then: Joi.array().items(Joi.string()).optional(), otherwise: Joi.forbidden() }),
    excludeVmRoles: Joi.when("type", { is: "netbox", then: Joi.array().items(Joi.string()).optional(), otherwise: Joi.forbidden() }),
    includeTags: Joi.when("type", { is: "netbox", then: Joi.array().items(Joi.string()).optional(), otherwise: Joi.forbidden() }),
    excludeTags: Joi.when("type", { is: "netbox", then: Joi.array().items(Joi.string()).optional(), otherwise: Joi.forbidden() }),
    defaultAction: Joi.when("type", { is: "netbox", then: protocolActionSchema.optional(), otherwise: Joi.forbidden() }),
    protocolRules: Joi.when("type", { is: "netbox", then: Joi.array().items(netboxRuleSchema).optional(), otherwise: Joi.forbidden() }),
});

const updateSchema = Joi.object({
    type: Joi.string().valid("proxmox", "netbox").optional(),
    name: Joi.string().optional(),
    folderId: Joi.number().optional().allow(null),
    organizationId: Joi.number().optional().allow(null),
    ip: Joi.string().optional(),
    port: Joi.number().optional(),
    username: Joi.string().optional(),
    password: Joi.string().optional(),
    apiUrl: Joi.string().uri({ scheme: ["http", "https"] }).optional(),
    apiToken: Joi.string().min(1).optional(),
    verifyTls: Joi.boolean().optional(),
    syncIntervalMinutes: Joi.number().integer().min(1).max(1440).optional(),
    includeDeviceRoles: Joi.array().items(Joi.string()).optional(),
    excludeDeviceRoles: Joi.array().items(Joi.string()).optional(),
    includeVmRoles: Joi.array().items(Joi.string()).optional(),
    excludeVmRoles: Joi.array().items(Joi.string()).optional(),
    includeTags: Joi.array().items(Joi.string()).optional(),
    excludeTags: Joi.array().items(Joi.string()).optional(),
    defaultAction: protocolActionSchema.optional(),
    protocolRules: Joi.array().items(netboxRuleSchema).optional(),
});

module.exports.integrationCreationValidation = createSchema;
module.exports.integrationUpdateValidation = updateSchema;
module.exports.netboxConfigSchema = netboxConfigSchema;
module.exports.proxmoxConfigSchema = proxmoxConfigSchema;