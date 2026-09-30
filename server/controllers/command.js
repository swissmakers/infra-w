const { Op } = require("sequelize");
const stateBroadcaster = require("../lib/StateBroadcaster");
const { getActiveOrgIds } = require("../utils/permission");

module.exports.createCommandController = (Model, stateType, noun) => {
    const scopeOf = (accountId, organizationId) => (organizationId ? { organizationId } : { accountId, organizationId: null });
    const notFound = { code: 404, message: `${noun} does not exist` };
    const find = (id, accountId, organizationId) => Model.findOne({ where: { id, ...scopeOf(accountId, organizationId) } });
    const broadcast = (accountId, organizationId) => stateBroadcaster.broadcast(stateType, { accountId, organizationId });

    const create = async (accountId, configuration) => {
        const organizationId = configuration.organizationId || null;
        const maxSortOrder = await Model.max("sortOrder", { where: scopeOf(accountId, organizationId) }) || 0;
        const item = await Model.create({ ...configuration, organizationId, accountId: organizationId ? null : accountId, sortOrder: maxSortOrder + 1 });
        broadcast(accountId, organizationId);
        return item;
    };

    const remove = async (accountId, id, organizationId = null) => {
        const item = await find(id, accountId, organizationId);
        if (!item) return notFound;
        await Model.destroy({ where: { id } });
        broadcast(accountId, item.organizationId);
    };

    const edit = async (accountId, id, configuration, organizationId = null) => {
        const item = await find(id, accountId, organizationId);
        if (!item) return notFound;
        const { organizationId: _, accountId: __, ...changes } = configuration;
        await Model.update(changes, { where: { id } });
        broadcast(accountId, item.organizationId);
    };

    const reposition = async (accountId, id, { targetId }, organizationId = null) => {
        if (!targetId || Number(id) === Number(targetId)) return { success: true };
        const item = await find(id, accountId, organizationId);
        if (!item) return notFound;

        const all = await Model.findAll({ where: scopeOf(accountId, organizationId), order: [["sortOrder", "ASC"], ["id", "ASC"]] });
        const from = all.findIndex(entry => entry.id === Number(id));
        const to = all.findIndex(entry => entry.id === Number(targetId));
        if (from === -1 || to === -1) return notFound;

        all.splice(to, 0, all.splice(from, 1)[0]);
        await Promise.all(all.map((entry, index) => Model.update({ sortOrder: index + 1 }, { where: { id: entry.id } })));
        broadcast(accountId, item.organizationId);
        return { success: true };
    };

    const get = async (accountId, id, organizationId = null) => (await find(id, accountId, organizationId)) || notFound;

    const accessibleWhere = async accountId => ({
        [Op.or]: [{ accountId, organizationId: null }, { organizationId: { [Op.in]: await getActiveOrgIds(accountId) } }],
    });

    const listAccessible = async accountId => Model.findAll({ where: await accessibleWhere(accountId), order: [["sortOrder", "ASC"]] });

    const findAccessible = async (accountId, id) => Model.findOne({ where: { id, ...(await accessibleWhere(accountId)) } });

    return { create, remove, edit, reposition, get, listAccessible, findAccessible };
};
