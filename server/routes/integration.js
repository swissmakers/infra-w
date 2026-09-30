const { Router } = require("express");
const { isAdmin } = require("../middlewares/permission");
const { sendFailure } = require("../utils/error");
const { validateSchema } = require("../utils/schema");
const {
    getIntegration,
    createIntegration,
    deleteIntegration,
    editIntegration,
    getIntegrationCredentials,
    listIntegrations,
    syncIntegration,
    previewIntegration,
    testIntegration,
    getIntegrationSyncStatus,
} = require("../controllers/integration");
const { integrationCreationValidation, integrationUpdateValidation } = require("../validations/integration");
const { startPVEServer, shutdownPVEServer, stopPVEServer } = require("../controllers/pve");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const { validateEntryAccess } = require("../controllers/entry");
const { auditRequest, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const app = Router();

/**
 * GET /integrations/list
 * @summary List Integrations
 * @description Lists the Proxmox VE and NetBox integrations with their status and last sync result. Administrators only.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @return {array<object>} 200 - Integrations
 * @return {object} 403 - User is not an administrator
 */
app.get("/list", isAdmin, async (req, res) => {
    const integrations = await listIntegrations(req.user.id);
    if (integrations?.code) return sendFailure(res, integrations);

    res.json(integrations);
});

/**
 * GET /integrations/{integrationId}
 * @summary Get Integration Details
 * @description Retrieves detailed information about a specific integration configuration including connection details.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration
 * @return {object} 200 - Integration details
 * @return {object} 404 - Integration not found
 */
app.get("/:integrationId", isAdmin, async (req, res) => {
    const integration = await getIntegration(req.user.id, req.params.integrationId);
    if (integration?.code) return sendFailure(res, integration);

    res.json(integration);
});

/**
 * PUT /integrations
 * @summary Create Integration
 * @description Creates a new integration configuration for managing external systems like Proxmox VE.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @requestBody {object} - Integration configuration including connection details and authentication
 * @return {object} 200 - Integration successfully created with new integration ID
 * @return {object} 400 - Invalid integration configuration
 */
app.put("/", isAdmin, async (req, res) => {
    if (validateSchema(res, integrationCreationValidation, req.body)) return;

    const integration = await createIntegration(req.user.id, req.body);
    if (integration?.code) return sendFailure(res, integration);

    res.json({
        message: "Integration got successfully created",
        id: integration.id,
        sync: integration.sync || null,
    });
});

/**
 * DELETE /integrations/{integrationId}
 * @summary Delete Integration
 * @description Permanently removes an integration configuration from the user's account.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration to delete
 * @return {object} 200 - Integration successfully deleted
 * @return {object} 404 - Integration not found
 */
app.delete("/:integrationId", isAdmin, async (req, res) => {
    const integration = await deleteIntegration(req.user.id, req.params.integrationId);
    if (integration?.code) return sendFailure(res, integration);

    res.json({ message: "Integration got successfully deleted" });
});

/**
 * PATCH /integrations/{integrationId}
 * @summary Update Integration
 * @description Updates an existing integration's configuration such as connection details or authentication credentials.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration to update
 * @requestBody {object} - Updated integration configuration fields
 * @return {object} 200 - Integration successfully updated
 * @return {object} 404 - Integration not found
 */
app.patch("/:integrationId", isAdmin, async (req, res) => {
    if (validateSchema(res, integrationUpdateValidation, req.body)) return;

    const integration = await editIntegration(req.user.id, req.params.integrationId, req.body);
    if (integration?.code) return sendFailure(res, integration);

    res.json({
        message: "Integration got successfully edited",
        sync: integration.sync || null,
    });
});

/**
 * POST /integrations/{integrationId}/sync
 * @summary Sync Integration Resources
 * @description Synchronizes the integration with the external system. A NetBox sync that would remove more than 5 managed servers and more than 10% of them (or all of them) applies only creations and updates and holds the removals for review (result "held"); send { "allowRemovals": true } to apply them.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration to sync
 * @param {object} request.body - { "allowRemovals": true } to apply held removals
 * @return {object} 200 - Integration synced: created, updated, deleted, held, pendingRemovals
 * @return {object} 400 - Invalid integration type or missing credentials
 * @return {object} 404 - Integration not found
 * @return {object} 502 - The external system could not be synced
 */
app.post("/:integrationId/sync", isAdmin, async (req, res) => {
    const allowRemovals = req.body?.allowRemovals === true;
    const result = await syncIntegration(req.user.id, req.params.integrationId, { allowRemovals });
    if (result?.code) return sendFailure(res, result);
    if (allowRemovals) await auditRequest(req, { action: AUDIT_ACTIONS.INTEGRATION_REMOVALS_APPLY, resource: RESOURCE_TYPES.INTEGRATION,
        resourceId: Number(req.params.integrationId), details: { deleted: result.deleted } });

    res.json(result);
});

/**
 * POST /integrations/{integrationId}/preview
 * @summary Preview a NetBox Sync
 * @description Lists the servers a NetBox sync would create, update and remove, without changing anything, and whether the removals would be held for review.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration
 * @return {object} 200 - { create: [names], update: [names], remove: [names], removalsNeedReview }
 * @return {object} 400 - Not a NetBox integration or missing credentials
 * @return {object} 502 - NetBox could not be reached
 */
app.post("/:integrationId/preview", isAdmin, async (req, res) => {
    const result = await previewIntegration(req.user.id, req.params.integrationId);
    if (result?.code) return sendFailure(res, result);
    res.json(result);
});

/**
 * POST /integrations/{integrationId}/test
 * @summary Test Integration Connection
 * @description Connects to the Proxmox VE or NetBox API with the saved settings without importing anything.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration
 * @return {object} 200 - Connection works
 * @return {object} 404 - Integration not found
 * @return {object} 503 - The Proxmox server is not reachable
 * @return {object} 500 - The remote API refused the connection or the credentials
 */
app.post("/:integrationId/test", isAdmin, async (req, res) => {
    const result = await testIntegration(req.user.id, req.params.integrationId);
    if (result?.code) return sendFailure(res, result);

    res.json(result);
});

/**
 * GET /integrations/{integrationId}/sync-status
 * @summary Get Integration Sync Status
 * @description Returns the status and the result of the last scheduled or manual sync (time, "ok" or error, message).
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration
 * @return {object} 200 - { status, lastSyncAt, lastSyncStatus, lastSyncMessage }
 * @return {object} 404 - Integration not found
 */
app.get("/:integrationId/sync-status", isAdmin, async (req, res) => {
    const result = await getIntegrationSyncStatus(req.user.id, req.params.integrationId);
    if (result?.code) return sendFailure(res, result);

    res.json(result);
});

// not admin-only: access to the entry is enough, the integration credentials never leave the server
const handlePVEAction = async (req, res, action, actionName) => {
    const entry = await Entry.findByPk(req.params.entryId);
    const access = await validateEntryAccess(req.user.id, entry);
    if (!access.valid) return sendFailure(res, access);
    if (!entry.type.startsWith("pve-")) return res.status(400).json({ code: 400, message: "Invalid entry type" });

    const vmId = entry.config?.vmid;
    if (!vmId) return res.status(400).json({ code: 400, message: "Entry missing vmid" });

    const integration = await Integration.findByPk(entry.integrationId);
    if (!integration) return res.status(404).json({ code: 404, message: "Integration not found" });

    const { password } = await getIntegrationCredentials(integration.id);
    const server = { ...integration.config, ...entry.config, password };
    const type = entry.type === "pve-qemu" ? "qemu" : "lxc";

    try {
        const status = await action(server, vmId, type);
        if (status?.code) return res.status(502).json(status);
    } catch {
        return res.status(502).json({ code: 502, message: `Server could not get ${actionName}` });
    }

    await auditRequest(req, { action: AUDIT_ACTIONS.ENTRY_POWER, organizationId: entry.organizationId, resource: RESOURCE_TYPES.ENTRY,
        resourceId: entry.id, details: { name: entry.name, power: actionName } });
    res.json({ message: `Server got successfully ${actionName}` });
};

/**
 * POST /integrations/entry/{entryId}/start
 * @summary Start VM/Container by Entry ID
 * @description Starts a Proxmox VE virtual machine or LXC container. Requires access to the server entry; the power action is audited.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {object} 200 - VM/container started
 * @return {object} 400 - Invalid entry type
 * @return {object} 404 - Entry not found
 */
app.post("/entry/:entryId/start", (req, res) => 
    handlePVEAction(req, res, startPVEServer, "started")
);

/**
 * POST /integrations/entry/{entryId}/stop
 * @summary Force Stop VM/Container by Entry ID
 * @description Forcefully stops a virtual machine or LXC container on a Proxmox VE server without graceful shutdown.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {object} 200 - VM/container successfully stopped
 * @return {object} 400 - Invalid entry type
 * @return {object} 404 - Entry not found
 * @return {object} 500 - Failed to stop VM/container
 */
app.post("/entry/:entryId/stop", (req, res) => 
    handlePVEAction(req, res, stopPVEServer, "stopped")
);

/**
 * POST /integrations/entry/{entryId}/shutdown
 * @summary Graceful Shutdown VM/Container by Entry ID
 * @description Gracefully shuts down a virtual machine or LXC container on a Proxmox VE server, allowing the OS to properly close applications.
 * @tags Integration
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {object} 200 - VM/container successfully shutdown
 * @return {object} 400 - Invalid entry type
 * @return {object} 404 - Entry not found
 * @return {object} 500 - Failed to shutdown VM/container
 */
app.post("/entry/:entryId/shutdown", (req, res) => 
    handlePVEAction(req, res, shutdownPVEServer, "shutdown")
);

module.exports = app;
