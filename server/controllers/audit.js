const AuditLog = require("../models/AuditLog");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Account = require("../models/Account");
const Entry = require("../models/Entry");
const Identity = require("../models/Identity");
const Folder = require("../models/Folder");
const Script = require("../models/Script");
const Integration = require("../models/Integration");
const { AUDIT_ACTIONS, RESOURCE_TYPES, AUDIT_GROUPS, auditGroupOf } = require("../utils/auditActions");
const { Op } = require("sequelize");
const { getClientIp, normalizeIp } = require("../utils/requestIp");
const { getOrgAuditSettings } = require("../utils/orgAuditSettings");
const { getSystemSettings } = require("./systemSettings");

const AUDIT_ACTOR_LIST_LIMIT = 500;

const formatActorLabel = (account) => {
    if (!account) return "";
    if (account.firstName || account.lastName) return getDisplayName(account);
    if (account.username) {
        if (account.authProviderType === "ldap" && account.authProviderName) {
            return `${account.username}@${account.authProviderName}`;
        }
        return account.username;
    }
    return `User #${account.id}`;
};

const organizationScope = (organizationId) => {
    if (organizationId === "personal") return { organizationId: null };
    if (organizationId) return { organizationId };
    return {};
};
const logger = require("../utils/logger");
const { getRecordingInfo } = require("../utils/recordingService");
const { getDisplayName } = require("../utils/displayName");

const RESOURCE_CONFIG = {
    entry: { model: Entry, detailsKey: "name" },
    identity: { model: Identity, detailsKey: "identityName" },
    folder: { model: Folder, detailsKey: "folderName" },
    script: { model: Script, detailsKey: "name" },
    account: { model: Account, attribute: "username", detailsKey: "username" },
    organization: { model: Organization, detailsKey: "name" },
    auth_provider: { detailsKey: "name" },
    backup: { detailsKey: "name" },
    host_key: { detailsKey: "host" },
    integration: { model: Integration, detailsKey: "name" },
};

const shouldAudit = (action, settings) => {
    const setting = AUDIT_GROUPS[auditGroupOf(action)]?.setting;
    return !settings || !setting || settings[setting] !== false;
};

const createAuditLog = async ({
                                  accountId, organizationId = null, action, resource = null, resourceId = null,
                                  details = {}, ipAddress = null, userAgent = null, reason = null,
                              }) => {
    try {
        if (!accountId || !action || typeof action !== "string") {
            logger.error("Invalid audit log parameters", { accountId, action });
            return;
        }

        if (organizationId) {
            const settings = await getOrgAuditSettings(organizationId);
            if (!shouldAudit(action, settings)) return;
        }

        const auditLog = await AuditLog.create({
            accountId, organizationId, action, resource, resourceId, details,
            ipAddress: normalizeIp(ipAddress), userAgent, reason, timestamp: new Date(),
        });

        return auditLog.id;
    } catch (error) {
        logger.error("Failed to create audit log", { error: error.message, stack: error.stack });
    }
};

const getAuditLogsInternal = async (filters = {}) => {
    const { organizationId, category, action, startDate, endDate, actorId, limit = 100, offset = 0 } = filters;

    const parts = [organizationScope(organizationId)];

    if (actorId) parts.push({ accountId: actorId });
    if (category) parts.push({ action: { [Op.in]: AUDIT_GROUPS[category].actions } });
    if (action) parts.push({ action });
    if (startDate || endDate) {
        const timestamp = {};
        if (startDate) timestamp[Op.gte] = new Date(startDate).toISOString();
        if (endDate) timestamp[Op.lte] = new Date(endDate).toISOString();
        parts.push({ timestamp });
    }

    const whereClause = parts.length === 1 ? parts[0] : { [Op.and]: parts };

    const result = await AuditLog.findAndCountAll({
        where: whereClause, order: [["timestamp", "DESC"]], limit, offset,
    });

    const accountIds = new Set(), orgIds = new Set(), resourceIdsByType = {};
    for (const log of result.rows) {
        accountIds.add(log.accountId);
        if (log.organizationId) orgIds.add(log.organizationId);
        if (log.resource && log.resourceId && RESOURCE_CONFIG[log.resource]?.model) {
            (resourceIdsByType[log.resource] ??= new Set()).add(log.resourceId);
        }
    }

    const resourceQueries = Object.entries(resourceIdsByType).map(([type, ids]) => {
        const { model, attribute = "name" } = RESOURCE_CONFIG[type];
        return model.findAll({ where: { id: { [Op.in]: [...ids] } }, attributes: ["id", attribute] })
            .then(rows => [type, new Map(rows.map(r => [r.id, r[attribute]]))]);
    });
    const [accounts, orgs, ...resources] = await Promise.all([
        Account.findAll({
            where: { id: { [Op.in]: [...accountIds] } },
            attributes: ["id", "username", "firstName", "lastName", "authProviderType", "authProviderName"],
        }),
        orgIds.size ? Organization.findAll({ where: { id: { [Op.in]: [...orgIds] } }, attributes: ["id", "name"] }) : [],
        ...resourceQueries,
    ]);

    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const orgMap = new Map(orgs.map(o => [o.id, o.name]));
    const resourceMaps = Object.fromEntries(resources);

    result.rows = result.rows.map(log => {
        const cfg = RESOURCE_CONFIG[log.resource];
        const resourceName = resourceMaps[log.resource]?.get(log.resourceId) || log.details?.[cfg?.detailsKey] || null;
        const actor = accountMap.get(log.accountId);
        return {
            id: log.id,
            accountId: log.accountId,
            organizationId: log.organizationId,
            action: log.action,
            category: auditGroupOf(log.action),
            resource: log.resource,
            resourceId: log.resourceId,
            resourceName,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            timestamp: log.timestamp,
            details: log.details,
            reason: log.reason,
            actorUsername: actor?.username || null,
            actorFirstName: actor?.firstName || null,
            actorLastName: actor?.lastName || null,
            actorAuthProviderType: actor?.authProviderType || "internal",
            actorAuthProviderName: actor?.authProviderName || null,
            organizationName: orgMap.get(log.organizationId) || null,
        };
    });

    return result;
};

const updateAuditLogWithSessionDuration = async (auditLogId, connectionStartTime) => {
    try {
        if (!auditLogId || !connectionStartTime) return;

        const auditLog = await AuditLog.findByPk(auditLogId);
        if (!auditLog) return;

        const currentDetails = auditLog.details || {};
        if (currentDetails.hasRecording) return;
        currentDetails.sessionDuration = Math.round((Date.now() - connectionStartTime) / 1000);

        await AuditLog.update({ details: currentDetails }, { where: { id: auditLogId } });
    } catch (error) {
        logger.error("Error updating audit log with session duration", { error: error.message, auditLogId });
    }
};

module.exports.getAuditLogs = async (filters = {}) => {
    const result = await getAuditLogsInternal(filters);
    return { logs: result.rows, total: result.count, filters };
};

const EXPORT_PAGE_SIZE = 1000;
const EXPORT_MAX_ROWS = 100000;
const EXPORT_COLUMNS = ["timestamp", "actor", "action", "category", "resource", "resourceName", "organization", "ipAddress", "reason", "details"];

// a leading quote stops spreadsheets from running the value as a formula
const csvCell = (value) => {
    let text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

module.exports.exportAuditLogs = async (filters = {}) => {
    const lines = [EXPORT_COLUMNS.join(",")];
    for (let offset = 0; offset < EXPORT_MAX_ROWS; offset += EXPORT_PAGE_SIZE) {
        const { rows } = await getAuditLogsInternal({ ...filters, limit: EXPORT_PAGE_SIZE, offset });
        for (const log of rows) {
            const actor = log.actorUsername ? (log.actorAuthProviderName ? `${log.actorUsername}@${log.actorAuthProviderName}` : log.actorUsername) : `#${log.accountId}`;
            lines.push([new Date(log.timestamp).toISOString(), actor, log.action, log.category, log.resource, log.resourceName,
                log.organizationName, log.ipAddress, log.reason, log.details].map(csvCell).join(","));
        }
        if (rows.length < EXPORT_PAGE_SIZE) break;
    }
    return { csv: lines.join("\r\n") + "\r\n", rows: lines.length - 1 };
};

const pruneAuditLogs = async () => {
    const { auditRetentionDays } = await getSystemSettings();
    if (!auditRetentionDays) return 0;
    const deleted = await AuditLog.destroy({ where: { timestamp: { [Op.lt]: new Date(Date.now() - auditRetentionDays * 86400000).toISOString() } } });
    if (deleted) logger.system("Audit entries past their retention removed", { count: deleted, retentionDays: auditRetentionDays });
    return deleted;
};

module.exports.pruneAuditLogs = pruneAuditLogs;
module.exports.startAuditRetention = () => {
    const run = () => pruneAuditLogs().catch(error => logger.error("Audit retention cleanup failed", { error: error.message }));
    run();
    setInterval(run, 24 * 60 * 60 * 1000).unref();
};

module.exports.getOrganizationAuditSettings = async (accountId, organizationId) => {
    try {
        const membership = await OrganizationMember.findOne({
            where: { organizationId, accountId, status: "active" },
        });
        if (!membership) return { code: 403, message: "You don't have access to this organization" };

        return await getOrgAuditSettings(organizationId);
    } catch (error) {
        logger.error("Error getting organization audit settings", { error: error.message, organizationId });
        return { code: 500, message: "Failed to retrieve audit settings" };
    }
};

module.exports.updateOrganizationAuditSettings = async (accountId, organizationId, settings) => {
    try {
        // the route is admin-only, so membership is enough
        const membership = await OrganizationMember.findOne({
            where: { organizationId, accountId, status: "active" },
        });
        if (!membership) return { code: 403, message: "You don't have access to this organization" };

        const currentSettings = await getOrgAuditSettings(organizationId);
        const updatedSettings = { ...currentSettings, ...settings };

        await Organization.update({ auditSettings: updatedSettings }, { where: { id: organizationId } });
        return updatedSettings;
    } catch (error) {
        logger.error("Error updating organization audit settings", { error: error.message, organizationId });
        return { code: 500, message: "Failed to update audit settings" };
    }
};

const getAuditActors = async (organizationId) => {
    const rows = await AuditLog.findAll({
        attributes: ["accountId"],
        where: organizationScope(organizationId),
        group: ["accountId"],
        order: [["accountId", "ASC"]],
        limit: AUDIT_ACTOR_LIST_LIMIT,
        raw: true,
    });
    const ids = rows.map(r => r.accountId).filter(Boolean);
    if (!ids.length) return [];

    const accounts = await Account.findAll({
        where: { id: { [Op.in]: ids } },
        attributes: ["id", "username", "firstName", "lastName", "authProviderType", "authProviderName"],
    });
    const byId = new Map(accounts.map(a => [a.id, a]));
    return ids
        .map(id => {
            const a = byId.get(id);
            return a ? { id: a.id, label: formatActorLabel(a) } : { id, label: `User #${id}` };
        })
        .sort((x, y) => x.label.localeCompare(y.label));
};

module.exports.getAuditMetadata = async (organizationId = null) => ({
    categories: Object.entries(AUDIT_GROUPS).map(([key, group]) => ({ key, actions: group.actions })),
    actors: await getAuditActors(organizationId),
    organizations: await Organization.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]] }),
});

module.exports.getRecording = async (auditLogId) => {
    try {
        const auditLog = await AuditLog.findByPk(auditLogId);
        if (!auditLog) return { code: 404, message: "Audit log not found" };

        const recordingInfo = getRecordingInfo(auditLogId);
        if (!recordingInfo.exists) return { code: 404, message: "Recording not found" };

        return { type: recordingInfo.type, path: recordingInfo.path };
    } catch (error) {
        logger.error("Error getting recording", { error: error.message, auditLogId });
        return { code: 500, message: "Failed to retrieve recording" };
    }
};

module.exports.createAuditLog = createAuditLog;
module.exports.auditRequest = (req, entry) => createAuditLog({
    accountId: req.user.id, ipAddress: getClientIp(req), userAgent: req.headers["user-agent"] || null, ...entry,
    ...(req.apiToken && { details: { ...entry.details, apiToken: req.apiToken.name } }),
});
module.exports.updateAuditLogWithSessionDuration = updateAuditLogWithSessionDuration;
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
module.exports.RESOURCE_TYPES = RESOURCE_TYPES;
