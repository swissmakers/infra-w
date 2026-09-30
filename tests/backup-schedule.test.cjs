require('./support/isolate.cjs');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = '5'.repeat(64);

const BackupSettings = require('../server/models/BackupSettings');
const { runDueBackups } = require('../server/utils/backupService');
const { backupSettingsValidation } = require('../server/validations/backup');

before(() => db.sync());

const lastRun = async () => (await BackupSettings.findOne()).lastScheduledRunAt;

test('scheduled backups run when due and keep their schedule across restarts', async () => {
    await BackupSettings.create({ scheduleInterval: 0 });
    await runDueBackups();
    assert.equal(await lastRun(), null, 'no schedule, no run');

    await BackupSettings.update({ scheduleInterval: 24 }, { where: {} });
    await runDueBackups();
    const first = await lastRun();
    assert.ok(first, 'a new schedule runs right away');
    await runDueBackups();
    assert.equal(await lastRun(), first, 'not due again within the interval');

    await BackupSettings.update({ lastScheduledRunAt: new Date(Date.now() - 25 * 3600 * 1000) }, { where: {} });
    await runDueBackups();
    assert.notEqual(await lastRun(), first, 'due after the interval, also after a restart');
});

test('only the offered schedules are accepted', () => {
    assert.equal(backupSettingsValidation.validate({ scheduleInterval: 168 }).error, undefined);
    assert.ok(backupSettingsValidation.validate({ scheduleInterval: 1000 }).error);
});
