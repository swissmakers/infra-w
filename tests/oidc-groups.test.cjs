require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = 'c'.repeat(64);

require('../server/models/Integration');
require('../server/models/Tag');
const Account = require('../server/models/Account');
const Organization = require('../server/models/Organization');
const OrganizationMember = require('../server/models/OrganizationMember');
const OIDCProvider = require('../server/models/OIDCProvider');
const { mapGroups, listPublicProviders, ensureInternalProvider } = require('../server/controllers/oidc');
const { directoryRole } = require('../server/utils/sessionAuth');
const { joinOrganizations } = require('../server/controllers/organization');
const { oidcProviderUpdateValidation } = require('../server/validations/oidc');

const provider = { groupsClaim: 'roles', adminGroups: ['Infra Admins'], organizationGroups: [{ group: 'ops', organizationId: 1 }, { group: 'dev', organizationId: 2 }] };

before(async () => {
    await db.sync();
    await Account.create({ id: 1, username: 'oidc-user', firstName: 'O', lastName: 'U', password: 'x', authProviderType: 'oidc' });
    await Organization.create({ id: 1, name: 'Ops' });
    await Organization.create({ id: 2, name: 'Dev' });
});

test('groups from the configured claim decide the role and the organizations', () => {
    assert.deepEqual(mapGroups(provider, { roles: ['infra admins', 'OPS'] }), { role: 'admin', organizationIds: [1] });
    assert.deepEqual(mapGroups(provider, { roles: 'dev, other' }), { role: 'user', organizationIds: [2] }, 'comma-separated claims work');
    assert.deepEqual(mapGroups(provider, { groups: ['infra admins'] }), { role: 'user', organizationIds: [] }, 'only the configured claim counts');
    assert.deepEqual(mapGroups({ ...provider, adminGroups: [] }, {}), { role: null, organizationIds: [] }, 'without admin groups the role is left alone');
});

test('mapped organizations are joined without touching existing roles; unknown ones are skipped', async () => {
    await OrganizationMember.create({ organizationId: 2, accountId: 1, role: 'manager', status: 'pending', invitedBy: 1 });
    await joinOrganizations(1, [1, 2, 99]);
    const memberships = await OrganizationMember.findAll({ where: { accountId: 1 }, order: [['organizationId', 'ASC']] });
    assert.deepEqual(memberships.map(m => [m.organizationId, m.role, m.status]), [[1, 'member', 'active'], [2, 'manager', 'active']]);
});

test('the group lists are stored and read back as lists', async () => {
    const { id } = await OIDCProvider.create({ name: 'Keycloak', issuer: 'https://sso.example', clientId: 'infra-w', redirectUri: 'https://infra-w.example/cb',
        scope: 'openid groups', enabled: true, groupsClaim: 'roles', adminGroups: ['Infra Admins'], organizationGroups: provider.organizationGroups });
    const stored = await OIDCProvider.findByPk(id);
    assert.deepEqual([stored.groupsClaim, stored.adminGroups, stored.organizationGroups], ['roles', ['Infra Admins'], provider.organizationGroups]);
    assert.ok(oidcProviderUpdateValidation.validate({ organizationGroups: [{ group: 'x' }] }).error, 'a mapping needs an organization');
});

test('LDAP and OIDC sign-ins never demote the last active administrator', async () => {
    const admin = await Account.create({ id: 2, username: 'oidc-admin', firstName: 'A', lastName: 'D', password: 'x', authProviderType: 'oidc', role: 'admin' });
    assert.equal(await directoryRole(admin, 'user'), null, 'the only administrator keeps the role');
    await Account.create({ id: 3, username: 'locked-admin', firstName: 'L', lastName: 'A', password: 'x', role: 'admin', disabled: true });
    assert.equal(await directoryRole(admin, 'user'), null, 'a locked administrator does not count');
    await Account.create({ id: 4, username: 'local-admin', firstName: 'L', lastName: 'B', password: 'x', role: 'admin' });
    assert.equal(await directoryRole(admin, 'user'), 'user');
    assert.equal(await directoryRole({ role: 'user' }, 'admin'), 'admin');
});

test('the public list only has what the sign-in page shows', async () => {
    await ensureInternalProvider();
    await OIDCProvider.update({ enabled: false }, { where: { isInternal: true } });
    await OIDCProvider.create({ name: 'Old IdP', issuer: 'https://old.example', clientId: 'x', redirectUri: 'https://infra-w.example/cb', enabled: false });
    const providers = await listPublicProviders();
    assert.deepEqual(providers.map(p => [p.name, p.enabled]), [['Keycloak', true], ['Internal Authentication', false]]);
    assert.deepEqual(Object.keys(providers[0]).sort(), ['enabled', 'id', 'isInternal', 'issuer', 'name']);
});
