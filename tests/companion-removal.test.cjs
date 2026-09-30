require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

test('web-only migration removes the pairing table and keeps all sessions', async t => {
    const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    t.after(() => db.close());
    await db.query('CREATE TABLE sessions (id INTEGER PRIMARY KEY, userAgent TEXT)');
    await db.query('CREATE TABLE device_codes (code TEXT)');
    await db.query("INSERT INTO sessions VALUES (1, 'Mozilla/5.0 Firefox'), (2, NULL)");
    const migration = require('../server/migrations/0033-remove-companion-pairing');
    await migration.up(db.getQueryInterface());
    await migration.up(db.getQueryInterface());
    assert.deepEqual((await db.query('SELECT id FROM sessions ORDER BY id'))[0].map(s => s.id), [1, 2]);
    assert.equal((await db.getQueryInterface().showAllTables()).includes('device_codes'), false);
});
