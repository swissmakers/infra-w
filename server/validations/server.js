const Joi = require("joi");
const { normalizeCertFingerprints } = require("../utils/certFingerprints");

const configValidation = Joi.object({
    protocol: Joi.string().valid("ssh", "telnet", "rdp", "vnc").optional(),
    ip: Joi.string().optional(),
    port: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    keyboardLayout: Joi.string().optional(),
    nodeName: Joi.string().optional(),
    vmid: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    jumpHosts: Joi.array().items(Joi.number()).optional(),
    macAddress: Joi.string().pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).allow("").optional(),
    wakeOnLanEnabled: Joi.boolean().optional(),
    wakeOnLanBroadcast: Joi.string().ip({ version: ["ipv4"], cidr: "forbidden" }).allow("").optional(),
    certFingerprints: Joi.string().allow("").max(1000).custom((value, helpers) => {
        try {
            normalizeCertFingerprints(value);
            return value;
        } catch (error) {
            return helpers.message(error.message);
        }
    }).optional(),
}).unknown(true);

module.exports.createServerValidation = Joi.object({
    name: Joi.string().required(),
    folderId: Joi.number().allow(null).optional(),
    organizationId: Joi.number().allow(null).optional(),
    icon: Joi.string().optional(),
    type: Joi.string().valid("server", "pve-shell", "pve-lxc", "pve-qemu").optional().default("server"),
    renderer: Joi.string().optional(),
    identities: Joi.array().items(Joi.number()).optional(),
    config: configValidation.required()
});

module.exports.updateServerValidation = Joi.object({
    name: Joi.string().optional(),
    folderId: Joi.number().allow(null).optional(),
    organizationId: Joi.number().allow(null).optional(),
    icon: Joi.string().optional(),
    type: Joi.string().valid("server", "pve-shell", "pve-lxc", "pve-qemu").optional(),
    renderer: Joi.string().optional(),
    identities: Joi.array().items(Joi.number()).optional(),
    config: configValidation
});

module.exports.importSSHConfigValidation = Joi.object({
    folderId: Joi.number().required(),
    servers: Joi.array().max(1000).items(Joi.object({
        name: Joi.string().max(255).required(),
        ip: Joi.string().max(255).required(),
        port: Joi.number().integer().min(1).max(65535).default(22),
        identities: Joi.array().items(Joi.number()).default([]),
    })).required(),
});

module.exports.repositionServerValidation = Joi.object({
    targetId: Joi.number().allow(null).optional(),
    placement: Joi.string().valid('before', 'after').required(),
    folderId: Joi.number().allow(null).optional(),
    organizationId: Joi.number().allow(null).optional()
});