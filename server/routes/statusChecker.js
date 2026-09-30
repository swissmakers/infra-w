const { Router } = require("express");
const { sendFailure } = require("../utils/error");
const { isAdmin } = require("../middlewares/permission");
const { validateSchema } = require("../utils/schema");
const { getStatusCheckerSettings, updateStatusCheckerSettings } = require("../controllers/monitoringSettings");
const { updateStatusCheckerSettingsValidation } = require("../validations/statusChecker");
const { restartStatusChecker } = require("../utils/statusChecker");

const app = Router();

/**
 * GET /status-checker/settings/global
 * @summary Get Status Check Settings
 * @description Returns whether servers are checked for reachability and how often (seconds). Administrators only.
 * @tags Status Checks
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - { statusCheckerEnabled, statusInterval }
 * @return {object} 403 - User is not an administrator
 */
app.get("/settings/global", isAdmin, async (req, res) => {
    const settings = await getStatusCheckerSettings();
    if (settings?.code) return sendFailure(res, settings);
    res.json(settings);
});

/**
 * PATCH /status-checker/settings/global
 * @summary Update Status Check Settings
 * @description Turns status checks on or off and sets their interval (10–300 seconds); the checker restarts with the new values. When turned off, statuses become unknown.
 * @tags Status Checks
 * @produces application/json
 * @security BearerAuth
 * @param {UpdateStatusCheckerSettings} request.body.required - { statusCheckerEnabled, statusInterval }
 * @return {object} 200 - Updated settings
 * @return {object} 400 - Invalid values
 * @return {object} 403 - User is not an administrator
 */
app.patch("/settings/global", isAdmin, async (req, res) => {
    if (validateSchema(res, updateStatusCheckerSettingsValidation, req.body)) return;
    const updatedSettings = await updateStatusCheckerSettings(req.body);
    if (updatedSettings?.code) return sendFailure(res, updatedSettings);
    await restartStatusChecker();
    res.json(updatedSettings);
});

module.exports = app;
