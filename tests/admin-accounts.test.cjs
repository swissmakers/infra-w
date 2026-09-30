require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const { hash } = require('bcrypt');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = '4'.repeat(64);

const Account = require('../server/models/Account');
const Session = require('../server/models/Session');
const Passkey = require('../server/models/Passkey');
const AuditLog = require('../server/models/AuditLog');
const Organization = require('../server/models/Organization');
const OIDCProvider = require('../server/models/OIDCProvider');
const SystemSettings = require('../server/models/SystemSettings');
require('../server/models/LDAPProvider');
require('../server/models/Integration');
const [Folder, Entry, Identity, Credential, Tag, EntryTag, EntryIdentity, Snippet, Keymap] =
    ['Folder', 'Entry', 'Identity', 'Credential', 'Tag', 'EntryTag', 'EntryIdentity', 'Snippet', 'Keymap'].map(name => require(`../server/models/${name}`));
const { resolveSession } = require('../server/utils/sessionAuth');
const { updateSystemSettings } = require('../server/controllers/systemSettings');
const { setLocked, resetSecondFactor, listUsers, deleteAccount } = require('../server/controllers/account');
const { createSession, listAllSessions, revokeAnySession } = require('../server/controllers/session');
const { login } = require('../server/controllers/auth');
const { getAuditLogs, exportAuditLogs, pruneAuditLogs, AUDIT_ACTIONS } = require('../server/controllers/audit');
const { errorStatus } = require('../server/utils/error');

const DAY = 24 * 3600 * 1000;
const client = { ip: '10.0.0.5', userAgent: 'test' };
const newSession = accountId => Session.create({ accountId, ip: '10.0.0.1', userAgent: 'test' });

before(async () => {
    await db.sync();
    await SystemSettings.create({ id: 1, sessionIdleHours: 12, sessionMaxDays: 30, auditRetentionDays: null });
    await OIDCProvider.create({ name: 'Internal', issuer: 'internal', clientId: 'internal', redirectUri: 'internal', scope: 'openid', enabled: true, isInternal: true });
    await Account.create({ id: 1, username: 'alice', firstName: 'Alice', lastName: 'Admin', role: 'admin', password: await hash('correct horse battery', 4) });
    await Account.create({ id: 2, username: 'bob', firstName: 'Bob', lastName: 'User', password: await hash('bobs long password', 4) });
    await Organization.create({ id: 1, name: 'Operations' });
    await Organization.create({ id: 2, name: 'Finance' });
});

test('a locked account is signed out, refused by every check and can be unlocked again', async () => {
    const session = await newSession(2);
    assert.equal((await setLocked(1, true, 1)).code, 400, 'administrators cannot lock themselves');
    assert.deepEqual(await setLocked(2, true, 1), { username: 'bob' });
    assert.equal((await setLocked(2, true, 1)).code, 409);

    assert.equal(await Session.findByPk(session.id), null, 'locking ends the sign-ins');
    const stale = await newSession(2);
    assert.equal(await resolveSession(stale.token), null, 'a session of a locked account is not accepted');

    const refused = await login({ username: 'bob', password: 'bobs long password' }, client);
    assert.equal(refused.code, 205);
    assert.equal(errorStatus(refused.code), 403);
    assert.equal((await login({ username: 'bob', password: 'wrong' }, client)).code, 201, 'the lock is only revealed with the right password');
    const failed = await AuditLog.findOne({ where: { action: AUDIT_ACTIONS.SIGN_IN_FAILED, accountId: 2 }, order: [['id', 'DESC']] });
    assert.equal(failed.details.reason ?? JSON.parse(failed.details).reason, 'password');
    assert.equal((await AuditLog.count({ where: { action: AUDIT_ACTIONS.SIGN_IN_FAILED, accountId: 2 } })), 2);

    assert.equal((await createSession(2, 1, '10.0.0.9', 'test')).code, 409, '"Login as" is refused too');

    await setLocked(2, false, 1);
    assert.ok((await login({ username: 'bob', password: 'bobs long password' }, client)).token);
});

test('resetting the second factor removes TOTP and passkeys', async () => {
    const before = await Account.findByPk(2);
    await Account.update({ totpEnabled: true }, { where: { id: 2 } });
    const passkey = { credentialPublicKey: 'key', counter: 0, credentialDeviceType: 'multiDevice', credentialBackedUp: true, accountId: 2, name: 'Laptop' };
    await Passkey.create({ ...passkey, credentialId: 'a' });
    await Passkey.create({ ...passkey, credentialId: 'b' });

    const { passkeys, totpEnabled, disabled } = (await listUsers()).users.find(user => user.id === 2);
    assert.deepEqual({ passkeys, totpEnabled, disabled }, { passkeys: 2, totpEnabled: true, disabled: false });

    assert.deepEqual(await resetSecondFactor(2), { username: 'bob', totp: true, passkeys: 2 });
    const after = await Account.findByPk(2);
    assert.equal(Boolean(after.totpEnabled), false);
    assert.notEqual(after.totpSecret, before.totpSecret, 'the next setup gets a new secret');
    assert.equal(await Passkey.count({ where: { accountId: 2 } }), 0);
    assert.equal((await resetSecondFactor(2)).code, 409);
    assert.equal((await resetSecondFactor(99)).code, 404);
});

test('administrators see all sign-ins with their account and can end any of them', async () => {
    await Session.destroy({ where: {} });
    const own = await newSession(1);
    const { token } = await createSession(2, 1, '10.0.0.9', 'test');
    const sessions = await listAllSessions(own.id);
    assert.equal(sessions.length, 2);
    assert.equal(sessions.find(s => s.current).account.username, 'alice');
    const impersonated = sessions.find(s => !s.current);
    assert.equal(impersonated.account.username, 'bob');
    assert.equal(impersonated.impersonator.username, 'alice');
    assert.equal(impersonated.token, undefined, 'tokens are never listed');

    assert.deepEqual(await revokeAnySession(impersonated.id), { accountId: 2 });
    assert.equal(await resolveSession(token), null);
    assert.equal((await revokeAnySession(impersonated.id)).code, 404);
});

test('the audit log covers all organizations and exports safe CSV', async () => {
    await AuditLog.destroy({ where: {} });
    const entry = (organizationId, details, daysAgo = 0) => AuditLog.create({ accountId: 2, organizationId, action: AUDIT_ACTIONS.ENTRY_CREATE,
        resource: 'entry', details, timestamp: new Date(Date.now() - daysAgo * DAY) });
    await entry(1, { name: '=HYPERLINK("http://evil")' });
    await entry(2, { name: 'finance, "quoted"' });
    await entry(null, { name: 'personal' }, 200);

    assert.equal((await getAuditLogs({})).total, 3, 'administrators see every organization without being a member');
    assert.equal((await getAuditLogs({ organizationId: 2 })).total, 1);
    assert.equal((await getAuditLogs({ organizationId: 'personal' })).total, 1);

    const { csv, rows } = await exportAuditLogs({});
    assert.equal(rows, 3);
    const lines = csv.trim().split('\r\n');
    assert.equal(lines[0], 'timestamp,actor,action,category,resource,resourceName,organization,ipAddress,reason,details');
    assert.ok(lines.some(line => line.includes(`"'=HYPERLINK(""http://evil"")"`)), 'formula-like values are neutralised');
    assert.ok(lines.some(line => line.includes('"finance, ""quoted"""')), 'commas and quotes are escaped');
    assert.ok(lines.slice(1).every(line => line.includes(',bob,')), 'the actor is named');
});

test('the audit retention deletes only entries older than the period; without one everything is kept', async () => {
    assert.equal(await pruneAuditLogs(), 0);
    assert.equal(await AuditLog.count(), 3);
    await updateSystemSettings({ auditRetentionDays: 90 });
    assert.equal(await pruneAuditLogs(), 1);
    assert.equal(await AuditLog.count(), 2);
    await updateSystemSettings({ auditRetentionDays: null });
});

test('deleting a user removes all personal data and keeps organization items', async () => {
    await Account.create({ id: 3, username: 'carol', firstName: 'Carol', lastName: 'Gone', password: 'x' });
    const folder = await Folder.create({ name: 'Home lab', accountId: 3 });
    const entry = await Entry.create({ type: 'server', name: 'pi', accountId: 3, folderId: folder.id });
    const identity = await Identity.create({ name: 'pi key', type: 'ssh', accountId: 3 });
    await Credential.create({ identityId: identity.id, type: 'sshKey', secretEncrypted: 'x', iv: 'x', authTag: 'x' });
    const tag = await Tag.create({ name: 'lab', color: '#fff', accountId: 3 });
    await EntryTag.create({ entryId: entry.id, tagId: tag.id });
    await EntryIdentity.create({ entryId: entry.id, identityId: identity.id });
    await Snippet.create({ name: 'mine', command: 'id', accountId: 3 });
    await Keymap.create({ accountId: 3, action: 'search', key: 'ctrl+shift+f' });
    const shared = await Snippet.create({ name: 'team', command: 'uptime', organizationId: 1 });
    const orgEntry = await Entry.create({ type: 'server', name: 'shared', organizationId: 1 });

    assert.deepEqual(await deleteAccount(3), { username: 'carol', organizations: { transferred: [], deleted: [] } });
    for (const Model of [Folder, Entry, Identity, Tag, Snippet, Keymap]) assert.equal(await Model.count({ where: { accountId: 3 } }), 0, Model.name);
    assert.equal(await Credential.count({ where: { identityId: identity.id } }), 0);
    assert.equal(await EntryTag.count({ where: { entryId: entry.id } }), 0);
    assert.equal(await EntryIdentity.count({ where: { entryId: entry.id } }), 0);
    assert.ok(await Snippet.findByPk(shared.id), 'organization snippets stay');
    assert.ok(await Entry.findByPk(orgEntry.id), 'organization servers stay');
    assert.equal(await Account.findByPk(3), null);
});

test('an unknown username costs a password comparison as well', async () => {
    const ms = async work => { const start = process.hrtime.bigint(); await work(); return Number(process.hrtime.bigint() - start) / 1e6; };
    const reference = await hash('reference', 10);
    const bcryptTime = await ms(() => require('bcrypt').compare('wrong', reference));
    await login({ username: 'nobody', password: 'wrong' }, client);
    const unknown = await ms(() => login({ username: 'nobody', password: 'wrong' }, client));
    assert.ok(unknown > bcryptTime / 2, `unknown user answered in ${unknown} ms, a bcrypt comparison takes ${bcryptTime} ms`);
});
