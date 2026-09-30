const https = require("https");
const { Op } = require("sequelize");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const logger = require("./logger");
const { notify } = require("./notifications");
const { fetchInventory } = require("./netboxClient");
const { resolveProtocolAction: resolveAction } = require("./netboxProtocol");
const stateBroadcaster = require("../lib/StateBroadcaster");

const normalize = (value) => String(value || "").trim().toLowerCase();

const normalizeList = (values) => (Array.isArray(values) ? values.map(normalize).filter(Boolean) : []);

const containsAny = (haystack, needles) => {
    if (!needles.length) return true;
    const set = new Set(normalizeList(haystack));
    return needles.some((needle) => set.has(needle));
};

const getHttpsAgent = (verifyTls) => new https.Agent({
    rejectUnauthorized: verifyTls !== false,
});

const matchesFilters = (item, config = {}) => {
    const itemTags = normalizeList(item.tags);
    const role = normalize(item.role);

    const includeDeviceRoles = normalizeList(config.includeDeviceRoles);
    const excludeDeviceRoles = normalizeList(config.excludeDeviceRoles);
    const includeVmRoles = normalizeList(config.includeVmRoles);
    const excludeVmRoles = normalizeList(config.excludeVmRoles);
    const includeTags = normalizeList(config.includeTags);
    const excludeTags = normalizeList(config.excludeTags);

    if (item.kind === "device") {
        if (includeDeviceRoles.length > 0 && !includeDeviceRoles.includes(role)) return false;
        if (excludeDeviceRoles.length > 0 && excludeDeviceRoles.includes(role)) return false;
    }

    if (item.kind === "vm") {
        if (includeVmRoles.length > 0 && !includeVmRoles.includes(role)) return false;
        if (excludeVmRoles.length > 0 && excludeVmRoles.includes(role)) return false;
    }

    if (includeTags.length > 0 && !containsAny(itemTags, includeTags)) return false;
    if (excludeTags.length > 0 && containsAny(itemTags, excludeTags)) return false;

    return true;
};

const isRuleMatch = (rule = {}, item) => {
    if (rule.enabled === false) return false;
    if ((rule.targetType || "any") !== "any" && rule.targetType !== item.kind) return false;

    if (!containsAny(item.tags, normalizeList(rule.tagsAny))) return false;

    if (item.kind === "device" && !containsAny([item.role], normalizeList(rule.deviceRolesAny))) return false;
    if (item.kind === "vm" && !containsAny([item.role], normalizeList(rule.vmRolesAny))) return false;

    if (!containsAny([item.platform], normalizeList(rule.platformsAny))) return false;

    if (rule.nameIncludes && !normalize(item.name).includes(normalize(rule.nameIncludes))) return false;

    if (rule.customFieldKey && rule.customFieldValue) {
        const current = normalize(item.customFields?.[rule.customFieldKey]);
        if (current !== normalize(rule.customFieldValue)) return false;
    }

    return true;
};

const resolveProtocolAction = (item, config = {}) => {
    const rules = Array.isArray(config.protocolRules) ? config.protocolRules : [];
    const matchedRule = rules.find((rule) => isRuleMatch(rule, item));
    return {
        ...resolveAction(config.defaultAction, matchedRule?.action),
        matchedRuleId: matchedRule?.id || null,
    };
};

const getIcon = (item, protocol) => {
    if (protocol === "rdp") return "windows";
    if (item.kind === "vm") return "server";
    return "linux";
};

const buildEntryConfig = (item, action, integrationId) => ({
    ip: item.primaryAddress || "",
    port: action.port,
    protocol: action.protocol,
    netbox: {
        managedBy: "netbox",
        integrationId,
        objectType: item.kind,
        objectId: item.netboxId,
        role: item.role || "",
        platform: item.platform || "",
        tags: item.tags || [],
        externalId: item.externalId,
        matchedRuleId: action.matchedRuleId,
        lastSeenAt: new Date().toISOString(),
        syncDisabled: false,
        disabledReason: null,
    },
});

const markIntegrationStatus = async (integrationId, status, message) => {
    await Integration.update({
        status: status === "error" ? "offline" : "online",
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncMessage: message,
    }, { where: { id: integrationId } });
};

// a bad filter must not wipe the managed servers, so large removals wait for review
const REMOVAL_LIMIT = 5;
const REMOVAL_SHARE = 0.1;
const needsReview = (removals, managed) => removals > 0 && (removals === managed || (removals > REMOVAL_LIMIT && removals > managed * REMOVAL_SHARE));

const syncNetboxIntegration = async (integration, accountId, { dryRun = false, allowRemovals = false } = {}) => {
    const config = integration.config || {};
    const httpsAgent = getHttpsAgent(config.verifyTls);

    const inventory = await fetchInventory({
        apiUrl: config.apiUrl,
        apiToken: config.apiToken,
        httpsAgent,
    });

    const allItems = [...inventory.devices, ...inventory.vms];
    const items = allItems.filter((item) => matchesFilters(item, config));

    const existing = await Entry.findAll({
        where: {
            integrationId: integration.id,
            managedBy: "netbox",
            externalId: { [Op.ne]: null },
        },
    });

    const existingByExternalId = new Map(existing.map((entry) => [entry.externalId, entry]));
    const matchedIds = new Set(items.map(item => item.externalId));
    const toDelete = existing.filter((entry) => !matchedIds.has(entry.externalId));
    const held = !allowRemovals && needsReview(toDelete.length, existing.length);

    if (dryRun) {
        return {
            create: items.filter(item => !existingByExternalId.has(item.externalId)).map(item => item.name),
            update: items.filter(item => existingByExternalId.has(item.externalId)).map(item => item.name),
            remove: toDelete.map(entry => entry.name),
            removalsNeedReview: needsReview(toDelete.length, existing.length),
        };
    }

    let created = 0;
    let updated = 0;
    let deleted = 0;

    for (const item of items) {
        const action = resolveProtocolAction(item, config);
        const existingEntry = existingByExternalId.get(item.externalId);
        const entryConfig = buildEntryConfig(item, action, integration.id);
        const payload = {
            name: item.name,
            type: "server",
            renderer: action.renderer,
            icon: getIcon(item, action.protocol),
            accountId: integration.organizationId ? null : accountId,
            organizationId: integration.organizationId || null,
            folderId: config.folderId || null,
            integrationId: integration.id,
            managedBy: "netbox",
            externalId: item.externalId,
            isManagedDisabled: false,
            config: entryConfig,
        };

        if (existingEntry) {
            await Entry.update(payload, { where: { id: existingEntry.id } });
            updated++;
        } else {
            await Entry.create(payload);
            created++;
        }
    }

    if (!held) {
        for (const entry of toDelete) {
            await Entry.destroy({ where: { id: entry.id } });
            deleted++;
        }
    }

    const summary = held
        ? `NetBox sync held back ${toDelete.length} of ${existing.length} removals for review; created ${created}, updated ${updated}.`
        : `NetBox sync complete: created ${created}, updated ${updated}, deleted ${deleted}.`;
    await markIntegrationStatus(integration.id, held ? "held" : "ok", summary);
    logger.info(summary, { integrationId: integration.id, total: items.length });
    if (held && integration.lastSyncStatus !== "held") {
        await notify("integration.removals_held", { title: "Integration removals held for review", message: `${integration.name}: ${summary}`,
            details: { integration: integration.name, removals: toDelete.map(entry => entry.name) } });
    }

    stateBroadcaster.broadcast("ENTRIES", {
        accountId: integration.organizationId ? undefined : accountId,
        organizationId: integration.organizationId || undefined,
    });

    return {
        success: true,
        held,
        pendingRemovals: held ? toDelete.length : 0,
        created,
        updated,
        deleted,
        totalMatched: items.length,
        totalFetched: allItems.length,
        message: summary,
    };
};

module.exports = {
    syncNetboxIntegration,
};
