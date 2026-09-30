const { Router } = require("express");
const { getSystemSettings, updateSystemSettings } = require("../controllers/systemSettings");
const { systemSettingsValidation, notificationSettingsValidation } = require("../validations/systemSettings");
const { getNotificationSettings, updateNotificationSettings, sendTestNotification } = require("../utils/notifications");
const { sendFailure } = require("../utils/error");
const { validateSchema } = require("../utils/schema");
const { auditRequest, pruneAuditLogs, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const app = Router();

/**
 * GET /settings
 * @summary Get System Settings (Admin)
 * @description Returns the sign-in session lifetime (idle hours, maximum days) and the audit log retention (days, null keeps entries forever).
 * @tags Settings
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - System settings
 */
app.get("/", async (req, res) => {
    res.json(await getSystemSettings());
});

/**
 * PATCH /settings
 * @summary Update System Settings (Admin)
 * @description Changes the sign-in session lifetime or the audit log retention. New limits apply to existing sessions within a minute; a shorter audit retention deletes older entries at once.
 * @tags Settings
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - sessionIdleHours (1-720), sessionMaxDays (1-365), auditRetentionDays (30-3650 or null)
 * @return {object} 200 - Updated system settings
 */
app.patch("/", async (req, res) => {
    if (validateSchema(res, systemSettingsValidation, req.body)) return;
    const settings = await updateSystemSettings(req.body);
    await auditRequest(req, { action: AUDIT_ACTIONS.SETTINGS_UPDATE, resource: RESOURCE_TYPES.SETTINGS, details: req.body });
    if (req.body.auditRetentionDays) await pruneAuditLogs();
    res.json(settings);
});

/**
 * GET /settings/notifications
 * @summary Get Notification Settings
 * @description Returns the webhook URL, the events it receives and whether a signing secret is set (never the secret).
 * @tags Settings
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - { webhookUrl, webhookEvents, hasSecret, events }
 */
app.get("/notifications", async (req, res) => {
    res.json(await getNotificationSettings());
});

/**
 * PATCH /settings/notifications
 * @summary Update Notification Settings
 * @description Sets the webhook that receives the chosen events (backup.failed, integration.sync_failed, integration.removals_held, hosts.offline, hosts.online) as JSON POSTs. With a secret, requests carry "X-INFRA-W-Signature: sha256=<HMAC of the body>". Leave webhookSecret out to keep the stored one, "" removes it.
 * @tags Settings
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - { "webhookUrl": "https://...", "webhookEvents": ["backup.failed"], "webhookSecret": "..." }
 * @return {object} 200 - Updated settings
 */
app.patch("/notifications", async (req, res) => {
    if (validateSchema(res, notificationSettingsValidation, req.body)) return;
    const settings = await updateNotificationSettings(req.body);
    // webhook paths often carry a secret, so only the origin is audited
    await auditRequest(req, { action: AUDIT_ACTIONS.SETTINGS_UPDATE, resource: RESOURCE_TYPES.SETTINGS, details: {
        webhook: req.body.webhookUrl ? new URL(req.body.webhookUrl).origin : null, webhookEvents: req.body.webhookEvents,
        ...(req.body.webhookSecret !== undefined && { webhookSecretChanged: true }) } });
    res.json(settings);
});

/**
 * POST /settings/notifications/test
 * @summary Send a Test Notification
 * @description Sends a "test" event to the saved webhook and reports whether it was accepted.
 * @tags Settings
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - The webhook accepted it
 * @return {object} 400 - No webhook URL is set
 * @return {object} 502 - The webhook could not be reached or answered with an error
 */
app.post("/notifications/test", async (req, res) => {
    const result = await sendTestNotification();
    if (result.code) return sendFailure(res, result);
    res.json(result);
});

module.exports = app;
