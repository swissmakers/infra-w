const { stub } = require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = 'b'.repeat(64);

let inventory = [];
const notified = [];
stub('../server/utils/netboxClient', { fetchInventory: async () => ({ devices: inventory, vms: [] }) });
stub('../server/utils/notifications', { notify: async (event, content) => notified.push({ event, ...content }) });
stub('../server/lib/StateBroadcaster', { broadcast() {} });

require('../server/models/Folder');
require('../server/models/Account');
const Organization = require('../server/models/Organization');
const Integration = require('../server/models/Integration');
const Entry = require('../server/models/Entry');
const { syncNetboxIntegration } = require('../server/utils/netboxSyncService');

const device = n => ({ kind: 'device', externalId: `device:${n}`, netboxId: n, name: `host-${n}`, primaryAddress: `10.0.0.${n}`, role: 'server', tags: [] });
const hosts = count => Array.from({ length: count }, (_, i) => device(i + 1));
let integration;
const sync = options => syncNetboxIntegration({ ...integration, config: { apiUrl: 'https://netbox.example', apiToken: 'x' } }, null, options);
const managed = () => Entry.count({ where: { integrationId: integration.id } });

before(async () => {
    await db.sync();
    await Organization.create({ id: 1, name: 'Ops' });
    integration = await Integration.findByPk((await Integration.create({ organizationId: 1, type: 'netbox', name: 'NetBox DC', config: {} })).id);
    inventory = hosts(40);
    await sync();
});

test('a sync that would remove many servers only adds and updates, and holds the removals for review', async () => {
    assert.equal(await managed(), 40);
    inventory = hosts(20);
    const result = await sync();
    assert.deepEqual([result.held, result.pendingRemovals, result.deleted], [true, 20, 0]);
    assert.equal(await managed(), 40, 'nothing was removed');
    const stored = await Integration.findByPk(integration.id);
    assert.deepEqual([stored.lastSyncStatus, stored.status], ['held', 'online']);
    assert.equal(notified.at(-1).event, 'integration.removals_held');
    assert.equal(notified.at(-1).details.removals.length, 20);

    integration = await Integration.findByPk(integration.id);
    assert.equal((await sync()).held, true);
    assert.equal(notified.length, 1, 'removals still held are not notified again');
});

test('the preview lists the changes without making them; allowRemovals applies them', async () => {
    inventory = [...hosts(20), device(99)];
    const preview = await sync({ dryRun: true });
    assert.deepEqual([preview.create, preview.update.length, preview.remove.length, preview.removalsNeedReview], [['host-99'], 20, 20, true]);
    assert.equal(await managed(), 40, 'a preview changes nothing');

    const applied = await sync({ allowRemovals: true });
    integration = await Integration.findByPk(integration.id);
    assert.deepEqual([applied.held, applied.created, applied.deleted], [false, 1, 20]);
    assert.equal(await managed(), 21);
});

test('small removals go through; an empty inventory never removes everything silently', async () => {
    inventory = inventory.slice(0, -2);
    assert.equal((await sync()).deleted, 2, 'two of 21 is below the limit');
    inventory = [];
    assert.equal((await sync()).held, true);
    assert.equal(await managed(), 19);
    assert.equal(notified.length, 2, 'held again after an applied sync, so notified again');
});
