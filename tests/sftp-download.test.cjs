const { stub } = require('./support/isolate.cjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { Server, utils } = require('ssh2');
const STATUS = utils.sftp.STATUS_CODE;

process.env.ENCRYPTION_KEY = '5'.repeat(64);
stub('../server/lib/StateBroadcaster', { notify() {}, broadcast() {}, EVENT_TYPES: {} });

const db = require('../server/utils/database');
const Account = require('../server/models/Account');
const Entry = require('../server/models/Entry');
const AuditLog = require('../server/models/AuditLog');
const SystemSettings = require('../server/models/SystemSettings');
require('../server/models/Integration');
const SessionManager = require('../server/lib/SessionManager');
const { createSignInSession } = require('../server/utils/sessionAuth');
const { AUDIT_ACTIONS } = require('../server/utils/auditActions');

const files = { '/home/operator/notes.txt': Buffer.from('hello from sftp\n') };
const attrs = size => ({ mode: 0o100644, uid: 1000, gid: 1000, size, atime: 0, mtime: 0 });

const sftpServer = new Server({ hostKeys: [utils.generateKeyPairSync('ed25519').private] }, client => {
    client.on('authentication', ctx => {
        if (ctx.method === 'password' && ctx.username === 'operator' && ctx.password === 's3cret') return ctx.accept();
        ctx.reject(['password']);
    }).on('ready', () => client.on('session', accept => accept().on('sftp', acceptSftp => {
        const sftp = acceptSftp();
        const open = new Map();
        const stat = (reqid, path) => (files[path] ? sftp.attrs(reqid, attrs(files[path].length)) : sftp.status(reqid, STATUS.NO_SUCH_FILE));
        sftp.on('STAT', stat).on('LSTAT', stat)
            .on('OPEN', (reqid, path) => {
                if (!files[path]) return sftp.status(reqid, STATUS.NO_SUCH_FILE);
                const handle = Buffer.from([open.size]);
                open.set(handle.toString('hex'), files[path]);
                sftp.handle(reqid, handle);
            })
            .on('FSTAT', (reqid, handle) => sftp.attrs(reqid, attrs(open.get(handle.toString('hex')).length)))
            .on('READ', (reqid, handle, offset, length) => {
                const data = open.get(handle.toString('hex'));
                if (offset >= data.length) return sftp.status(reqid, STATUS.EOF);
                sftp.data(reqid, data.subarray(offset, offset + length));
            })
            .on('CLOSE', (reqid, handle) => { open.delete(handle.toString('hex')); sftp.status(reqid, STATUS.OK); });
    }))).on('error', () => {});
});

let http, base, owner, stranger, sessionId;
before(async () => {
    const app = express();
    app.use('/sftp', require('../server/routes/sftp'));
    await db.sync();
    await new Promise(resolve => sftpServer.listen(0, '127.0.0.1', resolve));
    await SystemSettings.create({ id: 1, sessionIdleHours: 12, sessionMaxDays: 30 });
    await Account.create({ id: 1, username: 'alice', firstName: 'A', lastName: 'L', password: 'x' });
    await Account.create({ id: 2, username: 'mallory', firstName: 'M', lastName: 'A', password: 'x' });
    await Entry.create({ id: 1, type: 'server', name: 'files-01', accountId: 1, config: { protocol: 'ssh', ip: '127.0.0.1', port: sftpServer.address().port } });
    owner = (await createSignInSession({ id: 1, username: 'alice' }, { ip: '127.0.0.1', userAgent: 'test', method: 'password' })).token;
    stranger = (await createSignInSession({ id: 2, username: 'mallory' }, { ip: '127.0.0.1', userAgent: 'test', method: 'password' })).token;
    sessionId = SessionManager.create(1, 1, { renderer: 'sftp', directIdentity: { username: 'operator', type: 'password', password: 's3cret' } }).sessionId;
    http = app.listen(0, '127.0.0.1');
    await new Promise(resolve => http.once('listening', resolve));
    base = `http://127.0.0.1:${http.address().port}/sftp`;
});
after(() => { http.close(); sftpServer.close(); SessionManager.remove(sessionId); });

const download = (token, path) => fetch(`${base}?${new URLSearchParams({ sessionToken: token, sessionId, path })}`);

test('a file downloads over SFTP with the credentials typed in for the session, and is audited', async () => {
    const response = await download(owner, '/home/operator/notes.txt');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'hello from sftp\n');
    assert.equal(await AuditLog.count({ where: { action: AUDIT_ACTIONS.FILE_DOWNLOAD, accountId: 1 } }), 1);
});

test('missing files answer 404; another account cannot use the session', async () => {
    assert.equal((await download(owner, '/home/operator/missing.txt')).status, 404);
    assert.equal((await download(stranger, '/home/operator/notes.txt')).status, 403);
});
