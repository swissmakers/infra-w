const Organization = require("../models/Organization");

const DEFAULT_AUDIT_SETTINGS = {
    requireConnectionReason: false,
    enableFileOperationAudit: true,
    enableServerConnectionAudit: true,
    enableIdentityManagementAudit: true,
    enableIdentityCredentialsAccessAudit: true,
    enableServerManagementAudit: true,
    enableFolderManagementAudit: true,
    enableScriptExecutionAudit: true,
    enableSessionRecording: false,
    recordingRetentionDays: 90,
    allowSessionSharing: true,
    allowWritableSharing: true,
    shareMaxHours: 24,
};

module.exports.DEFAULT_AUDIT_SETTINGS = DEFAULT_AUDIT_SETTINGS;

module.exports.getOrgAuditSettings = async (organizationId) => {
    if (!organizationId) return null;
    const organization = await Organization.findByPk(organizationId, { attributes: ["auditSettings"] });
    return { ...DEFAULT_AUDIT_SETTINGS, ...(organization?.auditSettings || {}) };
};
