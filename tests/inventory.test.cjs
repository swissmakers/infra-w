const { test } = require('node:test');
const assert = require('node:assert/strict');

test('inventory helpers retain organization ownership for nested Proxmox entries', async () => {
    const { flattenEntries, findOrganizationForServer, getOrganizationId } = await import('../client/src/common/utils/inventory.js');
    const entries = [{ id: 'org-7', type: 'organization', entries: [{ id: 12, type: 'folder', entries: [{ id: 3, type: 'pve-lxc' }] }] }];
    assert.equal(getOrganizationId(findOrganizationForServer('3', entries)), 7);
    assert.deepEqual(flattenEntries(entries)[0]._path.map(e => e.id), ['org-7', 12]);
    assert.deepEqual(flattenEntries([{ type: 'folder' }]), []);
    assert.equal(getOrganizationId(null), null);
});

test('HTTP and state-stream updates cannot create duplicate session tabs', async () => {
    const { upsertSession } = await import('../client/src/common/utils/sessionState.js');
    const sessions = upsertSession([{ id: 'one', server: 3 }], { id: 'one', scriptName: 'Health check' });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].server, 3);
    assert.equal(sessions[0].scriptName, 'Health check');
    assert.equal(upsertSession(sessions, { id: 'two' }).length, 2);
});

test('inventory search narrows as the query grows and never broadens to unrelated hosts', async () => {
    const { filterInventory, flattenEntries } = await import('../client/src/common/utils/inventory.js');
    const host = (id, name, ip, protocol, tags = []) => ({ id, type: 'server', name, ip, protocol, tags });
    const entries = [
        { id: 'org-1', type: 'organization', name: 'Operations', entries: [
            { id: 1, type: 'folder', name: 'Production', entries: [{ ...host(1, 'web-prod-01', '10.0.7.11', 'ssh'), osName: 'Ubuntu' }, host(2, 'web-prod-02', '10.0.7.12', 'ssh', [{ id: 9, name: 'dmz' }])] },
        ] },
        { id: 2, type: 'folder', name: 'Lab', entries: [host(3, 'web-stage-01', '10.0.8.11', 'ssh'), host(4, 'win-admin-01', '10.0.3.40', 'rdp')] },
    ];
    const names = (query, tags) => flattenEntries(filterInventory(entries, query, tags)).map(e => e.name);
    let previous = names('');
    for (const query of ['w', 'we', 'web', 'web-', 'web-p', 'web-prod', 'web-prod-0', 'web-prod-02']) {
        const current = names(query);
        assert.ok(current.every(name => previous.includes(name)), `"${query}" must not add hosts`);
        previous = current;
    }
    assert.deepEqual(previous, ['web-prod-02']);
    assert.deepEqual(names('web-prod-021'), []);
    assert.deepEqual(names('10.0.3'), ['win-admin-01']);
    assert.deepEqual(names('RDP'), ['win-admin-01']);
    assert.deepEqual(names('production 02'), ['web-prod-02']);
    assert.deepEqual(names('dmz'), ['web-prod-02']);
    assert.deepEqual(names('ubuntu'), ['web-prod-01']);
    assert.deepEqual(names('', [9]), ['web-prod-02']);
    assert.deepEqual(filterInventory(entries, 'lab').map(e => e.id), [2], 'folder ids must not collide with host ids');
    assert.deepEqual(filterInventory(null, 'x'), []);
});
