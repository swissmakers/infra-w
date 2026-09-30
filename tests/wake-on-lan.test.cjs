require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = 'd'.repeat(64);

const sent = [];
const id = require.resolve('../server/utils/wol');
require.cache[id] = { id, filename: id, loaded: true, exports: { sendWakeOnLan: async (mac, options) => sent.push({ mac, ...options }) } };

require('../server/models/Integration');
const Account = require('../server/models/Account');
const Entry = require('../server/models/Entry');
const { wakeEntry } = require('../server/controllers/entry');
const { createServerValidation } = require('../server/validations/server');

before(async () => {
    await db.sync();
    await Account.create({ id: 1, username: 'op', firstName: 'O', lastName: 'P', password: 'x' });
    const config = { protocol: 'ssh', ip: '10.0.5.20', wakeOnLanEnabled: true, macAddress: 'AA:BB:CC:DD:EE:FF' };
    await Entry.create({ id: 1, type: 'server', name: 'lab-a', accountId: 1, config });
    await Entry.create({ id: 2, type: 'server', name: 'lab-b', accountId: 1, config: { ...config, wakeOnLanBroadcast: '10.0.5.255' } });
});

test('Wake-on-LAN uses the server\'s broadcast address, else the local broadcast', async () => {
    assert.deepEqual(await wakeEntry(1, 1), { success: true });
    assert.deepEqual(await wakeEntry(1, 2), { success: true });
    assert.deepEqual(sent, [{ mac: 'AA:BB:CC:DD:EE:FF', broadcast: undefined }, { mac: 'AA:BB:CC:DD:EE:FF', broadcast: '10.0.5.255' }]);
    assert.ok(createServerValidation.validate({ name: 'x', config: { wakeOnLanBroadcast: '10.0.5.0/24' } }).error, 'only a single IPv4 address');
});
