const { stub } = require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { escapeFilterValue, buildSearchFilter } = require('../server/utils/ldapFilter');
let entries, account, calls, searchError;
const provider = { id: 1, name: 'Fixture LDAP', host: 'directory.example.test', port: 636, useTLS: true, bindDN: 'cn=service', bindPassword: 'fixture-only', baseDN: 'dc=example,dc=test', userSearchFilter: '(uid={{username}})', usernameAttribute: 'uid', firstNameAttribute: 'givenName', lastNameAttribute: 'sn', adminGroupDNs: [], organizationIds: [] };
class Client {
    constructor(options) { calls.push(['client', options]); }
    async bind(dn, password) { calls.push(['bind', dn, password]); }
    async search(base, options) { calls.push(['search', base, options]); if (searchError) throw new Error('Invalid search base'); return { searchEntries: entries }; }
    async *searchPaginated(base, options) { calls.push(['page', base, options]); yield { searchEntries: entries }; throw new Error('Must not fetch another page'); }
    async unbind() { calls.push(['unbind']); }
}
stub('ldapts', { Client });
stub('../server/models/LDAPProvider', { findOne: async () => provider, findByPk: async () => provider, update: async () => {} });
stub('../server/models/OIDCProvider', {});
stub('../server/models/Account', { findOne: async () => account, update: async () => calls.push(['accountUpdate']), findByPk: async () => account });
stub('../server/models/Session', { create: async () => { calls.push(['session']); return { token: 'fixture' }; } });
stub('../server/models/Organization', {});
stub('../server/models/OrganizationMember', {});
const ldap = require('../server/controllers/ldap');
function reset() { calls = []; searchError = false; entries = [{ dn: 'uid=alice,dc=example,dc=test', uid: 'alice' }]; account = { id: 1, username: 'alice', authProviderType: 'ldap' }; }

test('LDAP assertion values escape injection syntax, including repeated placeholders', () => {
    assert.equal(escapeFilterValue('a*()\\\0'), 'a\\2a\\28\\29\\5c\\00');
    assert.equal(buildSearchFilter('(|(uid={{username}})(mail={{username}}))', { username: '*' }), '(|(uid=\\2a)(mail=\\2a))');
    assert.equal(buildSearchFilter('(uid={{username}})', { username: '*' }, { wildcardUsername: true }), '(uid=*)');
});
test('blank passwords cannot become anonymous LDAP binds', async () => { reset(); assert.equal(await ldap.authenticateUser('alice', ''), null); assert.equal(calls.length, 0); });
test('LDAP authentication uses escaped username and rejects ambiguous results', async () => {
    reset(); entries = [entries[0], { ...entries[0] }];
    assert.equal(await ldap.authenticateUser('a*)(uid=*)', 'fixture'), null);
    assert.equal(calls.find(c => c[0] === 'search')[2].filter, '(uid=a\\2a\\29\\28uid=\\2a\\29)');
    assert.equal(calls.filter(c => c[0] === 'bind').length, 1);
});
test('LDAP login cannot take over a matching local account', async () => {
    reset(); account.authProviderType = null;
    assert.equal(await ldap.authenticateUser('alice', 'fixture'), null);
    assert.equal(calls.some(c => ['accountUpdate', 'session'].includes(c[0])), false);
});
test('existing LDAP identity still authenticates and creates a browser session', async () => {
    reset(); assert.equal((await ldap.authenticateUser('alice', 'fixture', { userAgent: 'Firefox' })).token, 'fixture');
});
test('failed search base cannot produce a successful connection test', async () => {
    reset(); searchError = true; const result = await ldap.testDraftConnection({ ...provider, bindPassword: undefined, existingProviderId: 1 });
    assert.equal(result.success, false); assert.equal(result.diagnostics.searchProbe.success, false);
});
test('draft tests use unsaved configuration and resolve a saved secret only on the server', async () => {
    reset(); const result = await ldap.testDraftConnection({ ...provider, host: 'changed.example.test', bindPassword: undefined, existingProviderId: 1 });
    assert.equal(result.success, true);
    assert.equal(calls[0][1].url, 'ldaps://changed.example.test:636');
    assert.equal(calls.find(c => c[0] === 'bind')[2], 'fixture-only');
    assert.equal(JSON.stringify(result).includes('fixture-only'), false);
});
test('user preview reads only a bounded LDAP page', async () => {
    reset(); const result = await ldap.testUsers(1, { limit: 5 });
    assert.equal(result.success, true); assert.equal(calls.find(c => c[0] === 'page')[2].paged.pageSize, 5);
});
test('FreeIPA and AD presets derive secure, editable configuration from a domain', async () => {
    const { createLdapPreset } = await import(pathToFileURL(require.resolve('../client/src/common/utils/ldapPresets.js')));
    const ipa = createLdapPreset('freeipa', 'CORP.example.com');
    assert.equal(ipa.bindDN, 'uid=infra-w,cn=sysaccounts,cn=etc,dc=corp,dc=example,dc=com');
    assert.equal(ipa.baseDN, 'cn=users,cn=accounts,dc=corp,dc=example,dc=com');
    const ad = createLdapPreset('ad', 'corp.example.com');
    assert.equal(ad.usernameAttr, 'sAMAccountName'); assert.match(ad.groupSearchFilter, /1\.2\.840\.113556\.1\.4\.1941/);
    for (const preset of [ipa, ad]) { assert.equal(preset.useTLS, true); assert.equal(preset.port, '636'); assert.equal(preset.adminGroupDNs, undefined); }
    assert.throws(() => createLdapPreset('ad', 'corp,(uid=*)'));
});

test('LDAP honors account TOTP before issuing a session', async () => {
    reset(); account.totpEnabled = true; account.totpSecret = 'JBSWY3DPEHPK3PXP';
    assert.equal((await ldap.authenticateUser('alice', 'fixture')).code, 202);
    assert.equal((await ldap.authenticateUser('alice', 'fixture', {}, 'not-a-code')).code, 203);
    assert.equal(calls.some(c => c[0] === 'session'), false);
    const code = require('speakeasy').totp({ secret: account.totpSecret, encoding: 'base32' });
    assert.equal((await ldap.authenticateUser('alice', 'fixture', {}, code)).token, 'fixture');
});

test('updating LDAP settings never returns a decrypted service-account password', async () => {
    reset(); const result = await ldap.updateProvider(1, { host: 'changed.example.test' });
    assert.equal(result.bindPassword, undefined);
    assert.equal(JSON.stringify(result).includes('fixture-only'), false);
});
