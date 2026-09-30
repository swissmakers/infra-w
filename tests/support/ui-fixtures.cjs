const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { AUDIT_GROUPS, auditGroupOf } = require('../../server/utils/auditActions');

const baseURL = process.env.INFRA_W_PREVIEW_URL || 'http://127.0.0.1:4173';
const contextOptions = { viewport: { width: 1600, height: 1000 }, locale: 'en-US', timezoneId: 'Europe/Zurich', reducedMotion: 'reduce' };
const FIXTURE_NOW = Date.UTC(2026, 8, 26, 10, 0);
const minutesBefore = minutes => new Date(FIXTURE_NOW - minutes * 60000).toISOString();

const osNames = { 'edge-zrh-01': 'Rocky Linux', 'core-db-01': 'Debian', 'build-runner-04': 'Ubuntu', 'backup-node-01': 'Debian' };
const hosts = [
    ['edge-zrh-01', '10.24.1.10', 'ssh', 'online'], ['core-db-01', '10.24.2.21', 'ssh', 'online'],
    ['win-admin-01', '10.24.3.40', 'rdp', 'online'], ['build-runner-04', '10.24.4.14', 'ssh', 'offline'],
    ['console-lab-02', '10.24.5.22', 'vnc', 'online'], ['backup-node-01', '10.24.6.10', 'ssh', 'online'],
    ['win-files-02', '10.24.3.42', 'rdp', 'unknown'], ['console-lab-03', '10.24.5.23', 'vnc', 'online'],
].map(([name, ip, protocol, status], i) => ({ id: i + 1, type: 'server', name, ip, protocol, status,
    port: protocol === 'ssh' ? 22 : protocol === 'rdp' ? 3389 : 5900, renderer: protocol === 'ssh' ? 'terminal' : 'guac',
    icon: 'mdiServerOutline', identities: [1], tags: [], config: {}, osName: osNames[name] || null }));
const inventory = [{ id: 'org-1', type: 'organization', name: 'Operations', entries: [
    { id: 10, type: 'folder', name: 'Production', entries: hosts.slice(0, 4) },
    { id: 11, type: 'folder', name: 'Platform services', entries: hosts.slice(4) },
] }];
const user = { id: 1, username: 'operator', firstName: 'Alex', lastName: 'Morgan', role: 'admin', authProviderType: 'internal', impersonator: null,
    preferences: { theme: { mode: 'dark' }, general: { language: 'en' } } };
const identities = [{ id: 1, name: 'Operations SSH', username: 'operator', type: 'password' }];
const snippets = [
    ['Disk usage', 'df -hT -x tmpfs -x devtmpfs', 'Mounted filesystems without pseudo filesystems'],
    ['Failed units', 'systemctl --failed --no-pager', 'List units that failed to start'],
    ['Listening ports', 'ss -tulpn', 'Sockets waiting for connections'],
    ['Recent errors', 'journalctl -p err -b --no-pager | tail -n 50', 'Errors since the last boot'],
    ['Container status', 'podman ps --format "table {{.Names}}\\t{{.Status}}"', ''],
].map(([name, command, description], i) => ({ id: i + 1, name, command, description, organizationId: null }));
const scripts = [{ id: 1, name: 'Patch host', description: 'Apply security updates and report pending reboots',
    content: '#!/bin/bash\n@INFRA-W:CONFIRM "Install security updates now?"\ndnf -y upgrade --security', organizationId: null }];
const hostKeys = [
    { id: 2, host: '10.24.2.21', port: 22, keyType: 'ssh-ed25519', fingerprint: 'SHA256:4Qm1c0yqH7pXg9v2c5ZbV1k8sT3wRr6nYd0aLfPjE2U',
        pendingKeyType: 'ssh-ed25519', pendingFingerprint: 'SHA256:Zx9TqL2mV8bN4cR7wK1pY6hD3sF0gJ5uA8eO2iQ4vXk', pendingSeenAt: minutesBefore(15),
        firstSeenAt: minutesBefore(40000), lastSeenAt: minutesBefore(120), servers: ['core-db-01'] },
    { id: 1, host: '10.24.1.10', port: 22, keyType: 'ssh-ed25519', fingerprint: 'SHA256:mB7vQ2xK9pL4cN8rT1wY6hD3sF0gJ5uA8eO2iZ4vXk0',
        pendingKeyType: null, pendingFingerprint: null, pendingSeenAt: null, firstSeenAt: minutesBefore(50000), lastSeenAt: minutesBefore(5), servers: ['edge-zrh-01'] },
];
const members = [
    { accountId: 1, name: 'Alex Morgan', username: 'operator', role: 'owner', status: 'active' },
    { accountId: 2, name: 'Jana Keller', username: 'j.keller', role: 'member', status: 'active' },
];
const userSessions = [
    { id: 11, accountId: 1, ip: '10.20.0.5', userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
        lastActivity: minutesBefore(1), createdAt: minutesBefore(300), current: true, impersonator: null,
        account: { id: 1, username: 'operator', firstName: 'Alex', lastName: 'Morgan' } },
    { id: 12, accountId: 2, ip: '10.20.0.17', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        lastActivity: minutesBefore(25), createdAt: minutesBefore(1440), current: false, impersonator: null,
        account: { id: 2, username: 'j.keller', firstName: 'Jana', lastName: 'Keller' } },
];

const auditLog = (id, minutesAgo, action, actorUsername, resourceName, details = {}, resource = 'entry') => ({
    id, action, category: auditGroupOf(action), timestamp: minutesBefore(30 + minutesAgo), actorUsername, resource, resourceName, ipAddress: `10.0.0.${10 + id}`,
    organizationId: 1, organizationName: 'Operations', details });
// the smoke test replays the recordings of rows 1 and 2 in this order
const auditLogs = [
    auditLog(1, 4, 'entry.ssh_connect', 'operator', 'edge-zrh-01', { hasRecording: true, recordingType: 'cast', connectionReason: 'CHG-4182 nginx upgrade' }),
    auditLog(2, 22, 'entry.rdp_connect', 'operator', 'win-admin-01', { hasRecording: true, recordingType: 'guac' }),
    auditLog(3, 41, 'entry.sftp_connect', 'j.keller', 'core-db-01'),
    auditLog(4, 58, 'file.upload', 'j.keller', 'core-db-01', { path: '/etc/postgresql/16/main/pg_hba.conf' }),
    auditLog(5, 95, 'identity.credentials_access', 'm.frei', 'Operations SSH', {}, 'identity'),
    auditLog(6, 130, 'identity.update', 'operator', 'Operations SSH', {}, 'identity'),
    auditLog(7, 210, 'entry.ssh_connect', 'm.frei', 'backup-node-01'),
    auditLog(8, 305, 'script.execute', 'operator', 'build-runner-04', { scriptName: 'Patch host' }),
];
const recording = [
    { version: 2, width: 100, height: 24, timestamp: 1790000000 },
    [0.1, 'o', '\u001b[32moperator@edge-zrh-01\u001b[0m:\u001b[34m~\u001b[0m$ systemctl status nginx\r\n'],
    [0.6, 'o', [
        '\u001b[32m●\u001b[0m nginx.service - The nginx HTTP and reverse proxy server',
        '     Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: disabled)',
        '     Active: \u001b[32mactive (running)\u001b[0m since Fri 2026-09-26 08:12:03 CEST; 1h 18min ago',
        '   Main PID: 1184 (nginx)',
        '      Tasks: 5 (limit: 48912)',
        '     Memory: 9.8M',
        '     CGroup: /system.slice/nginx.service',
        '             ├─1184 "nginx: master process /usr/sbin/nginx"',
        '             └─1185 "nginx: worker process"',
        '',
    ].join('\r\n') + '\r\n'],
    [2.4, 'o', '\u001b[32moperator@edge-zrh-01\u001b[0m:\u001b[34m~\u001b[0m$ sudo nginx -t\r\n'],
    [3.1, 'o', 'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\r\nnginx: configuration file /etc/nginx/nginx.conf test is successful\r\n'],
    [4.2, 'o', '\u001b[32moperator@edge-zrh-01\u001b[0m:\u001b[34m~\u001b[0m$ sudo systemctl reload nginx\r\n'],
    [8, 'o', '\u001b[32moperator@edge-zrh-01\u001b[0m:\u001b[34m~\u001b[0m$ '],
];
const terminalTranscript = [
    'Rocky Linux 9.6 (Blue Onyx) - edge-zrh-01',
    'Last login: Fri Sep 26 08:02:11 2026 from 10.0.0.12',
    '',
    '\u001b[32moperator@edge-zrh-01\u001b[0m:\u001b[34m~\u001b[0m$ podman ps --format "table {{.Names}}\\t{{.Status}}"',
    'NAMES           STATUS',
    'nginx-edge      Up 3 days',
    'haproxy         Up 3 days',
    'node-exporter   Up 12 days',
    '\u001b[32moperator@edge-zrh-01\u001b[0m:\u001b[34m~\u001b[0m$ ',
].join('\r\n');

const integrations = [
    { id: 1, name: 'NetBox Zurich DC', type: 'netbox', status: 'online', lastSyncAt: minutesBefore(12), lastSyncMessage: 'Imported 42 devices and 18 virtual machines' },
    { id: 2, name: 'Proxmox pve-zrh', type: 'proxmox', status: 'online', lastSyncAt: minutesBefore(47), lastSyncMessage: 'Imported 3 nodes and 27 guests' },
];

const SFTP = { READY: 0x0, LIST_FILES: 0x1, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA, RESOLVE_PATH: 0xB };
const MODIFIED = Date.UTC(2026, 8, 25, 14, 0) / 1000;
const entry = (name, type, size = 4096, daysAgo = 0) => ({ name, type, isSymlink: false, size,
    last_modified: MODIFIED - daysAgo * 86400, mode: type === 'folder' ? 0o40755 : 0o100644 });
const remoteFiles = {
    '/srv/www': [entry('.well-known', 'folder', 4096, 40), entry('assets', 'folder', 4096, 2), entry('config', 'folder', 4096, 6),
        entry('releases', 'folder', 4096, 1), entry('.env', 'file', 214, 6), entry('architecture.svg', 'file', 1840, 3),
        entry('deploy.sh', 'file', 1320, 1), entry('nginx.conf', 'file', 2410, 2), entry('topology.svg', 'file', 1510, 5)],
    '/srv/www/.well-known': [entry('acme-challenge', 'folder', 4096, 40)],
    '/srv/www/assets': [entry('css', 'folder'), entry('img', 'folder')],
    '/srv/www/config': [entry('sites-enabled', 'folder', 4096, 6)],
    '/srv/www/releases': [entry('2026-09-24', 'folder', 4096, 2), entry('2026-09-25', 'folder', 4096, 1)],
};
const svgDiagram = (title, boxes) => `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" font-family="sans-serif">
<rect width="640" height="360" fill="#f8f8f8"/><text x="24" y="40" font-size="20" fill="#00204b">${title}</text>
${boxes.map(([label, x, y], i) => `<rect x="${x}" y="${y}" width="160" height="64" fill="#fff" stroke="#2a5bd6" stroke-width="2"/>
<text x="${x + 80}" y="${y + 38}" text-anchor="middle" font-size="15" fill="#00204b">${label}</text>${i ? `<line x1="${boxes[i - 1][1] + 160}" y1="${boxes[i - 1][2] + 32}" x2="${x}" y2="${y + 32}" stroke="#4a5870" stroke-width="2"/>` : ''}`).join('\n')}
</svg>`;
const remoteFileContents = {
    '/srv/www/architecture.svg': ['image/svg+xml', svgDiagram('Edge architecture', [['Clients', 24, 150], ['nginx-edge', 240, 150], ['App cluster', 456, 150]])],
    '/srv/www/topology.svg': ['image/svg+xml', svgDiagram('Network topology', [['DMZ', 24, 90], ['Core', 240, 150], ['Backup', 456, 210]])],
    '/srv/www/nginx.conf': ['text/plain', 'server {\n    listen 443 ssl;\n    server_name edge.example.com;\n\n    location / {\n        proxy_pass http://app_cluster;\n        proxy_set_header Host $host;\n    }\n}\n'],
};
const sftpFrame = (operation, payload) => Buffer.concat([Buffer.from([operation]), Buffer.from(JSON.stringify(payload))]);
const searchRemoteDirectories = searchPath => {
    const base = searchPath.endsWith('/') ? searchPath.replace(/\/$/, '') || '/' : searchPath.slice(0, searchPath.lastIndexOf('/')) || '/';
    const term = searchPath.endsWith('/') ? '' : searchPath.slice(searchPath.lastIndexOf('/') + 1).toLowerCase();
    return (remoteFiles[base] || []).filter(item => item.type === 'folder' && item.name.toLowerCase().startsWith(term))
        .map(item => `${base === '/' ? '' : base}/${item.name}`).sort();
};

const resolveRemotePath = path => {
    if (remoteFiles[path]) return { path, isDirectory: true, size: 4096 };
    const folder = path.slice(0, path.lastIndexOf('/')) || '/';
    const entry = (remoteFiles[folder] || []).find(item => item.name === path.slice(path.lastIndexOf('/') + 1));
    return entry ? { path, isDirectory: entry.type === 'folder', size: entry.size } : null;
};

async function installFixtures(context) {
    const fixture = { user: structuredClone(user), inventory, recentFails: false, signedIn: true, connectionSucceeds: false,
        liveConnections: [], requests: [], terminalSockets: 0, terminalMessages: [], kellerLocked: false, userSessions: structuredClone(userSessions),
        hostKeys: structuredClone(hostKeys), members: structuredClone(members), tokens: [],
        notifications: { webhookUrl: null, webhookEvents: [], hasSecret: false,
            events: ['backup.failed', 'integration.sync_failed', 'integration.removals_held', 'hosts.offline', 'hosts.online'] } };
    fixture.emit = (type, data) => stateSocket?.send(JSON.stringify({ type, data }));
    let stateSocket;
    await context.addInitScript(() => localStorage.setItem('sessionToken', 'fixture-token'));
    await context.route('**/api/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        fixture.requests.push({ path: url.pathname, method: request.method(), body: request.postDataJSON?.() });
        let data = [];
        let status = 200;
        if (url.pathname === '/api/accounts/me') {
            data = request.headers().authorization === 'Bearer impersonation-token'
                ? { ...fixture.user, id: 2, username: 'j.keller', firstName: 'Jana', lastName: 'Keller', role: 'user', impersonator: { id: 1, name: 'Alex Morgan' } }
                : fixture.user;
            if (!fixture.signedIn) { status = 401; data = { message: 'Unauthorized' }; }
        }
        else if (url.pathname === '/api/users/list') data = { users: [{ ...fixture.user, passkeys: 0, disabled: false },
            { id: 2, username: 'j.keller', firstName: 'Jana', lastName: 'Keller', role: 'user', totpEnabled: false, passkeys: 1, disabled: fixture.kellerLocked }], total: 2 };
        else if (url.pathname === '/api/users/2/lock') { fixture.kellerLocked = request.postDataJSON().locked; data = { message: 'ok' }; }
        else if (url.pathname === '/api/users/sessions') data = fixture.userSessions;
        else if (url.pathname === '/api/users/tokens') data = fixture.tokens.map(token => ({ ...token, account: { id: 1, username: 'operator', firstName: 'Alex', lastName: 'Morgan' } }));
        else if (url.pathname === '/api/tokens' && request.method() === 'PUT') {
            const body = request.postDataJSON();
            const token = { id: fixture.tokens.length + 1, accountId: 1, name: body.name, scope: body.scope, prefix: 'infw_Fx7q2mZ',
                expiresAt: new Date(FIXTURE_NOW + body.days * 86400000).toISOString(), lastUsedAt: null, createdAt: minutesBefore(0) };
            fixture.tokens.push(token);
            data = { ...token, token: 'infw_Fx7q2mZfixtureOnlyTokenValueNotReal0123456789' };
        }
        else if (url.pathname === '/api/tokens') data = fixture.tokens;
        else if (/^\/api\/tokens\/\d+$/.test(url.pathname)) { fixture.tokens = fixture.tokens.filter(token => token.id !== Number(url.pathname.split('/').pop())); data = { message: 'ok' }; }
        else if (url.pathname === '/api/host-keys') data = fixture.hostKeys;
        else if (/^\/api\/host-keys\/\d+\/accept$/.test(url.pathname)) {
            const key = fixture.hostKeys.find(k => k.id === Number(url.pathname.split('/')[3]));
            Object.assign(key, { fingerprint: key.pendingFingerprint, pendingKeyType: null, pendingFingerprint: null, pendingSeenAt: null });
            data = { message: 'ok' };
        }
        else if (url.pathname === '/api/settings/notifications' && request.method() === 'PATCH') {
            const { webhookSecret, ...body } = request.postDataJSON();
            fixture.notifications = { ...fixture.notifications, ...body, hasSecret: webhookSecret === undefined ? fixture.notifications.hasSecret : Boolean(webhookSecret) };
            data = fixture.notifications;
        }
        else if (url.pathname === '/api/settings/notifications') data = fixture.notifications;
        else if (url.pathname === '/api/settings/notifications/test') data = { success: true };
        else if (url.pathname === '/api/organizations/1/members' && request.method() === 'GET') data = fixture.members;
        else if (url.pathname === '/api/organizations/1/members/2' && request.method() === 'PATCH') {
            fixture.members[1].role = request.postDataJSON().role;
            data = { accountId: 2, role: fixture.members[1].role };
        }
        else if (/^\/api\/connections\/[^/]+\/share$/.test(url.pathname) && request.method() === 'POST') {
            data = { shareId: 'a1b2c3d4e5f60718', writable: request.postDataJSON().writable, expiresAt: Date.now() + request.postDataJSON().hours * 3600000 };
        }
        else if (url.pathname.startsWith('/api/connections/prompts/')) {
            fixture.emit('CONNECTION_PROMPT_DONE', { id: url.pathname.split('/').pop() });
            data = { success: true };
        }
        else if (url.pathname === '/api/integrations/1/preview') data = { create: ['edge-new-01'], update: hosts.slice(0, 5).map(h => h.name),
            remove: ['legacy-01', 'legacy-02'], removalsNeedReview: false };
        else if (/^\/api\/users\/sessions\/\d+$/.test(url.pathname)) {
            fixture.userSessions = fixture.userSessions.filter(session => session.id !== Number(url.pathname.split('/').pop()));
            data = { message: 'ok' };
        }
        else if (url.pathname === '/api/users/2/login') data = { token: 'impersonation-token' };
        else if (url.pathname === '/api/service/is-fts') data = false;
        else if (url.pathname === '/api/service/version') data = { version: require('../../package.json').version };
        else if (url.pathname === '/api/auth/providers/admin') data = { oidc: [{ id: 1, name: 'Internal authentication', isInternal: true, enabled: true }], ldap: [] };
        else if (url.pathname === '/api/auth/providers/admin/ldap/test') data = { success: true, message: 'Fixture directory verified', diagnostics: { host: request.postDataJSON().host, port: 636, useTLS: true, searchProbe: { attempted: true, success: true } } };
        else if (url.pathname === '/api/auth/providers') data = [{ id: 1, isInternal: true, enabled: true }];
        else if (url.pathname === '/api/settings') data = { sessionIdleHours: 12, sessionMaxDays: 30, auditRetentionDays: null, ...request.postDataJSON?.() };
        else if (url.pathname === '/api/entries/list') data = fixture.inventory;
        else if (url.pathname === '/api/entries/recent') {
            status = fixture.recentFails ? 503 : 200;
            data = fixture.recentFails ? { message: 'History unavailable' } : [hosts[1], hosts[2], hosts[0]].map((h, i) => ({ entryId: h.id, name: h.name, timestamp: minutesBefore((i + 1) * 60), identities: [1] }));
        }
        else if (url.pathname === '/api/entries/sftp' && request.method() === 'GET') {
            const [contentType, body] = remoteFileContents[url.searchParams.get('path')] || ['text/plain', ''];
            await route.fulfill({ contentType, body });
            return;
        }
        else if (url.pathname === '/api/organizations') data = [{ id: 1, name: 'Operations', role: 'owner' }];
        else if (url.pathname === '/api/identities' || url.pathname === '/api/identities/list') data = identities;
        else if (url.pathname === '/api/snippets/all') data = snippets;
        else if (url.pathname === '/api/scripts/all') data = scripts;
        else if (url.pathname === '/api/connections' && request.method() === 'POST') {
            if (fixture.connectionSucceeds) {
                data = { sessionId: 'fixture-live' };
                fixture.liveConnections = [{ sessionId: 'fixture-live', entryId: 1, configuration: { identityId: 1 }, isHibernated: false }];
                stateSocket?.send(JSON.stringify({ type: 'CONNECTIONS', data: fixture.liveConnections }));
            }
            else { status = 503; data = { code: 503, message: 'Fixture connection unavailable' }; }
        }
        else if (url.pathname === '/api/audit/logs') {
            const [category, action] = ['category', 'action'].map(key => url.searchParams.get(key));
            const logs = auditLogs.filter(log => (!category || log.category === category) && (!action || log.action === action));
            data = { logs, total: logs.length };
        }
        else if (url.pathname === '/api/audit/organizations/1/settings') data = { enableSessionRecording: true, recordingRetentionDays: 90,
            requireConnectionReason: true, ...Object.fromEntries(Object.values(AUDIT_GROUPS).filter(group => group.setting).map(group => [group.setting, true])) };
        else if (url.pathname === '/api/audit/1/recording') {
            await route.fulfill({ contentType: 'application/x-asciicast', body: recording.map(line => JSON.stringify(line)).join('\n') + '\n' });
            return;
        }
        else if (url.pathname === '/api/audit/2/recording') {
            await route.fulfill({ contentType: 'application/octet-stream', body: '4.size,1.0,2.80,2.24;4.sync,1.0;4.size,1.0,3.160,2.48;4.sync,4.1000;' });
            return;
        }
        else if (url.pathname === '/api/integrations/list') data = integrations;
        else if (url.pathname === '/api/integrations/1') data = { id: 1, type: 'netbox', name: 'NetBox Zurich DC', apiUrl: 'https://netbox.example.com',
            verifyTls: true, syncIntervalMinutes: 15, defaultAction: { protocol: 'ssh', port: 22 }, protocolRules: [] };
        else if (url.pathname === '/api/integrations/1/sync-status') data = { integrationId: 1, type: 'netbox', status: 'online',
            lastSyncAt: integrations[0].lastSyncAt, lastSyncStatus: 'ok', lastSyncMessage: integrations[0].lastSyncMessage };
        else if (url.pathname === '/api/organizations/1' && request.method() === 'PATCH') data = { id: 1, ...request.postDataJSON() };
        else if (url.pathname === '/api/audit/metadata') data = { categories: Object.entries(AUDIT_GROUPS).map(([key, group]) => ({ key, actions: group.actions })),
            actors: [{ id: 1, label: 'operator' }, { id: 2, label: 'j.keller' }], organizations: [{ id: 1, name: 'Operations' }] };
        else if (url.pathname === '/api/audit/export') {
            await route.fulfill({ contentType: 'text/csv', body: 'timestamp,actor,action\r\n' });
            return;
        }
        else if (url.pathname === '/api/backup/settings') data = { providers: [{ id: 'nas', name: 'NAS Zurich', type: 'smb', share: '//nas01/backup',
            folder: 'infra-w', username: 'backup', domain: 'CORP', hasPassword: true }], scheduleInterval: 24, retention: 5,
            includeDatabase: true, includeRecordings: true, includeLogs: false };
        else if (url.pathname === '/api/backup/storage') data = { database: 1122304, recordings: 52428800, logs: 73728 };
        else if (url.pathname === '/api/backup/providers/nas/backups') data = [{ name: 'backup-2026-09-29T02-00-00-000Z.tar.gz', size: 48234496, created: minutesBefore(600) }];
        else if (/\/api\/entries\/\d+$/.test(url.pathname)) {
            const host = hosts.find(h => h.id === Number(url.pathname.split('/').pop()));
            data = host && { ...host, config: { ip: host.ip, port: host.port, protocol: host.protocol } };
        }
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await context.routeWebSocket('**/api/ws/**', ws => {
        if (ws.url().includes('/term')) {
            fixture.terminalSockets++;
            ws.send(terminalTranscript);
            ws.onMessage(message => fixture.terminalMessages.push(String(message)));
            return;
        }
        if (ws.url().includes('/sftp')) {
            ws.send(sftpFrame(SFTP.READY, { initialPath: '/srv/www' }));
            ws.onMessage(message => {
                const operation = message[0], payload = JSON.parse(message.subarray(1).toString() || '{}');
                if (operation === SFTP.LIST_FILES) ws.send(sftpFrame(operation, { files: remoteFiles[payload.path] ?? [] }));
                if (operation === SFTP.SEARCH_DIRECTORIES) ws.send(sftpFrame(operation, { directories: searchRemoteDirectories(payload.searchPath) }));
                if (operation === SFTP.RESOLVE_PATH) {
                    const resolved = resolveRemotePath(payload.path);
                    ws.send(resolved ? sftpFrame(operation, resolved) : sftpFrame(SFTP.ERROR, { message: 'No such file', operation: SFTP.RESOLVE_PATH }));
                }
            });
            return;
        }
        if (!ws.url().includes('/state')) { ws.close(); return; }
        stateSocket = ws;
        const send = () => {
            for (const [type, data] of Object.entries({ ENTRIES: fixture.inventory, IDENTITIES: identities, CONNECTIONS: fixture.liveConnections, SNIPPETS: snippets, SCRIPTS: scripts })) ws.send(JSON.stringify({ type, data }));
        };
        send();
        ws.onMessage(send);
    });
    return fixture;
}

module.exports = { baseURL, chromium, contextOptions, installFixtures, FIXTURE_NOW };
