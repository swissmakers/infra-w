const sshd = require("ssh2");
const { getIdentityCredentials, listIdentities } = require("../controllers/identity");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");
const { withHostKeyCheck } = require("./hostKeys");

const CONNECT_TIMEOUT = 30000;

const buildSSHOptions = (identity, credentials, entryConfig) => {
    const base = { host: entryConfig.ip, port: entryConfig.port, username: identity.username, tryKeyboard: true };

    if (identity.type === "password" || identity.type === "password-only") {
        return { ...base, password: credentials.password };
    }
    if (identity.type === "both") {
        return { 
            ...base, 
            privateKey: credentials["ssh-key"], 
            passphrase: credentials.passphrase,
            password: credentials.password,
            authHandler: (methodsLeft, partialSuccess, cb) => {
                if (methodsLeft === null) return cb('publickey');
                if (methodsLeft.includes('password') && partialSuccess) return cb('password');
                if (methodsLeft.includes('publickey') && !partialSuccess) return cb('publickey');
                if (methodsLeft.includes('password')) return cb('password');
                if (methodsLeft.includes('keyboard-interactive')) return cb('keyboard-interactive');
                return cb(false);
            }
        };
    }
    return { ...base, privateKey: credentials["ssh-key"], passphrase: credentials.passphrase };
};

const forwardToTarget = async (lastJumpConnection, targetEntry) => {
    return new Promise((resolve, reject) => {
        lastJumpConnection.ssh.forwardOut(
            "127.0.0.1", 0,
            targetEntry.config.ip, targetEntry.config.port,
            (err, stream) => {
                if (err) return reject(new Error(`Port forward to target failed: ${err.message}`));
                resolve(stream);
            },
        );
    });
};

const establishJumpHosts = async (jumpHostIds, accountId) => {
    const connections = [];
    const accessibleIds = new Set((await listIdentities(accountId)).map(i => i.id));

    try {
        for (let i = 0; i < jumpHostIds.length; i++) {
            const jumpEntry = await Entry.findByPk(jumpHostIds[i]);
            if (!jumpEntry || jumpEntry.config?.protocol !== "ssh") {
                throw new Error(`Jump host ${jumpHostIds[i]} not found or is not an SSH server`);
            }

            const entryIdentities = await EntryIdentity.findAll({
                where: { entryId: jumpEntry.id },
                order: [["isDefault", "DESC"]],
            });

            let jumpIdentity = null;
            for (const ei of entryIdentities) {
                if (!accessibleIds.has(ei.identityId)) continue;
                jumpIdentity = await Identity.findByPk(ei.identityId);
                if (jumpIdentity) break;
            }

            if (!jumpIdentity) throw new Error(`No accessible identity for jump host ${jumpEntry.name}`);

            const jumpCredentials = await getIdentityCredentials(jumpIdentity.id);

            const jumpSsh = new sshd.Client();
            const jumpOptions = buildSSHOptions(jumpIdentity, jumpCredentials, jumpEntry.config);
            const explainJumpError = withHostKeyCheck(jumpOptions, accountId);

            if (i > 0) {
                await new Promise((resolve, reject) => {
                    connections[i - 1].ssh.forwardOut(
                        "127.0.0.1", 0,
                        jumpEntry.config.ip, jumpEntry.config.port,
                        (err, stream) => {
                            if (err) return reject(new Error(`Port forward failed through ${connections[i - 1].entry.name}: ${err.message}`));
                            jumpOptions.sock = stream;
                            resolve();
                        },
                    );
                });
            }

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error(`Timeout connecting to ${jumpEntry.name}`)), CONNECT_TIMEOUT);
                jumpSsh.once("ready", () => {
                    clearTimeout(timeout);
                    resolve();
                });
                jumpSsh.once("error", (err) => {
                    clearTimeout(timeout);
                    reject(explainJumpError(err));
                });
                jumpSsh.connect(jumpOptions);
            });

            connections.push({ ssh: jumpSsh, entry: jumpEntry });
        }

        return connections;
    } catch (error) {
        connections.forEach(conn => conn.ssh.end());
        throw error;
    }
};

const PASSWORD_PROMPT = /pass|kennwort/i;

// a second password prompt means the password was rejected, so it goes to the user
const answerPrompts = (credentials, onPrompt) => {
    let passwordSent = false;
    return (name, instructions, lang, prompts, finish) => {
        if (!onPrompt) return finish(prompts.map(prompt => (!prompt.echo && credentials.password) || ""));

        const answers = prompts.map(prompt => (!passwordSent && credentials.password && PASSWORD_PROMPT.test(prompt.prompt) ? credentials.password : null));
        if (answers.some(answer => answer !== null)) passwordSent = true;
        const open = prompts.map((prompt, index) => ({ prompt: prompt.prompt, echo: Boolean(prompt.echo), index })).filter(({ index }) => answers[index] === null);
        if (!open.length) return finish(answers);

        onPrompt({ instructions: [name, instructions].filter(Boolean).join("\n"), prompts: open.map(({ prompt, echo }) => ({ prompt, echo })) })
            .then(given => open.forEach(({ index }, position) => { answers[index] = String(given?.[position] ?? ""); }), () => {})
            .finally(() => finish(answers.map(answer => answer ?? "")));
    };
};

const createSshClient = async (entry, identity, accountId, { onPrompt } = {}) => {
    const credentials = identity.isDirect && identity.directCredentials
        ? identity.directCredentials : await getIdentityCredentials(identity.id);
    const options = buildSSHOptions(identity, credentials, entry.config);
    const jumpHostIds = entry.config?.jumpHosts || [];
    const jumps = jumpHostIds.length ? await establishJumpHosts(jumpHostIds, accountId) : [];
    const closeJumps = () => jumps.forEach(conn => { try { conn.ssh.end(); } catch {} });

    try {
        if (jumps.length) options.sock = await forwardToTarget(jumps.at(-1), entry);
    } catch (error) {
        closeJumps();
        throw error;
    }

    const explainError = withHostKeyCheck(options, accountId);
    const ssh = new sshd.Client();
    // prepended so the callers' error handlers see why a host key was refused
    ssh.prependListener("error", explainError);
    ssh.on("keyboard-interactive", answerPrompts(credentials, onPrompt));
    ssh.on("close", closeJumps);
    ssh.connect(options);
    return ssh;
};

const waitForReady = (ssh, timeout = CONNECT_TIMEOUT) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ssh.end(); reject(new Error("SSH timeout")); }, timeout);
    ssh.once("ready", () => { clearTimeout(timer); resolve(ssh); });
    ssh.once("error", error => { clearTimeout(timer); reject(error); });
});

module.exports = { createSshClient, waitForReady, establishJumpHosts };
