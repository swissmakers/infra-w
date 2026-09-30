const { stub } = require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const broadcasts = [];
stub('../server/lib/StateBroadcaster', { broadcast: (type, scope) => broadcasts.push({ type, scope }) });
const rows = new Map();
stub('../server/models/Entry', { update: async (changes, { where }) => Object.assign(rows.get(where.id), changes) });
const { parseOsRelease, detectEntryOs, OS_NAMES_BY_ID } = require('../server/utils/osDetection');

const osRelease = fields => Object.entries(fields).map(([key, value]) => `${key}="${value}"`).join('\n');

test('os-release IDs map to the names used by snippet and script OS filters', () => {
    const cases = [
        [{ ID: 'ubuntu', NAME: 'Ubuntu' }, 'Ubuntu'], [{ ID: 'debian', NAME: 'Debian GNU/Linux' }, 'Debian'],
        [{ ID: 'alpine' }, 'Alpine Linux'], [{ ID: 'fedora' }, 'Fedora'], [{ ID: 'centos' }, 'CentOS'],
        [{ ID: 'rhel', NAME: 'Red Hat Enterprise Linux' }, 'Red Hat'], [{ ID: 'rocky' }, 'Rocky Linux'],
        [{ ID: 'almalinux' }, 'AlmaLinux'], [{ ID: 'ol', NAME: 'Oracle Linux Server' }, 'Oracle Linux'],
        [{ ID: 'opensuse-leap' }, 'openSUSE'], [{ ID: 'opensuse-tumbleweed' }, 'openSUSE'],
        [{ ID: 'sles' }, 'SUSE Linux Enterprise'], [{ ID: 'arch' }, 'Arch Linux'],
    ];
    for (const [fields, expected] of cases) assert.equal(parseOsRelease(osRelease(fields)), expected, fields.ID);
    assert.equal(parseOsRelease('ID=ubuntu\nNAME=Ubuntu'), 'Ubuntu', 'unquoted values');
    assert.equal(parseOsRelease(osRelease({ ID: 'debian' }) + '\nINFRA_W_PVE=1'), 'Proxmox VE');
    assert.equal(parseOsRelease(osRelease({ ID: 'manjaro', NAME: 'Manjaro Linux' })), 'Manjaro Linux', 'unknown IDs keep their name');
    assert.equal(parseOsRelease('% Invalid input detected'), null, 'non-Linux shells are ignored');
    assert.equal(parseOsRelease(''), null);
});

const fakeSsh = (output, { fail = false } = {}) => {
    const commands = [];
    return {
        commands,
        exec(command, callback) {
            commands.push(command);
            if (fail) return callback(new Error('exec disabled'));
            const stream = new EventEmitter();
            stream.stderr = { resume() {} };
            stream.close = () => {};
            callback(null, stream);
            setImmediate(() => { stream.emit('data', Buffer.from(output)); stream.emit('close'); });
        },
    };
};

const fakeEntry = values => {
    const row = { id: 7, accountId: 3, organizationId: null, ...values };
    rows.set(row.id, row);
    return row;
};

test('detection stores the OS, broadcasts only on change and runs at most once a day', async () => {
    broadcasts.length = 0;
    const entry = fakeEntry({ osName: null, osDetectedAt: null });
    const ssh = fakeSsh(osRelease({ ID: 'rocky', NAME: 'Rocky Linux' }));
    await detectEntryOs(ssh, entry);
    assert.equal(entry.osName, 'Rocky Linux');
    assert.match(ssh.commands[0], /\/etc\/os-release/);
    assert.deepEqual(broadcasts, [{ type: 'ENTRIES', scope: { accountId: 3, organizationId: null } }]);

    await detectEntryOs(ssh, entry);
    assert.equal(ssh.commands.length, 1, 'a recent detection is not repeated');

    entry.osDetectedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await detectEntryOs(ssh, entry);
    assert.equal(ssh.commands.length, 2);
    assert.equal(broadcasts.length, 1, 'an unchanged OS is not broadcast again');
});

test('a failed probe keeps the last known OS but records the attempt', async () => {
    broadcasts.length = 0;
    const entry = fakeEntry({ osName: 'Debian', osDetectedAt: null });
    await detectEntryOs(fakeSsh('', { fail: true }), entry);
    assert.equal(entry.osName, 'Debian');
    assert.ok(entry.osDetectedAt instanceof Date);
    assert.equal(broadcasts.length, 0);
});

test('every detected name is selectable as a snippet/script OS filter and filters as expected', async () => {
    const { OS_OPTIONS, matchesOsFilter } = await import('../client/src/common/utils/osUtils.js');
    const detectable = Object.keys(OS_NAMES_BY_ID).map(id => parseOsRelease(`ID=${id}`)).concat(parseOsRelease('ID=debian\nINFRA_W_PVE=1'));
    assert.deepEqual(OS_OPTIONS.map(option => option.value).sort(), [...new Set(detectable)].sort());

    assert.equal(matchesOsFilter('["Ubuntu"]', 'Ubuntu', false), true);
    assert.equal(matchesOsFilter('["Debian"]', 'Ubuntu', false), false);
    assert.equal(matchesOsFilter('[]', 'Ubuntu', false), true);
    assert.equal(matchesOsFilter('["Debian"]', null, false), true, 'undetected hosts still show OS-specific entries');
});
