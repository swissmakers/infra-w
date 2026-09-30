require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

test('shortcuts on the old shell-conflicting defaults move to Ctrl+Shift, customized ones stay', async t => {
    const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    t.after(() => db.close());
    await db.query('CREATE TABLE keymaps (id INTEGER PRIMARY KEY, accountId INTEGER, action TEXT, key TEXT, enabled BOOLEAN)');
    await db.query(`INSERT INTO keymaps (accountId, action, key) VALUES
        (1, 'search', 'ctrl+s'), (1, 'quick-action', 'ctrl+p'), (1, 'broadcast', 'ctrl+b'),
        (2, 'search', 'alt+s'), (2, 'quick-action', 'ctrl+p'), (2, 'copy', 'ctrl+shift+l')`);
    const migration = require('../server/migrations/0039-shell-safe-shortcuts');
    await migration.up(db.getQueryInterface());
    await migration.up(db.getQueryInterface());
    const [rows] = await db.query('SELECT accountId, action, key FROM keymaps ORDER BY id');
    assert.deepEqual(rows.map(row => `${row.accountId}:${row.action}=${row.key}`), [
        '1:search=ctrl+shift+f', '1:quick-action=ctrl+shift+l', '1:broadcast=ctrl+shift+b',
        '2:search=alt+s', '2:quick-action=ctrl+p', '2:copy=ctrl+shift+l',
    ]);
});
