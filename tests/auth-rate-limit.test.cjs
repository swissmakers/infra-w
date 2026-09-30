const { stub } = require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

stub('../server/controllers/auth', {
    login: async ({ password }) => password === 'fixture-success'
        ? { token: 'fixture-session' } : { code: 401, message: 'Invalid credentials' },
    logout: async () => null,
});
stub('../server/controllers/passkey', {});
stub('../server/middlewares/auth', { authenticate: (_req, _res, next) => next() });

test('login limiter counts HTTP-200 authentication failures and excludes successful logins', async t => {
    const app = express();
    app.use(express.json());
    app.use('/auth', require('../server/routes/auth'));
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise(resolve => server.close(resolve)));
    await new Promise(resolve => server.once('listening', resolve));
    const removed = await fetch(`http://127.0.0.1:${server.address().port}/auth/device`, { method: 'POST' });
    assert.equal(removed.status, 404);
    const login = password => fetch(`http://127.0.0.1:${server.address().port}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'fixture', password }),
    });
    for (let i = 0; i < 65; i++) {
        const response = await login('fixture-success');
        assert.equal(response.status, 200);
        assert.equal((await response.json()).token, 'fixture-session');
    }
    for (let i = 0; i < 60; i++) {
        const response = await login('fixture-failure');
        assert.equal(response.status, 401);
        assert.equal((await response.json()).code, 401);
    }
    const blocked = await login('fixture-failure');
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.get('retry-after'));
    assert.equal((await blocked.json()).code, 429);
});
