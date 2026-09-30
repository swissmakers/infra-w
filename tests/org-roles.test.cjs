require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = '8'.repeat(64);

require('../server/models/Integration');
require('../server/models/Tag');
const [Account, Organization, OrganizationMember, Snippet, Identity, Folder, Entry] =
    ['Account', 'Organization', 'OrganizationMember', 'Snippet', 'Identity', 'Folder', 'Entry'].map(name => require(`../server/models/${name}`));
const orgs = require('../server/controllers/organization');

const ORG = 1;
const [OWNER, MANAGER, MEMBER, NEWCOMER] = [1, 2, 3, 4];
const role = async accountId => (await OrganizationMember.findOne({ where: { organizationId: ORG, accountId } }))?.role;

before(async () => {
    await db.sync();
    for (const id of [OWNER, MANAGER, MEMBER, NEWCOMER, 5]) await Account.create({ id, username: `user${id}`, firstName: 'U', lastName: `${id}`, password: 'x' });
    await Organization.create({ id: ORG, name: 'Ops' });
    const join = (accountId, memberRole, createdAt) => OrganizationMember.create({ organizationId: ORG, accountId, role: memberRole, status: 'active', invitedBy: OWNER, createdAt });
    await join(OWNER, 'owner'); await join(MANAGER, 'manager', new Date(Date.now() + 1000)); await join(MEMBER, 'member', new Date(Date.now() - 1000));
});

test('managers invite and remove members; only the owner changes roles and removes managers', async () => {
    assert.equal((await orgs.inviteUser(MEMBER, ORG, 'user4')).code, 403, 'members cannot invite');
    assert.deepEqual(await orgs.inviteUser(MANAGER, ORG, 'user4'), { success: true, message: 'Invitation sent successfully' });
    assert.equal((await orgs.removeMember(MANAGER, ORG, OWNER)).code, 403);
    assert.equal((await orgs.setMemberRole(MANAGER, ORG, MEMBER, 'manager')).code, 403);
    assert.equal((await orgs.removeMember(MANAGER, ORG, NEWCOMER)).success, true, 'a pending invitation can be withdrawn');

    assert.equal((await orgs.setMemberRole(OWNER, ORG, MEMBER, 'manager')).previousRole, 'member');
    assert.equal((await orgs.removeMember(MANAGER, ORG, MEMBER)).code, 403, 'managers cannot remove managers');
    await orgs.setMemberRole(OWNER, ORG, MEMBER, 'member');
    assert.equal((await orgs.updateOrganization(MEMBER, ORG, { name: 'x' })).code, 403);
    assert.equal((await orgs.updateOrganization(MANAGER, ORG, { name: 'Operations' })).name, 'Operations');
    const listed = (await orgs.listOrganizations(MANAGER))[0];
    assert.equal(listed.role, 'manager');
});

test('the owner transfers the ownership and becomes a manager', async () => {
    assert.equal((await orgs.transferOwnership(MANAGER, ORG, MEMBER)).code, 403);
    assert.equal((await orgs.transferOwnership(OWNER, ORG, 5)).code, 404, 'only active members can take over');
    await orgs.transferOwnership(OWNER, ORG, MEMBER);
    assert.deepEqual([await role(OWNER), await role(MEMBER)], ['manager', 'owner']);
    assert.equal((await orgs.leaveOrganization(MEMBER, ORG)).code, 403, 'the owner cannot leave');
});

test('a deleted owner hands over to a manager first; an organization without members is deleted with its content', async () => {
    assert.deepEqual(await orgs.handOverOrganizations(MEMBER), { transferred: [{ organizationId: ORG, newOwnerId: OWNER }], deleted: [] },
        'the manager wins over a member who joined earlier');

    await Organization.create({ id: 2, name: 'Solo' });
    await OrganizationMember.create({ organizationId: 2, accountId: 5, role: 'owner', status: 'active', invitedBy: 5 });
    await Snippet.create({ name: 'team', command: 'id', organizationId: 2 });
    await Identity.create({ name: 'shared', type: 'password', organizationId: 2 });
    await Folder.create({ name: 'Racks', organizationId: 2 });
    await Entry.create({ type: 'server', name: 'rack-1', organizationId: 2 });
    assert.deepEqual(await orgs.handOverOrganizations(5), { transferred: [], deleted: [2] });
    for (const Model of [Snippet, Identity, Folder, Entry, OrganizationMember]) assert.equal(await Model.count({ where: { organizationId: 2 } }), 0, Model.name);
    assert.equal(await Organization.findByPk(2), null);
});

test('deleting an organization removes its snippets and identities too', async () => {
    await Snippet.create({ name: 'ops', command: 'uptime', organizationId: ORG });
    await Identity.create({ name: 'ops key', type: 'ssh', organizationId: ORG });
    assert.equal((await orgs.deleteOrganization(MANAGER, ORG)).code, 403);
    assert.deepEqual(await orgs.deleteOrganization(OWNER, ORG), { success: true, name: 'Operations' });
    assert.equal(await Snippet.count({ where: { organizationId: ORG } }), 0);
    assert.equal(await Identity.count({ where: { organizationId: ORG } }), 0);
});
