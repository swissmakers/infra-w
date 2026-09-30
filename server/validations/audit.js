const Joi = require("joi");
const { AUDIT_ACTIONS, AUDIT_GROUPS } = require("../utils/auditActions");

module.exports.getAuditLogsValidation = Joi.object({
    organizationId: Joi.alternatives().try(
        Joi.number().integer().positive(),
        Joi.string().valid('personal')
    ).optional(),
    category: Joi.string().valid(...Object.keys(AUDIT_GROUPS)).optional(),
    action: Joi.string().valid(...Object.values(AUDIT_ACTIONS)).optional(),
    actorId: Joi.number().integer().positive().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).optional(),
    limit: Joi.number().integer().min(1).max(1000).default(50),
    offset: Joi.number().integer().min(0).default(0),
});

module.exports.getAuditMetadataQueryValidation = Joi.object({
    organizationId: Joi.alternatives().try(
        Joi.number().integer().positive(),
        Joi.string().valid('personal'),
    ).optional(),
}).unknown(true);

module.exports.updateOrganizationAuditSettingsValidation = Joi.object({
    requireConnectionReason: Joi.boolean().optional(),
    enableFileOperationAudit: Joi.boolean().optional(),
    enableServerConnectionAudit: Joi.boolean().optional(),
    enableIdentityManagementAudit: Joi.boolean().optional(),
    enableIdentityCredentialsAccessAudit: Joi.boolean().optional(),
    enableServerManagementAudit: Joi.boolean().optional(),
    enableFolderManagementAudit: Joi.boolean().optional(),
    enableScriptExecutionAudit: Joi.boolean().optional(),
    enableSessionRecording: Joi.boolean().optional(),
    recordingRetentionDays: Joi.number().integer().min(1).max(3650).optional(),
    allowSessionSharing: Joi.boolean().optional(),
    allowWritableSharing: Joi.boolean().optional(),
    shareMaxHours: Joi.number().integer().min(1).max(168).optional(),
}).min(1);