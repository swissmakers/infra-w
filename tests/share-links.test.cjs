require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = '7'.repeat(64);

require('../server/models/Integration');
const Entry = require('../server/models/Entry');
const Account = require('../server/models/Account');
const Organization = require('../server/models/Organization');
const SessionManager = require('../server/lib/SessionManager');
const { startSharing, updateSharePermissions, hibernateSession, resumeSession, deleteSession } = require('../server/controllers/serverSession');

const HOUR = 3600000;
let personal, managed, locked;

before(async () => {
    await db.sync();
    await Account.create({ id: 1, username: 'alice', firstName: 'A', lastName: 'B', password: 'x' });
    await Organization.create({ id: 1, name: 'Ops', auditSettings: { shareMaxHours: 2, allowWritableSharing: false } });
    await Organization.create({ id: 2, name: 'Vault', auditSettings: { allowSessionSharing: false } });
    const entry = (id, organizationId) => Entry.create({ id, type: 'server', name: `host-${id}`, organizationId, accountId: organizationId ? null : 1, config: { protocol: 'ssh' } });
    await entry(1, null); await entry(2, 1); await entry(3, 2);
    const session = entryId => SessionManager.create(1, entryId, { renderer: 'terminal' }, null, null, null, null).sessionId;
    [personal, managed, locked] = [session(1), session(2), session(3)];
});

test('links expire after the chosen hours and then stop working', async () => {
    const before = Date.now();
    const { shareId, expiresAt } = await startSharing(1, personal, { writable: true, hours: 8 });
    assert.ok(Math.abs(expiresAt - before - 8 * HOUR) < 1000);
    assert.equal(SessionManager.getByShareId(shareId).sessionId, personal);

    SessionManager.get(personal).shareExpiresAt = Date.now() - 1;
    assert.equal(SessionManager.getByShareId(shareId), null, 'an expired link resolves to nothing');
    assert.equal(SessionManager.get(personal).shareId, null, 'and sharing is stopped');
});

test('organizations limit the lifetime, typing and sharing itself', async () => {
    const shared = await startSharing(1, managed, { writable: false, hours: 24 });
    assert.ok(shared.expiresAt - Date.now() <= 2 * HOUR, 'capped at the organization maximum');
    assert.equal((await startSharing(1, managed, { writable: true, hours: 1 })).code, 403);
    assert.equal((await updateSharePermissions(1, managed, true)).code, 403);
    assert.equal((await startSharing(1, locked, { writable: false, hours: 1 })).code, 403);
    assert.equal((await startSharing(2, personal, { writable: false, hours: 1 })).code, 403, 'only the owner of the session can share it');
});

test('only the owner hibernates, resumes or ends a connection', async () => {
    const other = SessionManager.create(1, 1, { renderer: 'terminal' }, null, null, null, null).sessionId;
    for (const action of [id => hibernateSession(2, id), id => resumeSession(2, id), id => deleteSession(2, id)]) {
        assert.equal(action(other).code, 403);
    }
    assert.ok(SessionManager.get(other), 'the connection is untouched');
    assert.equal(hibernateSession(1, other).message, 'Session hibernated');
    assert.equal(resumeSession(1, other).message, 'Session resumed');
    assert.equal(deleteSession(1, other).message, 'Session deleted');
    assert.equal(deleteSession(1, other).code, 404);
});
