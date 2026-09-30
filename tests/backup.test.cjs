require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const tar = require('tar');
const { validateBackupName, extractBackupArchive } = require('../server/utils/backupArchive');

const fixture = async (t, name, { type = 'File', data = 'fixture', linkpath } = {}) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'infra-w-archive-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const output = path.join(dir, 'output');
    await fs.mkdir(output);
    const header = new tar.Header({ path: name, type, size: type === 'File' ? Buffer.byteLength(data) : 0, mode: 0o600, linkpath });
    header.encode();
    const payload = type === 'File' ? Buffer.concat([Buffer.from(data), Buffer.alloc((512 - Buffer.byteLength(data) % 512) % 512)]) : Buffer.alloc(0);
    const file = path.join(dir, 'backup-test.tar.gz');
    await fs.writeFile(file, gzipSync(Buffer.concat([header.block, payload, Buffer.alloc(1024)])));
    return { file, output, dir };
};

test('backup reader restores generated tar.gz payloads', async t => {
    const { file, output } = await fixture(t, 'infra-w.db');
    await extractBackupArchive(file, output);
    assert.equal(await fs.readFile(path.join(output, 'infra-w.db'), 'utf8'), 'fixture');
});

test('backup reader rejects traversal, links and unexpected paths', async t => {
    for (const [name, options] of [['../escape', {}], ['/tmp/escape', {}], ['logs/link', { type: 'SymbolicLink', linkpath: '../../escape' }], ['logs/link', { type: 'Link', linkpath: '../escape' }], ['server/index.js', {}], ['infra-w.db', { type: 'Directory' }], ['logs', {}], ['recordings', {}]]) {
        const { file, output, dir } = await fixture(t, name, options);
        await assert.rejects(extractBackupArchive(file, output));
        await assert.rejects(fs.stat(path.join(dir, 'escape')));
    }
});

test('backup reader bounds decompressed data', async t => {
    const { file, output } = await fixture(t, 'infra-w.db', { data: 'x'.repeat(2048) });
    await assert.rejects(extractBackupArchive(file, output, { maxBytes: 1024 }), /size limit/);
});

test('backup filename cannot escape temporary or provider directories', () => {
    assert.equal(validateBackupName('backup-2026-09-24.tar.gz'), 'backup-2026-09-24.tar.gz');
    for (const name of ['../infra-w.db', 'backup-../../file.tar.gz', '/tmp/backup-test.tar.gz', 'other.zip', null]) assert.throws(() => validateBackupName(name));
});

test('backups produced by current Archiver remain readable', async t => {
    const { TarArchive } = require('archiver');
    const { createWriteStream } = require('node:fs');
    const { pipeline } = require('node:stream/promises');
    const { file, output } = await fixture(t, 'infra-w.db');
    const archive = new TarArchive({ gzip: true });
    const writing = pipeline(archive, createWriteStream(file));
    archive.append('database fixture', { name: 'infra-w.db' });
    archive.append('terminal recording', { name: 'recordings/fixture.cast' });
    await archive.finalize();
    await writing;
    await extractBackupArchive(file, output);
    assert.equal(await fs.readFile(path.join(output, 'recordings/fixture.cast'), 'utf8'), 'terminal recording');
});
