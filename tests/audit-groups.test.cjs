require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AUDIT_ACTIONS, AUDIT_GROUPS, auditGroupOf } = require('../server/utils/auditActions');

test('every audit action belongs to exactly one activity group', () => {
    for (const action of Object.values(AUDIT_ACTIONS)) {
        const groups = Object.keys(AUDIT_GROUPS).filter(key => AUDIT_GROUPS[key].actions.includes(action));
        assert.equal(groups.length, 1, `${action} is in ${groups.length} groups`);
    }
    assert.equal(auditGroupOf('entry.ssh_connect'), 'connections');
    assert.equal(auditGroupOf('entry.update'), 'servers');
    assert.equal(auditGroupOf('identity.credentials_access'), 'passwords');
    assert.equal(auditGroupOf('entry.telnet_connect'), 'connections');
    assert.equal(auditGroupOf('auth.sign_in_failed'), 'signIn');
    assert.equal(auditGroupOf('auth_provider.update'), 'administration');
    assert.equal(auditGroupOf('user.login'), null);
});

test('every audit action and group has a label in every language', () => {
    const { readFileSync } = require('node:fs');
    for (const lang of ['en', 'de', 'fr', 'it', 'es']) {
        const { audit } = JSON.parse(readFileSync(`${__dirname}/../client/public/assets/locales/${lang}.json`, 'utf8'));
        for (const action of Object.values(AUDIT_ACTIONS)) {
            const [scope, name] = action.split('.');
            assert.ok(audit.actions[scope]?.[name], `${lang}: ${action}`);
        }
        for (const group of Object.keys(AUDIT_GROUPS)) assert.ok(audit.categories[group], `${lang}: ${group}`);
    }
});

test('sign-in and administration cannot be switched off per organization', () => {
    assert.equal(AUDIT_GROUPS.signIn.setting, null);
    assert.equal(AUDIT_GROUPS.administration.setting, null);
});
