const { stub } = require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const integrations = [
    { id: 1, name: 'Lab', type: 'proxmox', organizationId: null, config: { ownerAccountId: 7 } },
    { id: 2, name: 'Legacy', type: 'proxmox', organizationId: null, config: {} },
    { id: 3, name: 'Shared', type: 'netbox', organizationId: 5, config: {} },
];
const folders = [{ id: 20, integrationId: 2, accountId: 8, name: 'Legacy - pve1' }, { id: 21, integrationId: null, accountId: 9, name: 'Lab' }];
const destroyed = [];
const matches = where => folder => Object.entries(where).every(([key, value]) => folder[key] === value);
stub('../server/models/Integration', {
    findByPk: async id => integrations.find(integration => integration.id === id) || null,
    findAll: async ({ where }) => {
        const organizationIds = where[Op.or][1].organizationId[Op.in];
        return integrations.filter(integration => !integration.organizationId || organizationIds.includes(integration.organizationId));
    },
    destroy: async ({ where }) => destroyed.push(['integration', where]),
});
stub('../server/models/Folder', {
    findOne: async ({ where }) => folders.find(matches(where)) || null,
    destroy: async ({ where }) => destroyed.push(['folder', where]),
});
stub('../server/utils/permission', {
    hasOrganizationAccess: async (accountId, organizationId) => accountId === 9 && organizationId === 5,
    getActiveOrgIds: async accountId => accountId === 9 ? [5] : [],
});
stub('../server/models/Entry', { destroy: async ({ where }) => destroyed.push(['entry', where]) });
for (const path of ['../server/models/Credential', '../server/controllers/pve', '../server/utils/netboxClient', '../server/utils/netboxSyncService']) stub(path, {});

const { validateIntegrationAccess, deleteIntegration, listIntegrations } = require('../server/controllers/integration');
const allowed = async (accountId, id) => (await validateIntegrationAccess(accountId, integrations.find(i => i.id === id))).valid;

test('personal integrations are only accessible to their owner', async () => {
    assert.equal(await allowed(7, 1), true);
    assert.equal(await allowed(8, 1), false);
    assert.equal(await allowed(9, 1), false);
    assert.equal(await allowed(8, 2), true);
    assert.equal(await allowed(7, 2), false);
});

test('organization integrations are accessible to active members only', async () => {
    assert.equal(await allowed(9, 3), true);
    assert.equal(await allowed(7, 3), false);
});

test('the list shows an account its own and its organizations\' integrations', async () => {
    assert.deepEqual((await listIntegrations(7)).map(i => i.id), [1]);
    assert.deepEqual((await listIntegrations(8)).map(i => i.id), [2]);
    assert.deepEqual((await listIntegrations(9)).map(i => i.id), [3]);
    assert.equal((await listIntegrations(7))[0].config, undefined);
});

test('deleting removes only the integration\'s own entries and folders, never a folder with the same name', async () => {
    assert.equal((await deleteIntegration(8, 1)).code, 403);
    assert.deepEqual(destroyed, []);
    assert.deepEqual(await deleteIntegration(7, 1), { success: true });
    assert.deepEqual(destroyed, [['entry', { integrationId: 1 }], ['folder', { integrationId: 1 }], ['integration', { id: 1 }]]);
});
