require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const { hash } = require('bcrypt');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = '3'.repeat(64);

const Account = require('../server/models/Account');
const Session = require('../server/models/Session');
const SystemSettings = require('../server/models/SystemSettings');
const { resolveSession, sweepExpiredSessions } = require('../server/utils/sessionAuth');
const { updateSystemSettings } = require('../server/controllers/systemSettings');
const { changeOwnPassword, updatePassword } = require('../server/controllers/account');
const { createSession } = require('../server/controllers/session');
const { passwordChangeValidation, registerValidation } = require('../server/validations/account');

const HOUR = 3600 * 1000;
const ago = hours => new Date(Date.now() - hours * HOUR);

before(async () => {
    await db.sync();
    await SystemSettings.create({ id: 1, sessionIdleHours: 12, sessionMaxDays: 30 });
    await Account.create({ id: 1, username: 'alice', firstName: 'Alice', lastName: 'Admin', role: 'admin', password: await hash('correct horse battery', 4) });
    await Account.create({ id: 2, username: 'ldapuser', firstName: 'L', lastName: 'User', password: 'x', authProviderType: 'ldap' });
});

const newSession = (accountId, lastActivity = new Date(), createdAt = new Date()) =>
    Session.create({ accountId, ip: '10.0.0.1', userAgent: 'test', lastActivity, createdAt });

test('sessions expire after the idle time and after the maximum age', async () => {
    const active = await newSession(1);
    const idle = await newSession(1, ago(13));
    const old = await newSession(1, new Date(), ago(31 * 24));
    assert.equal((await resolveSession(active.token)).account.id, 1);
    assert.equal(await resolveSession(idle.token), null);
    assert.equal(await resolveSession(old.token), null);
    assert.equal(await Session.findByPk(idle.id), null, 'expired sessions are removed');
    assert.equal(await resolveSession('unknown'), null);
});

test('the sweep removes expired sessions and follows changed limits', async () => {
    await Session.destroy({ where: {} });
    const keep = await newSession(1, ago(2));
    await newSession(1, ago(20));
    assert.equal(await sweepExpiredSessions(), 1);
    await updateSystemSettings({ sessionIdleHours: 1 });
    assert.equal(await sweepExpiredSessions(), 1);
    assert.equal(await Session.findByPk(keep.id), null);
    await updateSystemSettings({ sessionIdleHours: 12 });
});

test('changing the own password needs the current one and signs out the other devices', async () => {
    await Session.destroy({ where: {} });
    const current = await newSession(1);
    const other = await newSession(1);
    const account = await Account.findByPk(1);
    assert.equal((await changeOwnPassword(account, current.id, 'wrong password', 'a new long password')).code, 403);
    assert.equal(await changeOwnPassword(account, current.id, 'correct horse battery', 'a new long password'), undefined);
    assert.ok(await Session.findByPk(current.id));
    assert.equal(await Session.findByPk(other.id), null);
    assert.equal((await changeOwnPassword(await Account.findByPk(2), null, 'x', 'a new long password')).code, 400);
    assert.equal((await updatePassword(2, 'a new long password')).code, 400);
});

test('passwords need at least 12 characters', () => {
    assert.ok(passwordChangeValidation.validate({ currentPassword: 'x', password: 'short' }).error);
    assert.equal(passwordChangeValidation.validate({ currentPassword: 'x', password: 'twelve chars' }).error, undefined);
    assert.ok(registerValidation.validate({ username: 'bob', password: 'elevenchars', firstName: 'Bo', lastName: 'By' }).error);
});

test('"Login as" sessions record the administrator and cannot target the own account', async () => {
    assert.equal((await createSession(1, 1, '10.0.0.9', 'test')).code, 400);
    const { token } = await createSession(2, 1, '10.0.0.9', 'test');
    const session = await Session.findOne({ where: { token } });
    assert.equal(session.impersonatorId, 1);
    assert.equal(session.ip, '10.0.0.9');
});
