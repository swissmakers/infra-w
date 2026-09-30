require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveProtocolAction } = require('../server/utils/netboxProtocol');
const { fetchPaginated } = require('../server/utils/netboxClient');

test('NetBox protocol changes use the correct port and renderer', () => {
    assert.deepEqual(resolveProtocolAction({ protocol: 'ssh', port: 2222, renderer: 'terminal' }, { protocol: 'rdp' }),
        { protocol: 'rdp', port: 3389, renderer: 'guac' });
    assert.deepEqual(resolveProtocolAction({ protocol: 'vnc' }), { protocol: 'vnc', port: 5900, renderer: 'guac' });
    assert.equal(resolveProtocolAction({ protocol: 'ssh', port: 2222 }, {}).port, 2222);
    assert.equal(resolveProtocolAction({}, { protocol: 'rdp', port: 3390 }).port, 3390);
    assert.throws(() => resolveProtocolAction({}, { protocol: 'invalid' }));
    assert.throws(() => resolveProtocolAction({}, { port: -1 }));
});

const client = pages => {
    const calls = [];
    return { calls, defaults: { baseURL: 'https://netbox.example' }, get: async url => {
        calls.push(url);
        return { data: pages[calls.length - 1] };
    }};
};

test('NetBox pagination accepts relative and same-origin absolute pages', async () => {
    const api = client([{ results: [{ id: 1 }], next: 'https://netbox.example/api/devices/?offset=1' }, { results: [{ id: 2 }], next: null }]);
    assert.deepEqual(await fetchPaginated(api, '/api/devices/'), [{ id: 1 }, { id: 2 }]);
});

test('NetBox pagination rejects token exfiltration and loops before the next request', async () => {
    for (const next of ['https://attacker.example/capture', '//attacker.example/capture', '/api/devices/']) {
        const api = client([{ results: [], next }]);
        await assert.rejects(fetchPaginated(api, '/api/devices/'));
        assert.equal(api.calls.length, 1);
    }
});

test('malformed inventory fails instead of becoming an empty destructive sync', async () => {
    for (const page of [null, {}, '<html>Login</html>', { results: {} }, { results: [], next: {} }]) {
        await assert.rejects(fetchPaginated(client([page]), '/api/devices/'), /invalid inventory page/);
    }
});

test('NetBox preserves installations hosted under a URL prefix', async () => {
    const api = client([{ results: [{ id: 1 }], next: '?offset=1' }, { results: [{ id: 2 }], next: null }]);
    api.defaults.baseURL = 'https://netbox.example/netbox';
    await fetchPaginated(api, '/api/devices/');
    assert.deepEqual(api.calls, ['https://netbox.example/netbox/api/devices/', 'https://netbox.example/netbox/api/devices/?offset=1']);
});
