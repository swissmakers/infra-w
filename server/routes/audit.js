const { Router } = require("express");
const { sendFailure } = require("../utils/error");
const fs = require("fs");
const logger = require("../utils/logger");
const auditController = require("../controllers/audit");
const { getAuditLogsValidation, getAuditMetadataQueryValidation, updateOrganizationAuditSettingsValidation } = require("../validations/audit");
const { validateSchema } = require("../utils/schema");

const app = Router();

const parseFilters = (query) => ({
    organizationId: query.organizationId === "personal" ? "personal" : (query.organizationId ? parseInt(query.organizationId, 10) : null),
    category: query.category, action: query.action, startDate: query.startDate, endDate: query.endDate,
    actorId: query.actorId ? parseInt(query.actorId, 10) : undefined,
});

/**
 * GET /audit/logs
 * @summary Get Audit Logs
 * @description Retrieves audit logs of the whole instance (administrators only) with optional filtering by organization, activity group, action, actor, date range, and pagination support.
 * @tags Audit
 * @produces application/json
 * @security BearerAuth
 * @param {number} organizationId.query - Filter by organization ID
 * @param {string} category.query - Filter by activity group (connections, files, servers, identities, passwords, folders, scripts, signIn, administration)
 * @param {string} action.query - Filter by specific action, for example entry.ssh_connect
 * @param {string} startDate.query - Filter logs from this date (ISO 8601 format)
 * @param {string} endDate.query - Filter logs until this date (ISO 8601 format)
 * @param {number} limit.query - Maximum number of logs to return (default: 50)
 * @param {number} offset.query - Number of logs to skip for pagination (default: 0)
 * @param {number} actorId.query - Filter by actor account ID (audit_logs.accountId)
 * @return {object} 200 - Audit logs matching the specified criteria
 * @return {object} 400 - Invalid filter parameters
 */
app.get("/logs", async (req, res) => {
    if (validateSchema(res, getAuditLogsValidation, req.query)) return;
    res.json(await auditController.getAuditLogs({
        ...parseFilters(req.query), limit: parseInt(req.query.limit) || 50, offset: parseInt(req.query.offset) || 0,
    }));
});

/**
 * GET /audit/export
 * @summary Export Audit Logs as CSV
 * @description Downloads all audit entries matching the filters (same as GET /audit/logs, without paging; at most 100000) as CSV. The export itself is audited.
 * @tags Audit
 * @produces text/csv
 * @security BearerAuth
 * @param {number} organizationId.query - Filter by organization ID, or "personal" for activity outside organizations
 * @param {string} category.query - Filter by activity group
 * @param {string} action.query - Filter by specific action
 * @param {string} startDate.query - Entries from this date (ISO 8601)
 * @param {string} endDate.query - Entries until this date (ISO 8601)
 * @param {number} actorId.query - Filter by actor account ID
 * @return {file} 200 - CSV file
 * @return {object} 400 - Invalid filter parameters
 */
app.get("/export", async (req, res) => {
    if (validateSchema(res, getAuditLogsValidation, req.query)) return;
    const filters = parseFilters(req.query);
    const { csv, rows } = await auditController.exportAuditLogs(filters);
    await auditController.auditRequest(req, { action: auditController.AUDIT_ACTIONS.AUDIT_EXPORT, resource: auditController.RESOURCE_TYPES.AUDIT,
        details: { rows, filters: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== null)) } });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="infra-w-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
});

/**
 * GET /audit/metadata
 * @summary Get Audit Metadata
 * @description Retrieves the activity groups with their actions, the actors and all organizations, for filtering.
 * @tags Audit
 * @produces application/json
 * @security BearerAuth
 * @param {number} organizationId.query - Optional; scope the actor list like the audit logs (omit for the whole instance)
 * @return {object} 200 - Audit metadata: activity groups with their actions, and actors
 * @return {object} 500 - Internal server error
 */
app.get("/metadata", async (req, res) => {
    if (validateSchema(res, getAuditMetadataQueryValidation, req.query)) return;
    res.json(await auditController.getAuditMetadata(parseFilters(req.query).organizationId));
});

/**
 * GET /audit/organizations/{id}/settings
 * @summary Get Organization Audit Settings
 * @description Retrieves audit logging configuration settings for a specific organization, including retention policies and enabled audit features.
 * @tags Audit
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {object} 200 - Organization audit settings configuration
 * @return {object} 403 - Not a member of this organization
 * @return {object} 500 - Internal server error
 */
app.get("/organizations/:id/settings", async (req, res) => {
    try {
        const result = await auditController.getOrganizationAuditSettings(req.user.id, parseInt(req.params.id));
        if (result.code) return sendFailure(res, result);
        res.json(result);
    } catch (error) {
        logger.error("Error getting organization audit settings", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while retrieving audit settings" });
    }
});

/**
 * PATCH /audit/organizations/{id}/settings
 * @summary Update Organization Audit Settings
 * @description Updates audit logging configuration settings for a specific organization, such as retention policies and audit feature toggles.
 * @tags Audit
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {UpdateOrganizationAuditSettings} request.body.required - Updated audit settings configuration
 * @return {object} 200 - Audit settings successfully updated
 * @return {object} 400 - Invalid settings configuration
 * @return {object} 403 - Not a member of this organization
 * @return {object} 500 - Internal server error
 */
app.patch("/organizations/:id/settings", async (req, res) => {
    try {
        if (validateSchema(res, updateOrganizationAuditSettingsValidation, req.body)) return;
        const result = await auditController.updateOrganizationAuditSettings(req.user.id, parseInt(req.params.id), req.body);
        if (result.code) return sendFailure(res, result);
        res.json(result);
    } catch (error) {
        logger.error("Error updating organization audit settings", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while updating audit settings" });
    }
});

/**
 * GET /audit/{auditLogId}/recording
 * @summary Download Session Recording
 * @description Downloads a session recording file for the specified audit log entry. Recordings are returned as gzip-compressed files in either Guacamole (.guac) or Asciicast (.cast) format depending on the session type.
 * @tags Audit
 * @produces application/octet-stream, application/json
 * @security BearerAuth
 * @param {number} auditLogId.path.required - The unique identifier of the audit log entry containing the recording
 * @return {file} 200 - Gzip-compressed session recording file
 * @return {object} 403 - Access denied to the recording
 * @return {object} 404 - Recording not found
 * @return {object} 500 - Internal server error
 */
app.get("/:auditLogId/recording", async (req, res) => {
    try {
        const auditLogId = parseInt(req.params.auditLogId);
        const result = await auditController.getRecording(auditLogId);
        if (result.code) return sendFailure(res, result);

        res.setHeader("Content-Type", result.type === "cast" ? "application/json" : "application/octet-stream");
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Content-Disposition", `attachment; filename="${auditLogId}.${result.type}.gz"`);

        const fileStream = fs.createReadStream(result.path);
        fileStream.pipe(res);
        fileStream.on("error", (error) => {
            logger.error("Error streaming recording file", { auditLogId, error: error.message });
            if (!res.headersSent) res.status(500).json({ message: "Failed to stream recording" });
        });
    } catch (error) {
        logger.error("Error in recording route", { auditLogId: req.params.auditLogId, error: error.message });
        res.status(500).json({ message: "An error occurred while retrieving the recording" });
    }
});

module.exports = app;
