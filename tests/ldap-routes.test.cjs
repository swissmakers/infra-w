require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const stub = (path, exports) => { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; };
let tested = null, created = null;
stub('../server/controllers/oidc', {});
stub('../server/controllers/ldap', {
    testDraftConnection: async value => { tested = value; return { success: true }; },
    createProvider: async value => { created = value; return { id: 1 }; },
});
const { AUDIT_ACTIONS, RESOURCE_TYPES } = require('../server/utils/auditActions');
const audited = [];
stub('../server/controllers/audit', { auditRequest: async (req, entry) => audited.push(entry), AUDIT_ACTIONS, RESOURCE_TYPES });
stub('../server/middlewares/auth', { authenticate: (req, res, next) => {
    if (!req.header('x-fixture-role')) return res.sendStatus(401);
    req.user = { id: 1, role: req.header('x-fixture-role') };
    next();
} });
stub('../server/middlewares/permission', { isAdmin: (req, res, next) => req.header('x-fixture-role') === 'admin' ? next() : res.sendStatus(403) });

test('LDAP draft tests require administrators, validate configuration, and creation persists secure defaults', async t => {
    const app = express(); app.use(express.json()); app.use('/auth', require('../server/routes/authProviders'));
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise(resolve => server.close(resolve)));
    await new Promise(resolve => server.once('listening', resolve));
    const send = (path, method, role, body) => fetch(`http://127.0.0.1:${server.address().port}/auth/providers/admin/ldap${path}`, {
        method, headers: { 'Content-Type': 'application/json', ...(role && { 'x-fixture-role': role }) }, body: JSON.stringify(body),
    });
    const draft = { name: 'Fixture', host: 'directory.example.test', bindDN: 'cn=service', bindPassword: 'fixture-only', baseDN: 'dc=example,dc=test' };
    assert.equal((await send('/test', 'POST', null, draft)).status, 401);
    assert.equal((await send('/test', 'POST', 'user', draft)).status, 403);
    assert.equal(tested, null);
    assert.equal((await send('/test', 'POST', 'admin', { ...draft, port: 70000 })).status, 400);
    assert.equal(tested, null);
    assert.equal((await send('/test', 'POST', 'admin', draft)).status, 200);
    assert.equal(tested.useTLS, true); assert.equal(tested.port, 636);
    assert.equal((await send('', 'PUT', 'admin', draft)).status, 201);
    assert.equal(created.useTLS, true); assert.equal(created.port, 636); assert.equal(created.enabled, false);
    assert.equal(audited.at(-1).action, 'auth_provider.create');
    assert.ok(audited.at(-1).details.fields.includes('bindPassword'));
    assert.equal(JSON.stringify(audited).includes('fixture-only'), false);
});
