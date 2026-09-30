const { Op } = require("sequelize");
const Integration = require("../models/Integration");
const Credential = require("../models/Credential");
const logger = require("./logger");
const { notify } = require("./notifications");

const notifySyncFailure = (integration, message) => notify("integration.sync_failed", { title: "Integration sync failed",
    message: `${integration.name}: ${message}`, details: { integration: integration.name, type: integration.type } });
const { syncNetboxIntegration } = require("./netboxSyncService");

let intervalHandle = null;
let running = false;

const POLL_INTERVAL_MS = 60 * 1000;

const normalizeSyncIntervalMinutes = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 15;
    return Math.max(1, parsed);
};

const getLastSyncAtMs = (integration) => {
    if (!integration?.lastSyncAt) return 0;
    const parsed = new Date(integration.lastSyncAt).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const isSyncDue = (integration) => {
    const syncIntervalMinutes = normalizeSyncIntervalMinutes(integration.config?.syncIntervalMinutes);
    const dueMs = syncIntervalMinutes * 60 * 1000;
    const lastSyncAtMs = getLastSyncAtMs(integration);
    const due = Date.now() - lastSyncAtMs >= dueMs;

    logger.debug("NetBox due-check evaluated", {
        integrationId: integration.id,
        syncIntervalMinutes,
        lastSyncAt: integration.lastSyncAt || null,
        lastSyncAtMs,
        due,
    });

    return due;
};

const syncDueIntegrations = async () => {
    if (running) return;
    running = true;

    try {
        const integrations = await Integration.findAll({
            where: {
                type: "netbox",
                status: { [Op.ne]: "disabled" },
            },
        });

        for (const integration of integrations) {
            if (!isSyncDue(integration)) continue;

            try {
                const credential = await Credential.findOne({
                    where: { integrationId: integration.id, type: "api-token" },
                });
                if (!credential?.secret) {
                    const message = credential
                        ? "NetBox scheduled sync failed: Integration credential could not be decrypted. Verify ENCRYPTION_KEY and re-enter credentials."
                        : "NetBox scheduled sync failed: Integration credentials not found.";
                    logger.warn("Skipping NetBox scheduled sync due to missing credentials", {
                        integrationId: integration.id,
                    });
                    await Integration.update({
                        status: "offline",
                        lastSyncAt: new Date(),
                        lastSyncStatus: "error",
                        lastSyncMessage: message,
                    }, { where: { id: integration.id } });
                    await notifySyncFailure(integration, message);
                    continue;
                }

                const ownerAccountId = integration.config?.ownerAccountId;
                if (!integration.organizationId && !ownerAccountId) {
                    logger.warn("Skipping personal NetBox integration without ownerAccountId", { integrationId: integration.id });
                    continue;
                }
                const integrationPayload = integration.toJSON ? integration.toJSON() : integration;
                await syncNetboxIntegration({
                    ...integrationPayload,
                    config: {
                        ...(integrationPayload.config || {}),
                        apiToken: credential.secret,
                    },
                }, integration.organizationId ? null : ownerAccountId);
            } catch (error) {
                const failedAt = new Date();
                logger.error("Failed NetBox scheduled sync", {
                    integrationId: integration.id,
                    error: error.message,
                });
                await Integration.update({
                    status: "offline",
                    lastSyncAt: failedAt,
                    lastSyncStatus: "error",
                    lastSyncMessage: `NetBox scheduled sync failed: ${error.message}`,
                }, { where: { id: integration.id } });
                await notifySyncFailure(integration, error.message);
            }
        }
    } finally {
        running = false;
    }
};

const startNetboxIntegrationService = () => {
    if (intervalHandle) return;
    intervalHandle = setInterval(syncDueIntegrations, POLL_INTERVAL_MS);
    syncDueIntegrations().catch((error) => {
        logger.error("Initial NetBox sync cycle failed", { error: error.message });
    });
    logger.system("NetBox integration service started");
};

const stopNetboxIntegrationService = () => {
    if (!intervalHandle) return;
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.system("NetBox integration service stopped");
};

module.exports = {
    startNetboxIntegrationService,
    stopNetboxIntegrationService,
    syncDueIntegrations,
};
