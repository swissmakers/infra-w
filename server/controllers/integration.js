const Integration = require("../models/Integration");
const logger = require("../utils/logger");
const Folder = require("../models/Folder");
const Credential = require("../models/Credential");
const Entry = require("../models/Entry");
const { hasOrganizationAccess, validateFolderAccess, getActiveOrgIds } = require("../utils/permission");
const { getAllResources } = require("./pve");
const { testConnection } = require("../utils/netboxClient");
const { syncNetboxIntegration } = require("../utils/netboxSyncService");
const https = require("https");
const { Op } = require("sequelize");

const asPlainObject = (value) => (value && typeof value.toJSON === "function" ? value.toJSON() : value);
const CREDENTIAL_DECRYPT_ERROR = "Integration credential could not be decrypted. Verify ENCRYPTION_KEY and re-enter credentials.";

// older integrations have no ownerAccountId, their folders tell the owner
const ownsPersonalIntegration = async (accountId, integration) => {
    const ownerAccountId = asPlainObject(integration).config?.ownerAccountId;
    if (ownerAccountId) return ownerAccountId === accountId;
    return Boolean(await Folder.findOne({ where: { integrationId: integration.id, accountId } }));
};

const validateIntegrationAccess = async (accountId, integration) => {
    if (!integration) return { valid: false, error: { code: 401, message: "Integration does not exist" } };

    const hasAccess = integration.organizationId
        ? await hasOrganizationAccess(accountId, integration.organizationId)
        : await ownsPersonalIntegration(accountId, integration);
    if (!hasAccess) return { valid: false, error: { code: 403, message: "You don't have access to this integration" } };

    return { valid: true, integration };
};

module.exports.createIntegration = async (accountId, configuration) => {
    const integrationType = configuration.type || "proxmox";

    if (configuration.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, configuration.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization" };
        }
    }

    let folder = null;
    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) {
            return folderCheck.error;
        }

        folder = folderCheck.folder;
        if (folder.organizationId && !configuration.organizationId) {
            configuration.organizationId = folder.organizationId;
        }
    }

    const integrationConfig = integrationType === "netbox"
        ? {
            apiUrl: configuration.apiUrl,
            verifyTls: configuration.verifyTls !== false,
            syncIntervalMinutes: configuration.syncIntervalMinutes || 15,
            includeDeviceRoles: configuration.includeDeviceRoles || [],
            excludeDeviceRoles: configuration.excludeDeviceRoles || [],
            includeVmRoles: configuration.includeVmRoles || [],
            excludeVmRoles: configuration.excludeVmRoles || [],
            includeTags: configuration.includeTags || [],
            excludeTags: configuration.excludeTags || [],
            defaultAction: configuration.defaultAction || { protocol: "ssh", port: 22, renderer: "terminal" },
            protocolRules: configuration.protocolRules || [],
            folderId: configuration.folderId || null,
            ownerAccountId: configuration.organizationId ? null : accountId,
        }
        : {
            ip: configuration.ip,
            port: configuration.port,
            username: configuration.username,
            folderId: configuration.folderId || null,
            ownerAccountId: configuration.organizationId ? null : accountId,
        };

    if (integrationType === "proxmox") {
        const { createTicket, getAllNodes } = require("./pve");
        try {
            const serverConfig = {
                ip: configuration.ip,
                port: configuration.port,
                username: configuration.username,
                password: configuration.password,
            };

            const ticket = await createTicket(
                { ip: serverConfig.ip, port: serverConfig.port },
                serverConfig.username,
                serverConfig.password
            );

            await getAllNodes({ ip: serverConfig.ip, port: serverConfig.port }, ticket);
        } catch (error) {
            logger.error('Failed to connect to Proxmox cluster', { ip: configuration.ip, port: configuration.port, error: error.message });

            if (error.response?.status === 401 || error.message.includes('401')) {
                return { code: 401, message: "Invalid credentials for Proxmox server" };
            }

            if (error.code === 'ECONNREFUSED') {
                return { code: 503, message: `Cannot reach Proxmox server at ${configuration.ip}:${configuration.port}` };
            }

            if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
                return { code: 503, message: `Proxmox server at ${configuration.ip}:${configuration.port} is not reachable` };
            }

            return { code: 500, message: `Failed to connect to Proxmox cluster: ${error.message}` };
        }
    } else if (integrationType === "netbox") {
        try {
            const httpsAgent = new https.Agent({ rejectUnauthorized: configuration.verifyTls !== false });
            await testConnection({ apiUrl: configuration.apiUrl, apiToken: configuration.apiToken, httpsAgent });
        } catch (error) {
            logger.error("Failed to connect to NetBox", { apiUrl: configuration.apiUrl, error: error.message });
            return { code: 500, message: `Failed to connect to NetBox API: ${error.message}` };
        }
    }

    const integration = await Integration.create({
        organizationId: configuration.organizationId || null,
        type: integrationType,
        name: configuration.name,
        config: integrationConfig,
        status: "online",
    });

    logger.info(`Integration created`, { integrationId: integration.id, name: integration.name, type: integration.type });

    if (integrationType === "proxmox" && configuration.password) {
        await Credential.create({
            integrationId: integration.id,
            type: "password",
            secret: configuration.password,
        });
    } else if (integrationType === "netbox" && configuration.apiToken) {
        await Credential.create({
            integrationId: integration.id,
            type: "api-token",
            secret: configuration.apiToken,
        });
    }

    let syncResult = null;
    try {
        syncResult = await this.syncIntegration(accountId, integration.id);
    } catch (error) {
        logger.error("Error during integration sync on creation", { integrationId: integration.id, error: error.message });
        syncResult = { code: 500, success: false, message: error.message };
    }

    return {
        ...asPlainObject(integration),
        sync: syncResult,
    };
};

module.exports.deleteIntegration = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration, "You don't have permission to delete this integration");

    if (!accessCheck.valid) return accessCheck.error;

    // NetBox hosts work without the integration, Proxmox entries do not
    if (integration.type === "proxmox") await Entry.destroy({ where: { integrationId: integration.id } });
    await Folder.destroy({ where: { integrationId: integration.id } });
    await Integration.destroy({ where: { id: integrationId } });

    logger.info(`Integration deleted`, { integrationId, name: integration.name });

    return { success: true };
};

module.exports.editIntegration = async (accountId, integrationId, configuration) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration, "You don't have permission to edit this integration");

    if (!accessCheck.valid) return accessCheck.error;

    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) {
            return folderCheck.error;
        }

        if (integration.organizationId && folderCheck.folder.organizationId !== integration.organizationId) {
            return { code: 403, message: "Folder must belong to the same organization as the integration" };
        } else if (!integration.organizationId && folderCheck.folder.organizationId) {
            return { code: 403, message: "Cannot move a personal integration to an organization folder" };
        }

        await Folder.update({ parentId: configuration.folderId }, { where: { integrationId: integration.id } });
    }

    if (integration.type === "proxmox" && configuration.password) {
        await Credential.destroy({ where: { integrationId, type: "password" } });
        await Credential.create({ integrationId, type: "password", secret: configuration.password });
        delete configuration.password;
    }

    if (integration.type === "netbox" && configuration.apiToken) {
        await Credential.destroy({ where: { integrationId, type: "api-token" } });
        await Credential.create({ integrationId, type: "api-token", secret: configuration.apiToken });
        delete configuration.apiToken;
    }

    const integrationConfig = integration.type === "netbox"
        ? {
            ...integration.config,
            apiUrl: configuration.apiUrl !== undefined ? configuration.apiUrl : integration.config.apiUrl,
            verifyTls: configuration.verifyTls !== undefined ? configuration.verifyTls : integration.config.verifyTls,
            syncIntervalMinutes: configuration.syncIntervalMinutes !== undefined ? configuration.syncIntervalMinutes : integration.config.syncIntervalMinutes,
            includeDeviceRoles: configuration.includeDeviceRoles !== undefined ? configuration.includeDeviceRoles : (integration.config.includeDeviceRoles || []),
            excludeDeviceRoles: configuration.excludeDeviceRoles !== undefined ? configuration.excludeDeviceRoles : (integration.config.excludeDeviceRoles || []),
            includeVmRoles: configuration.includeVmRoles !== undefined ? configuration.includeVmRoles : (integration.config.includeVmRoles || []),
            excludeVmRoles: configuration.excludeVmRoles !== undefined ? configuration.excludeVmRoles : (integration.config.excludeVmRoles || []),
            includeTags: configuration.includeTags !== undefined ? configuration.includeTags : (integration.config.includeTags || []),
            excludeTags: configuration.excludeTags !== undefined ? configuration.excludeTags : (integration.config.excludeTags || []),
            defaultAction: configuration.defaultAction !== undefined ? configuration.defaultAction : integration.config.defaultAction,
            protocolRules: configuration.protocolRules !== undefined ? configuration.protocolRules : (integration.config.protocolRules || []),
            folderId: configuration.folderId !== undefined ? configuration.folderId : integration.config.folderId,
            ownerAccountId: integration.config.ownerAccountId || (integration.organizationId ? null : accountId),
        }
        : {
            ...integration.config,
            ip: configuration.ip !== undefined ? configuration.ip : integration.config.ip,
            port: configuration.port !== undefined ? configuration.port : integration.config.port,
            username: configuration.username !== undefined ? configuration.username : integration.config.username,
            folderId: configuration.folderId !== undefined ? configuration.folderId : integration.config.folderId,
            ownerAccountId: integration.config.ownerAccountId || (integration.organizationId ? null : accountId),
        };

    delete configuration.organizationId;
    delete configuration.ip;
    delete configuration.port;
    delete configuration.username;
    delete configuration.folderId;
    delete configuration.apiUrl;
    delete configuration.verifyTls;
    delete configuration.syncIntervalMinutes;
    delete configuration.includeDeviceRoles;
    delete configuration.excludeDeviceRoles;
    delete configuration.includeVmRoles;
    delete configuration.excludeVmRoles;
    delete configuration.includeTags;
    delete configuration.excludeTags;
    delete configuration.defaultAction;
    delete configuration.protocolRules;

    await Integration.update({
        ...configuration,
        config: integrationConfig,
        status: configuration.online !== undefined ? (configuration.online ? 'online' : 'offline') : integration.status,
    }, { where: { id: integrationId } });

    logger.info(`Integration updated`, { integrationId, name: integration.name });

    let syncResult = null;
    try {
        syncResult = await this.syncIntegration(accountId, integrationId);
    } catch (error) {
        logger.error("Error during integration sync on update", { integrationId, error: error.message });
        syncResult = { code: 500, success: false, message: error.message };
    }

    return { success: true, sync: syncResult };
};

module.exports.getIntegrationCredentials = async (integrationId) => {
    const credential = await Credential.findOne({ where: { integrationId, type: 'password' } });
    return {
        password: credential ? credential.secret : null
    };
};

module.exports.getIntegrationUnsafe = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration);

    if (!accessCheck.valid) return accessCheck.error;

    const passwordCredential = await Credential.findOne({ where: { integrationId, type: "password" } });
    const netboxTokenCredential = await Credential.findOne({ where: { integrationId, type: "api-token" } });
    const payload = asPlainObject(integration);

    return {
        ...payload,
        ip: payload.config?.ip,
        port: payload.config?.port,
        username: payload.config?.username,
        apiUrl: payload.config?.apiUrl,
        verifyTls: payload.config?.verifyTls !== false,
        syncIntervalMinutes: payload.config?.syncIntervalMinutes || 15,
        includeDeviceRoles: payload.config?.includeDeviceRoles || [],
        excludeDeviceRoles: payload.config?.excludeDeviceRoles || [],
        includeVmRoles: payload.config?.includeVmRoles || [],
        excludeVmRoles: payload.config?.excludeVmRoles || [],
        includeTags: payload.config?.includeTags || [],
        excludeTags: payload.config?.excludeTags || [],
        defaultAction: payload.config?.defaultAction || { protocol: "ssh", port: 22, renderer: "terminal" },
        protocolRules: payload.config?.protocolRules || [],
        folderId: payload.config?.folderId || null,
        password: passwordCredential ? passwordCredential.secret : null,
        apiToken: netboxTokenCredential ? netboxTokenCredential.secret : null,
        online: payload.status === "online",
    };
};

module.exports.getIntegration = async (accountId, integrationId) => {
    const integration = await this.getIntegrationUnsafe(accountId, integrationId);
    if (integration.code) return integration;

    return { ...integration, password: undefined, apiToken: undefined };
};

module.exports.listIntegrations = async (accountId) => {
    const organizationIds = await getActiveOrgIds(accountId);

    const integrations = await Integration.findAll({
        where: {
            [Op.or]: [
                { organizationId: null },
                { organizationId: { [Op.in]: organizationIds } },
            ],
        },
        order: [["updatedAt", "DESC"]],
    });

    const visible = await Promise.all(integrations.map(async (integration) =>
        integration.organizationId || await ownsPersonalIntegration(accountId, integration) ? integration : null));

    return visible.filter(Boolean).map((integration) => ({
        ...asPlainObject(integration),
        config: undefined,
    }));
};

const runNetboxSync = async (accountId, integration, options) => {
    const credential = await Credential.findOne({ where: { integrationId: integration.id, type: "api-token" } });
    if (!credential) return { code: 400, message: "Integration credentials not found" };
    if (!credential.secret) return { code: 500, success: false, message: CREDENTIAL_DECRYPT_ERROR };

    const integrationPayload = asPlainObject(integration);
    const ownerAccountId = integrationPayload.config?.ownerAccountId || accountId;
    try {
        return await syncNetboxIntegration({ ...integrationPayload, config: { ...integrationPayload.config, apiToken: credential.secret } },
            ownerAccountId, options);
    } catch (error) {
        if (!options.dryRun) await Integration.update({ status: "offline", lastSyncAt: new Date(), lastSyncStatus: "error",
            lastSyncMessage: `NetBox sync failed: ${error.message}` }, { where: { id: integration.id } });
        return { code: 502, message: `NetBox sync failed: ${error.message}` };
    }
};

module.exports.previewIntegration = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration);
    if (!accessCheck.valid) return accessCheck.error;
    if (integration.type !== "netbox") return { code: 400, message: "Only NetBox syncs can be previewed" };
    return runNetboxSync(accountId, integration, { dryRun: true });
};

module.exports.syncIntegration = async (accountId, integrationId, { allowRemovals = false } = {}) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration);

    if (!accessCheck.valid) return accessCheck.error;

    if (integration.type === "netbox") return runNetboxSync(accountId, integration, { allowRemovals });

    if (integration.type !== "proxmox") {
        return { code: 400, message: "Unsupported integration type" };
    }

    const credential = await Credential.findOne({ where: { integrationId, type: 'password' } });
    if (!credential) {
        return { code: 400, message: 'Integration credentials not found' };
    }
    if (!credential.secret) {
        return { code: 500, success: false, message: CREDENTIAL_DECRYPT_ERROR };
    }

    const serverConfig = {
        ip: integration.config.ip,
        port: integration.config.port,
        username: integration.config.username,
        password: credential.secret,
    };

    try {
        logger.info(`Starting integration sync`, { integrationId, name: integration.name });
        const { resources } = await getAllResources(serverConfig);

        const existingFolders = await Folder.findAll({
            where: { integrationId: integration.id }
        });

        // node folders share one parent, keep it across the rebuild
        const parentFolderId = existingFolders[0]?.parentId ?? null;

        await Folder.destroy({ where: { integrationId: integration.id } });
        await Entry.destroy({ where: { integrationId: integration.id } });

        let syncedNodes = 0;
        let totalResources = 0;

        for (const nodeData of resources) {
            const nodeName = nodeData.node;

            const folder = await Folder.create({
                organizationId: integration.organizationId || null,
                accountId: integration.organizationId ? null : accountId,
                parentId: parentFolderId,
                integrationId: integration.id,
                name: `${integration.name} - ${nodeName}`,
                position: 0,
                type: 'pve-node',
            });

            syncedNodes++;

            for (const resource of nodeData.resources) {
                let renderer = 'terminal';
                let icon = 'terminal';

                if (resource.type === 'pve-qemu') {
                    renderer = 'guac';
                    icon = 'server';
                } else if (resource.type === 'pve-lxc') {
                    renderer = 'terminal';
                    icon = 'linux';
                } else if (resource.type === 'pve-shell') {
                    renderer = 'terminal';
                    icon = 'terminal';
                }

                const resourceConfig = {
                    nodeName: nodeName,
                    vmid: resource.id,
                };

                await Entry.create({
                    accountId: integration.organizationId ? null : accountId,
                    organizationId: integration.organizationId || null,
                    folderId: folder.id,
                    integrationId: integration.id,
                    type: resource.type,
                    renderer: renderer,
                    name: resource.name,
                    icon: icon,
                    position: 0,
                    status: resource.status || null,
                    config: resourceConfig,
                });

                totalResources++;
            }
        }

        await Integration.update(
            { lastSyncAt: new Date(), status: 'online', lastSyncStatus: "ok", lastSyncMessage: "Proxmox sync completed" },
            { where: { id: integrationId } }
        );

        logger.info(`Integration synced successfully`, { integrationId, nodes: syncedNodes, resources: totalResources });

        return {
            success: true,
            message: `Integration synced successfully: ${syncedNodes} nodes, ${totalResources} resources` 
        };
    } catch (error) {
        logger.error('Error syncing integration', { integrationId, error: error.message, stack: error.stack });

        await Integration.update(
            { status: 'offline' },
            { where: { id: integrationId } }
        );

        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        return { code: 500, success: false, message: 'Failed to sync integration: ' + errorMessage };
    }
};

module.exports.testIntegration = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration);
    if (!accessCheck.valid) return accessCheck.error;

    try {
        if (integration.type === "proxmox") {
            const credential = await Credential.findOne({ where: { integrationId, type: "password" } });
            if (!credential) return { code: 400, message: "Integration credentials not found" };
            if (!credential.secret) return { code: 500, success: false, message: CREDENTIAL_DECRYPT_ERROR };
            const { createTicket, getAllNodes } = require("./pve");
            const ticket = await createTicket({ ip: integration.config.ip, port: integration.config.port }, integration.config.username, credential.secret);
            await getAllNodes({ ip: integration.config.ip, port: integration.config.port }, ticket);
            return { success: true, message: "Proxmox connection successful" };
        }

        if (integration.type === "netbox") {
            const credential = await Credential.findOne({ where: { integrationId, type: "api-token" } });
            if (!credential) return { code: 400, message: "Integration credentials not found" };
            if (!credential.secret) return { code: 500, success: false, message: CREDENTIAL_DECRYPT_ERROR };
            const httpsAgent = new https.Agent({ rejectUnauthorized: integration.config?.verifyTls !== false });
            await testConnection({ apiUrl: integration.config?.apiUrl, apiToken: credential.secret, httpsAgent });
            return { success: true, message: "NetBox connection successful" };
        }

        return { code: 400, message: "Unsupported integration type" };
    } catch (error) {
        return { code: 500, message: error.message };
    }
};

module.exports.getIntegrationSyncStatus = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration);
    if (!accessCheck.valid) return accessCheck.error;

    return {
        success: true,
        integrationId: integration.id,
        type: integration.type,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt,
        lastSyncStatus: integration.lastSyncStatus,
        lastSyncMessage: integration.lastSyncMessage,
    };
};

module.exports.validateIntegrationAccess = validateIntegrationAccess;
