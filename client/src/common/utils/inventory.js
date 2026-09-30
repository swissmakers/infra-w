export const isInventoryGroup = entry => entry.type === "folder" || entry.type === "organization";

export const flattenEntries = (entries = [], path = []) => (entries || []).flatMap(entry =>
    isInventoryGroup(entry)
        ? flattenEntries(entry.entries, [...path, entry])
        : [{ ...entry, _path: path }]
);

export const findOrganizationForServer = (serverId, entries = [], currentOrg = null) => {
    for (const entry of entries || []) {
        if (!isInventoryGroup(entry) && entry.id === Number(serverId)) return currentOrg;
        if (isInventoryGroup(entry)) {
            const found = findOrganizationForServer(serverId, entry.entries,
                entry.type === "organization" ? entry : currentOrg);
            if (found) return found;
        }
    }
    return null;
};

export const parseOrganizationId = value => {
    const id = Number(String(value ?? "").replace(/^org-/, ""));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const getOrganizationId = organization => parseOrganizationId(organization?.id);

export const findEntry = (entries, id) => {
    for (const entry of entries || []) {
        const found = isInventoryGroup(entry) ? findEntry(entry.entries, id) : entry.id === Number(id) && entry;
        if (found) return found;
    }
    return null;
};

const searchableText = (entry, path) => [
    entry.name, entry.ip, entry.config?.ip, entry.protocol, entry.config?.protocol, entry.osName,
    ...(entry.tags || []).map(tag => tag.name), ...path.map(group => group.name),
].filter(Boolean).join(" ").toLowerCase();

export const filterInventory = (entries = [], query = "", tagIds = []) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const visit = (list, path) => (list || []).flatMap(entry => {
        if (isInventoryGroup(entry)) {
            const children = visit(entry.entries, [...path, entry]);
            return children.length ? [{ ...entry, entries: children }] : [];
        }
        const text = searchableText(entry, path);
        const matchesTags = !tagIds.length || entry.tags?.some(tag => tagIds.includes(tag.id));
        return matchesTags && terms.every(term => text.includes(term)) ? [entry] : [];
    });
    return visit(entries, []);
};
