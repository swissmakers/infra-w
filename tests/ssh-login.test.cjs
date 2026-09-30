const { stub } = require('./support/isolate.cjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const { Server, utils } = require('ssh2');

const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } });
require.cache[require.resolve('../server/utils/database')] = { exports: db };
process.env.ENCRYPTION_KEY = '6'.repeat(64);

const notified = [];
stub('../server/lib/StateBroadcaster', Object.assign({ notify: (accountId, type, data) => notified.push({ accountId, type, data }) },
    { EVENT_TYPES: { CONNECTION_FAILED: 'CONNECTION_FAILED', CONNECTION_PROMPT: 'CONNECTION_PROMPT', CONNECTION_PROMPT_DONE: 'CONNECTION_PROMPT_DONE' } }));

require('../server/models/Integration');
const { createSshClient, waitForReady } = require('../server/utils/sshClient');
const { askAccount, answerPrompt } = require('../server/utils/connectionPrompts');
const HostKey = require('../server/models/HostKey');

const hostKey = utils.generateKeyPairSync('ed25519').private;
const otherKey = utils.generateKeyPairSync('ed25519').private;
const startServer = key => new Promise(resolve => {
    const server = new Server({ hostKeys: [key] }, client => {
        client.on('authentication', ctx => {
            if (ctx.method !== 'keyboard-interactive') return ctx.reject(['keyboard-interactive']);
            ctx.prompt([{ prompt: 'Password: ', echo: false }, { prompt: 'Verification code: ', echo: false }], 'Login', (answers) => {
                if (answers[0] === 's3cret' && answers[1] === '123456') ctx.accept();
                else ctx.reject();
            });
        }).on('ready', () => client.end()).on('error', () => {});
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
});

let server;
const entry = () => ({ id: 1, name: 'lab', config: { ip: '127.0.0.1', port: server.address().port } });
const identity = { isDirect: true, type: 'password', username: 'operator', directCredentials: { password: 's3cret' } };
const nextPrompt = async () => {
    for (let i = 0; i < 100; i++) {
        const prompt = notified.find(event => event.type === 'CONNECTION_PROMPT');
        if (prompt) return prompt;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('no prompt was relayed');
};
const connect = (options) => createSshClient(entry(), identity, 7, options).then(ssh => waitForReady(ssh, 5000).finally(() => ssh.end()));

before(async () => {
    await db.sync();
    server = await startServer(hostKey);
});
after(() => server.close());

test('the password is answered automatically, a one-time code by the user', async () => {
    const onPrompt = request => askAccount(7, { title: 'lab', ...request });
    const connecting = connect({ onPrompt });
    const prompt = await nextPrompt();
    assert.deepEqual(prompt.data.prompts, [{ prompt: 'Verification code: ', echo: false }], 'the password prompt is not relayed');
    assert.equal(answerPrompt(8, prompt.data.id, { answers: ['123456'] }).code, 404, 'another account cannot answer');
    assert.deepEqual(answerPrompt(7, prompt.data.id, { answers: ['123456'] }), { success: true });
    await connecting;
    assert.ok(notified.some(event => event.type === 'CONNECTION_PROMPT_DONE' && event.data.id === prompt.data.id));
    assert.equal(await HostKey.count(), 1, 'the host key was trusted on first use');
});

test('a wrong or cancelled code fails the login', async () => {
    notified.length = 0;
    const connecting = connect({ onPrompt: request => askAccount(7, { title: 'lab', ...request }) });
    const failed = assert.rejects(connecting, /authentication methods failed/);
    answerPrompt(7, (await nextPrompt()).data.id, { cancel: true });
    await failed;
});

test('a server presenting another host key is refused with the reason', async () => {
    server.close();
    server = await startServer(otherKey);
    // another port makes it a new host, so move the trusted key over first
    await HostKey.update({ port: server.address().port }, { where: {} });
    await assert.rejects(connect({ onPrompt: async () => ['123456'] }), /has changed .* Settings → Host keys/);
});
