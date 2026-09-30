require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchDirectories } = require('../server/utils/sftpHelpers');

const tree = {
    '/home/user': ['projects', '.cache', '.config', 'Downloads', 'notes.txt'],
    '/home/user/projects': ['infra', '.git'],
    '/home/user/.cache': ['pip', 'npm'],
    '/home/user/.config': ['systemd'],
    '/home/user/Downloads': [],
    '/': ['home', 'etc'],
    '/home': ['user'],
};
const fakeSftp = {
    readdir(dir, callback) {
        const names = tree[dir];
        if (!names) return callback(new Error('ENOENT'));
        callback(null, names.map(name => ({ filename: name, longname: name.includes('.txt') ? `-rw-r--r-- ${name}` : `drwxr-xr-x ${name}` })));
    },
};
const search = (path, max) => new Promise((resolve, reject) => searchDirectories(fakeSftp, path, (err, dirs) => err ? reject(err) : resolve(dirs), max));

test('a trailing slash lists the direct child folders, hidden ones included, sorted', async () => {
    assert.deepEqual(await search('/home/user/'), ['/home/user/.cache', '/home/user/.config', '/home/user/Downloads', '/home/user/projects']);
    assert.deepEqual(await search('/'), ['/etc', '/home']);
});

test('a typed name suggests matching direct children before deeper folders', async () => {
    const dotFolders = await search('/home/user/.');
    assert.deepEqual(dotFolders.slice(0, 2), ['/home/user/.cache', '/home/user/.config'], 'direct children come first');
    assert.ok(dotFolders.includes('/home/user/.cache/pip'), 'deeper matches fill the remaining slots');
    assert.ok(!dotFolders.includes('/home/user/notes.txt'), 'files are never suggested');
    assert.deepEqual((await search('/home/user/pro')).slice(0, 1), ['/home/user/projects']);
    assert.deepEqual(await search('/home/user/do'), ['/home/user/Downloads'], 'matching is case-insensitive');
});

test('results are capped and a missing directory yields no suggestions', async () => {
    assert.equal((await search('/home/user/.', 2)).length, 2);
    assert.deepEqual(await search('/missing/'), []);
});
