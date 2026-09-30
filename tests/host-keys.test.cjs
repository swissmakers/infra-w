require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = '5'.repeat(64);

const HostKey = require('../server/models/HostKey');
const AuditLog = require('../server/models/AuditLog');
require('../server/models/Integration');
require('../server/models/Entry');
const { verifyHostKey, withHostKeyCheck, fingerprintOf, keyTypeOf } = require('../server/utils/hostKeys');
const { acceptHostKey, forgetHostKey, listHostKeys } = require('../server/controllers/hostKey');
const { AUDIT_ACTIONS } = require('../server/controllers/audit');
const { createRDPToken } = require('../server/utils/tokenGenerator');

const blob = (type, material) => {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(name.length);
    return Buffer.concat([length, name, Buffer.from(material)]);
};
const ed25519 = blob('ssh-ed25519', 'first key'), replaced = blob('ssh-ed25519', 'second key'), rsa = blob('ssh-rsa', 'first key');
const audits = action => AuditLog.count({ where: { action } });

before(() => db.sync());

test('fingerprints and key types follow OpenSSH notation', () => {
    assert.equal(keyTypeOf(ed25519), 'ssh-ed25519');
    assert.equal(keyTypeOf(Buffer.from([0, 0])), 'unknown');
    assert.match(fingerprintOf(ed25519), /^SHA256:[A-Za-z0-9+/]{43}$/);
});

test('the first key is trusted, a changed key is refused until an administrator accepts it', async () => {
    const host = { host: 'Edge-01.example.com', port: 22, accountId: 1 };
    assert.deepEqual(await verifyHostKey({ ...host, key: ed25519 }), { ok: true });
    assert.equal(await audits(AUDIT_ACTIONS.HOST_KEY_TRUST), 1);
    assert.deepEqual(await verifyHostKey({ ...host, key: ed25519 }), { ok: true });

    const refused = await verifyHostKey({ ...host, key: replaced });
    assert.equal(refused.ok, false);
    assert.match(refused.message, /edge-01\.example\.com:22 has changed/);
    await verifyHostKey({ ...host, key: replaced });
    assert.equal(await audits(AUDIT_ACTIONS.HOST_KEY_MISMATCH), 1, 'a repeated attempt with the same key is audited once');
    assert.equal((await verifyHostKey({ ...host, key: rsa })).ok, false, 'another key type is a change too');

    const [known] = await listHostKeys();
    assert.equal(known.pendingKeyType, 'ssh-rsa');
    assert.equal((await acceptHostKey(known.id)).fingerprint, fingerprintOf(rsa));
    assert.deepEqual(await verifyHostKey({ ...host, key: rsa }), { ok: true });
    assert.equal((await verifyHostKey({ ...host, key: ed25519 })).ok, false);
    assert.equal((await acceptHostKey(999)).code, 404);

    await forgetHostKey(known.id);
    assert.deepEqual(await verifyHostKey({ ...host, key: replaced }), { ok: true }, 'a forgotten host is trusted anew');
    assert.equal(await HostKey.count(), 1);
});

test('the SSH option hook reports why a host was refused', async () => {
    const options = { host: 'db-01', port: 2222 };
    const explain = withHostKeyCheck(options, 1);
    const verdict = key => new Promise(resolve => options.hostVerifier(key, resolve));
    assert.equal(await verdict(ed25519), true);
    assert.equal(await verdict(replaced), false);
    assert.match(explain(new Error('Host denied (verification failed)')).message, /db-01:2222 has changed/);
});

test('RDP certificates are verified only when a fingerprint is pinned', () => {
    const open = createRDPToken('10.0.0.5', 3389, 'admin', 'x', {}).connection.settings;
    assert.equal(open['ignore-cert'], true);
    assert.equal(open['cert-fingerprints'], undefined);
    const pinned = createRDPToken('10.0.0.5', 3389, 'admin', 'x', { certFingerprints: 'A1B2C3D4E5F60718293A4B5C6D7E8F9012345678' }).connection.settings;
    assert.equal(pinned['ignore-cert'], undefined);
    assert.equal(pinned['cert-fingerprints'], 'sha1:a1:b2:c3:d4:e5:f6:07:18:29:3a:4b:5c:6d:7e:8f:90:12:34:56:78');
});
