const { stub } = require('./support/isolate.cjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'infra-w-export-'));
stub('../server/utils/dataPaths', { DATA_DIR: temp, BACKUP_TEMP_DIR: path.join(temp, '.backup-temp') });
stub('../server/middlewares/auth', { authenticateDownload: (req, res, next) => { req.user = { id: 1, username: 'admin' }; next(); } });

const db = require('../server/utils/database');
const AuditLog = require('../server/models/AuditLog');
const { AUDIT_ACTIONS } = require('../server/utils/auditActions');

let server, base;
before(async () => {
    await db.sync();
    const app = express();
    app.use('/export', require('../server/routes/backupExport'));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/export`;
});
after(() => { server.close(); fs.rmSync(temp, { recursive: true, force: true }); });

test('the database download is a consistent snapshot, removed afterwards and audited', async () => {
    const response = await fetch(`${base}/database`);
    assert.equal(response.status, 200);
    const file = Buffer.from(await response.arrayBuffer());
    assert.equal(file.subarray(0, 16).toString('latin1'), 'SQLite format 3\0');
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(fs.readdirSync(path.join(temp, '.backup-temp')), []);
    assert.equal(await AuditLog.count({ where: { action: AUDIT_ACTIONS.DATABASE_DOWNLOAD, accountId: 1 } }), 1);
});

test('only recordings and logs can be downloaded by name', async () => {
    assert.equal((await fetch(`${base}/secrets/infra-w.db`)).status, 400);
    assert.equal((await fetch(`${base}/logs/missing.log`)).status, 404);
});
