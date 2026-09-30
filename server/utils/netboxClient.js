const axios = require("axios");

const trimTrailingSlash = (value = "") => String(value).replace(/\/+$/, "");

const parseAddress = (raw = "") => {
    if (!raw) return null;
    const value = String(raw);
    return value.includes("/") ? value.split("/")[0] : value;
};

const normalizeTags = (tags) => {
    if (!Array.isArray(tags)) return [];
    return tags.map((tag) => {
        if (!tag) return "";
        if (typeof tag === "string") return tag;
        return tag.slug || tag.name || "";
    }).filter(Boolean);
};

const createClient = (config) => {
    const baseURL = trimTrailingSlash(config.apiUrl);
    return axios.create({
        baseURL,
        timeout: 15000,
        // a redirect would carry the API token to another URL
        maxRedirects: 0,
        headers: {
            Authorization: `Token ${config.apiToken}`,
            Accept: "application/json",
        },
        httpsAgent: config.httpsAgent,
    });
};

const fetchPaginated = async (client, path) => {
    const base = new URL(`${trimTrailingSlash(client.defaults.baseURL)}/`);
    let current = new URL(path.replace(/^\/+/, ""), base);
    let next = current.href;
    const results = [];
    const visited = new Set();

    while (next) {
        const url = new URL(next, current);
        if (url.origin !== base.origin || url.username || url.password) {
            throw new Error("NetBox pagination must stay on the configured origin");
        }
        if (visited.has(url.href) || visited.size >= 10000) {
            throw new Error("NetBox pagination is cyclic or exceeds the page limit");
        }
        visited.add(url.href);
        current = url;
        const response = await client.get(url.href);
        const payload = response.data;
        if (!payload || !Array.isArray(payload.results) ||
            (payload.next != null && typeof payload.next !== "string")) {
            throw new Error("NetBox returned an invalid inventory page; sync aborted");
        }
        results.push(...payload.results);
        next = payload.next;
    }

    return results;
};

const mapDevice = (device) => ({
    kind: "device",
    externalId: `device:${device.id}`,
    netboxId: device.id,
    name: device.display || device.name || `device-${device.id}`,
    role: device?.role?.slug || device?.role?.name || "",
    platform: device?.platform?.slug || device?.platform?.name || "",
    type: device?.device_type?.slug || device?.device_type?.model || "",
    status: device?.status?.value || device?.status?.label || "",
    tags: normalizeTags(device?.tags),
    customFields: device?.custom_fields || {},
    primaryAddress: parseAddress(device?.primary_ip4?.address || device?.primary_ip?.address || device?.primary_ip6?.address || ""),
});

const mapVm = (vm) => ({
    kind: "vm",
    externalId: `vm:${vm.id}`,
    netboxId: vm.id,
    name: vm.display || vm.name || `vm-${vm.id}`,
    role: vm?.role?.slug || vm?.role?.name || "",
    platform: vm?.platform?.slug || vm?.platform?.name || "",
    type: "virtual-machine",
    status: vm?.status?.value || vm?.status?.label || "",
    tags: normalizeTags(vm?.tags),
    customFields: vm?.custom_fields || {},
    primaryAddress: parseAddress(vm?.primary_ip4?.address || vm?.primary_ip?.address || vm?.primary_ip6?.address || ""),
});

const fetchInventory = async ({ apiUrl, apiToken, httpsAgent }) => {
    const client = createClient({ apiUrl, apiToken, httpsAgent });
    const [devices, vms] = await Promise.all([
        fetchPaginated(client, "/api/dcim/devices/?limit=200"),
        fetchPaginated(client, "/api/virtualization/virtual-machines/?limit=200"),
    ]);

    return {
        devices: devices.map(mapDevice),
        vms: vms.map(mapVm),
    };
};

const testConnection = async ({ apiUrl, apiToken, httpsAgent }) => {
    const client = createClient({ apiUrl, apiToken, httpsAgent });
    const response = await client.get("/api/status/");
    return response.status >= 200 && response.status < 300;
};

module.exports = {
    fetchInventory,
    testConnection,
    fetchPaginated,
};
