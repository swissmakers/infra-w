require('./support/isolate.cjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

const SystemSettings = require('../server/models/SystemSettings');
require('../server/models/Integration');
const { notify, getNotificationSettings, updateNotificationSettings, sendTestNotification } = require('../server/utils/notifications');
const { notifyTransitions } = require('../server/utils/statusChecker');

const received = [];
let failing = false;
const receiver = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        received.push({ headers: req.headers, body });
        res.writeHead(failing ? 500 : 204).end();
    });
});
const url = () => `http://127.0.0.1:${receiver.address().port}/hook`;

before(async () => {
    await db.sync();
    await SystemSettings.create({ id: 1, sessionIdleHours: 12, sessionMaxDays: 30 });
    await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
});
after(() => receiver.close());

test('only chosen events are sent, signed with the stored secret, which is never returned', async () => {
    const settings = await updateNotificationSettings({ webhookUrl: url(), webhookEvents: ['backup.failed'], webhookSecret: 'shh' });
    assert.deepEqual([settings.hasSecret, settings.webhookSecret], [true, undefined]);
    assert.notEqual((await SystemSettings.findByPk(1)).webhookSecretEncrypted, 'shh', 'the secret is stored encrypted');

    await notify('hosts.offline', { title: 'x', message: 'y' });
    assert.equal(received.length, 0, 'events that are not chosen are not sent');
    await notify('backup.failed', { title: 'Scheduled backup failed', message: 'NAS: timeout', details: { target: 'NAS' } });
    const [delivery] = received;
    const payload = JSON.parse(delivery.body);
    assert.deepEqual([payload.event, payload.text, payload.details.target], ['backup.failed', 'Scheduled backup failed: NAS: timeout', 'NAS']);
    assert.equal(delivery.headers['x-infra-w-signature'], `sha256=${crypto.createHmac('sha256', 'shh').update(delivery.body).digest('hex')}`);

    await updateNotificationSettings({ webhookUrl: url(), webhookEvents: ['backup.failed'] });
    assert.equal((await getNotificationSettings()).hasSecret, true, 'a missing secret keeps the stored one');
    await updateNotificationSettings({ webhookUrl: url(), webhookEvents: ['backup.failed'], webhookSecret: '' });
    assert.equal((await getNotificationSettings()).hasSecret, false);
});

test('a failing webhook never breaks the caller; the test notification reports it', async () => {
    failing = true;
    await assert.doesNotReject(notify('backup.failed', { title: 'a', message: 'b' }));
    assert.deepEqual(await sendTestNotification(), { code: 502, message: 'The webhook answered with HTTP 500' });
    failing = false;
    assert.deepEqual(await sendTestNotification(), { success: true });
    assert.equal(JSON.parse(received.at(-1).body).event, 'test');
});

test('hosts that go offline or come back are reported once per direction; unknown states and guests are not', async () => {
    received.length = 0;
    await updateNotificationSettings({ webhookUrl: url(), webhookEvents: ['hosts.offline', 'hosts.online'] });
    const entries = [
        { id: 1, type: 'server', name: 'web-01', status: 'online', config: { ip: '10.0.0.1' } },
        { id: 2, type: 'server', name: 'db-01', status: 'offline', config: { ip: '10.0.0.2' } },
        { id: 3, type: 'server', name: 'new-01', status: null, config: {} },
        { id: 4, type: 'pve-qemu', name: 'vm-1', status: 'online', config: {} },
    ];
    await notifyTransitions(entries, [{ id: 1, status: 'offline' }, { id: 2, status: 'online' }, { id: 3, status: 'offline' }, { id: 4, status: 'offline' }]);
    const events = received.map(delivery => JSON.parse(delivery.body));
    assert.deepEqual(events.map(event => [event.event, event.message]), [
        ['hosts.offline', '1 host stopped answering: web-01'],
        ['hosts.online', '1 host is reachable again: db-01'],
    ]);
    assert.deepEqual(events[0].details.hosts, [{ name: 'web-01', address: '10.0.0.1' }]);
});
