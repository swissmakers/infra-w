require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = '9'.repeat(64);

const Account = require('../server/models/Account');
const ApiToken = require('../server/models/ApiToken');
const AuditLog = require('../server/models/AuditLog');
require('../server/models/SystemSettings');
const { authenticate, requireBrowserSession } = require('../server/middlewares/auth');
const { createApiToken, listApiTokens, revokeApiToken } = require('../server/utils/apiTokens');
const { auditRequest, AUDIT_ACTIONS } = require('../server/controllers/audit');
const { createApiTokenValidation } = require('../server/validations/apiToken');

const call = (middleware, token, method = 'GET') => new Promise(resolve => {
    const req = { method, header: name => (name === 'authorization' ? `Bearer ${token}` : undefined), headers: {}, socket: {} };
    const res = { status: code => ({ json: body => resolve({ status: code, body }) }) };
    middleware(req, res, () => resolve({ status: 'next', req }));
});

before(async () => {
    await db.sync();
    await Account.create({ id: 1, username: 'ci', firstName: 'C', lastName: 'I', password: 'x' });
});

test('tokens are stored hashed, act as their account and read tokens only read', async () => {
    const read = await createApiToken(1, { name: 'inventory', scope: 'read', days: 30 });
    assert.match(read.token, /^infw_[A-Za-z0-9_-]{43}$/);
    assert.equal((await ApiToken.findByPk(read.id)).tokenHash.length, 64, 'only a SHA-256 hash is stored');
    assert.equal((await listApiTokens(1))[0].token, undefined, 'lists never contain the token');

    const allowed = await call(authenticate, read.token);
    assert.equal(allowed.status, 'next');
    assert.equal(allowed.req.user.username, 'ci');
    assert.equal(allowed.req.session, null);
    assert.equal((await call(authenticate, read.token, 'POST')).status, 403);

    const write = await createApiToken(1, { name: 'deploy', scope: 'write', days: 1 });
    assert.equal((await call(authenticate, write.token, 'PATCH')).status, 'next');
    assert.ok((await ApiToken.findByPk(write.id)).lastUsedAt, 'use is recorded');
});

test('expired, revoked and locked tokens are refused; security endpoints need a browser sign-in', async () => {
    const token = await createApiToken(1, { name: 'old', scope: 'write', days: 1 });
    const { req } = await call(authenticate, token.token);
    assert.equal((await call(requireBrowserSession, token.token)).status, 'next', 'the guard only looks at req.apiToken');
    assert.equal(await new Promise(resolve => requireBrowserSession(req, { status: code => ({ json: () => resolve(code) }) }, () => resolve('next'))), 403);

    await ApiToken.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { id: token.id } });
    assert.equal((await call(authenticate, token.token)).status, 401);

    const locked = await createApiToken(1, { name: 'locked', scope: 'read', days: 5 });
    await Account.update({ disabled: true }, { where: { id: 1 } });
    assert.equal((await call(authenticate, locked.token)).status, 401);
    await Account.update({ disabled: false }, { where: { id: 1 } });

    assert.equal((await revokeApiToken(locked.id, 2)).code, 404, 'users revoke only their own tokens');
    await revokeApiToken(locked.id, 1);
    assert.equal((await call(authenticate, locked.token)).status, 401);
    assert.ok(createApiTokenValidation.validate({ name: 'x', scope: 'read', days: 400 }).error, 'at most one year');
});

test('changes made with a token name it in the audit log', async () => {
    const token = await createApiToken(1, { name: 'deploy bot', scope: 'write', days: 5 });
    const { req } = await call(authenticate, token.token, 'PUT');
    await auditRequest(req, { action: AUDIT_ACTIONS.ENTRY_CREATE, details: { name: 'web-01' } });
    const entry = await AuditLog.findOne({ where: { action: AUDIT_ACTIONS.ENTRY_CREATE } });
    const details = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
    assert.deepEqual(details, { name: 'web-01', apiToken: 'deploy bot' });
});
