require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

test('all schema migrations run and are idempotent on current SQLite/Sequelize', async t => {
    const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    t.after(() => db.close());
    require.cache[require.resolve('../server/utils/database')] = { exports: db };
    process.env.ENCRYPTION_KEY = '1'.repeat(64);
    const MigrationRunner = require('../server/utils/migrationRunner');
    const runner = new MigrationRunner();
    await runner.runMigrations();
    const migrations = await runner.getExecutedMigrations();
    assert.equal(migrations.length, (await runner.getMigrationFiles()).length);
    await runner.runMigrations();
    assert.deepEqual(await runner.getExecutedMigrations(), migrations);
    const tables = await db.getQueryInterface().showAllTables();
    assert.ok(!tables.includes('device_codes'));
    for (const table of ['entries', 'audit_logs', 'integrations']) assert.ok(tables.includes(table));
    assert.ok((await db.getQueryInterface().describeTable('accounts')).disabled, 'accounts can be locked');
    for (const table of ['host_keys', 'api_tokens']) assert.ok(tables.includes(table), table);
    const settings = await db.getQueryInterface().describeTable('system_settings');
    assert.ok(settings.webhookUrl && settings.webhookSecretEncrypted, 'webhook notification settings');
    assert.ok((await db.getQueryInterface().describeTable('oidc_providers')).organizationGroups, 'OIDC group mapping');
});
