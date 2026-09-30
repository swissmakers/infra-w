require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = '2'.repeat(64);

const Account = require('../server/models/Account');
const Organization = require('../server/models/Organization');
const OrganizationMember = require('../server/models/OrganizationMember');
const Folder = require('../server/models/Folder');
const Entry = require('../server/models/Entry');
const Identity = require('../server/models/Identity');
const EntryIdentity = require('../server/models/EntryIdentity');
const { validateEntryAccess, createEntry, editEntry, importSSHConfig } = require('../server/controllers/entry');
const { getActiveOrgIds } = require('../server/utils/permission');
const { establishJumpHosts } = require('../server/utils/sshClient');
const { importSSHConfigValidation } = require('../server/validations/server');
const wsAuth = require('../server/middlewares/wsAuth');
const Script = require('../server/models/Script');
const scripts = require('../server/controllers/script');

before(async () => {
    await db.sync();
    for (const [id, username] of [[1, 'alice'], [2, 'bob'], [3, 'carol']]) {
        await Account.create({ id, username, firstName: username, lastName: 'Test', password: 'x' });
    }
    await Organization.create({ id: 1, name: 'Operations' });
    await OrganizationMember.create({ organizationId: 1, accountId: 1, role: 'owner', status: 'active', invitedBy: 1 });
    await OrganizationMember.create({ organizationId: 1, accountId: 3, role: 'member', status: 'pending', invitedBy: 1 });
    await Folder.create({ id: 10, name: 'Personal', accountId: 1, position: 0 });
    await Folder.create({ id: 11, name: 'Shared', organizationId: 1, position: 0 });
    const server = (id, name, extra) => Entry.create({ id, name, type: 'server', position: 0, config: { protocol: 'ssh', ip: '10.0.0.' + id, port: 22 }, ...extra });
    await server(100, 'alice-root', { accountId: 1 });
    await server(101, 'alice-folder', { accountId: 1, folderId: 10 });
    await server(102, 'org-folder', { organizationId: 1, folderId: 11 });
    await server(103, 'alice-jump', { accountId: 1 });
    await Identity.create({ id: 50, name: 'alice-key', type: 'password', accountId: 1, username: 'root' });
    await EntryIdentity.create({ entryId: 103, identityId: 50, isDefault: true });
});

const access = async (accountId, entryId) => (await validateEntryAccess(accountId, await Entry.findByPk(entryId))).valid === true;

test('personal servers are only accessible to their owner, with or without a folder', async () => {
    assert.equal(await access(1, 100), true);
    assert.equal(await access(2, 100), false);
    assert.equal(await access(1, 101), true);
    assert.equal(await access(2, 101), false);
});

test('organization servers need an active membership; a pending invitation is not enough', async () => {
    assert.equal(await access(1, 102), true);
    assert.equal(await access(2, 102), false);
    assert.equal(await access(3, 102), false);
    assert.deepEqual(await getActiveOrgIds(1), [1]);
    assert.deepEqual(await getActiveOrgIds(3), []);
});

test('servers cannot be created in a foreign organization or folder', async () => {
    const base = { name: 'planted', type: 'server', config: { protocol: 'ssh', ip: '10.9.9.9', port: 22 } };
    assert.equal((await createEntry(2, { ...base, organizationId: 1 })).code, 403);
    assert.equal((await createEntry(3, { ...base, organizationId: 1 })).code, 403);
    assert.equal((await createEntry(2, { ...base, folderId: 11 })).code, 403);
    const created = await createEntry(1, { ...base, folderId: 10, organizationId: 1 });
    assert.equal(created.organizationId, null);
    assert.equal(created.accountId, 1);
});

test('moving a server into an organization folder moves it into the organization', async () => {
    const created = await createEntry(1, { name: 'moving', type: 'server', config: { protocol: 'ssh', ip: '10.9.9.8', port: 22 } });
    assert.equal((await editEntry(1, created.id, { folderId: 11 })).success, true);
    const moved = await Entry.findByPk(created.id);
    assert.equal(moved.organizationId, 1);
    assert.equal(moved.accountId, null);
    assert.equal((await editEntry(2, created.id, { name: 'taken' })).code, 403);
});

test('jump hosts only use identities of the connecting account', async () => {
    await assert.rejects(establishJumpHosts([103], 2), /No accessible identity/);
});

test('the SSH config import is validated and cannot assign foreign identities', async () => {
    const ok = { folderId: 10, servers: [{ name: 'imported', ip: '10.1.1.1', port: 22, identities: [] }] };
    assert.equal(importSSHConfigValidation.validate(ok).error, undefined);
    assert.ok(importSSHConfigValidation.validate({ ...ok, servers: [{ ...ok.servers[0], config: { jumpHosts: [103] } }] }).error);
    const result = await importSSHConfig(2, { folderId: 10, servers: [{ name: 'x', ip: '10.1.1.2', port: 22, identities: [] }] });
    assert.equal(result.code, 403);
    const foreign = await importSSHConfig(1, { folderId: 10, servers: [{ name: 'y', ip: '10.1.1.3', port: 22, identities: [999] }] });
    assert.equal(foreign.imported, 0);
    assert.equal(foreign.errors, 1);
});

const fakeSocket = () => ({ closed: null, close(code, reason) { this.closed = { code, reason }; } });

test('share links cannot open file access; only terminal and desktop routes accept them', async () => {
    const sftp = fakeSocket();
    assert.equal(await wsAuth(sftp, { query: { shareId: 'abc' }, headers: {} }), null);
    assert.equal(sftp.closed.code, 4001);
    const term = fakeSocket();
    assert.equal(await wsAuth(term, { query: { shareId: 'unknown' }, headers: {} }, { allowShared: true }), null);
    assert.equal(term.closed.code, 4013);
});

test('scripts run only for their owner or active members of their organization', async () => {
    const personal = await Script.create({ name: 'mine', content: 'id', accountId: 1, sortOrder: 1 });
    const shared = await Script.create({ name: 'shared', content: 'id', organizationId: 1, sortOrder: 1 });
    assert.ok(await scripts.findAccessible(1, personal.id));
    assert.equal(await scripts.findAccessible(2, personal.id), null);
    assert.ok(await scripts.findAccessible(1, shared.id));
    assert.equal(await scripts.findAccessible(3, shared.id), null, 'a pending invitation is not enough');
    assert.deepEqual((await scripts.listAccessible(3)).map(script => script.id), []);
});
