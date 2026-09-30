const Account = require("../models/Account");
const Session = require("../models/Session");
const { verifyAccountTotp } = require("../utils/totp");
const crypto = require("crypto");
const { compare, hash } = require("bcrypt");
const OIDCProvider = require("../models/OIDCProvider");
const { authenticateUser: ldapAuth, getEnabledProvider: getLdapProvider } = require("./ldap");
const logger = require("../utils/logger");
const { revokeSessions, createSignInSession, refuseLockedAccount } = require("../utils/sessionAuth");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("./audit");

// unknown usernames cost the same bcrypt work, so the answer time does not reveal which accounts exist
let unknownAccountHash;
const compareUnknownAccount = async (password) => {
    unknownAccountHash ??= await hash(crypto.randomBytes(16).toString("hex"), 10);
    await compare(password, unknownAccountHash);
};

module.exports.login = async (configuration, user) => {
    const internalProvider = await OIDCProvider.findOne({ where: { isInternal: true, enabled: true } });
    const ldapProvider = await getLdapProvider();

    if (!internalProvider && !ldapProvider) {
        return { code: 403, message: "No login method is enabled" };
    }

    if (ldapProvider) {
        const ldapResult = await ldapAuth(configuration.username, configuration.password, user, configuration.code);
        if (ldapResult) return ldapResult;
        return { code: 201, message: "Username or password incorrect" };
    }

    const account = await Account.findOne({ where: { username: configuration.username } });

    if (account === null) {
        await compareUnknownAccount(String(configuration.password));
        return { code: 201, message: "Username or password incorrect" };
    }

    const failed = reason => createAuditLog({ accountId: account.id, action: AUDIT_ACTIONS.SIGN_IN_FAILED, resource: RESOURCE_TYPES.ACCOUNT,
        resourceId: account.id, details: { method: "password", reason }, ipAddress: user.ip, userAgent: user.userAgent });

    if (!(await compare(configuration.password, account.password))) {
        await failed("password");
        return { code: 201, message: "Username or password incorrect" };
    }

    const locked = await refuseLockedAccount(account, { ip: user.ip, userAgent: user.userAgent, method: "password" });
    if (locked) return locked;

    const totpError = verifyAccountTotp(account, configuration.code);
    if (totpError) {
        // a missing code is the prompt step, not a failed attempt
        if (configuration.code) await failed("two_factor");
        return totpError;
    }

    const session = await createSignInSession(account, { ip: user.ip, userAgent: user.userAgent, method: "password" });

    return { token: session.token, totpRequired: account.totpEnabled };
};

module.exports.logout = async token => {
    const session = await Session.findOne({ where: { token } });

    if (session === null)
        return { code: 204, message: "Your session token is invalid" };

    logger.system(`User logged out`, { accountId: session.accountId });

    await revokeSessions([session]);
    await createAuditLog({ accountId: session.impersonatorId || session.accountId, action: AUDIT_ACTIONS.SIGN_OUT,
        resource: RESOURCE_TYPES.ACCOUNT, resourceId: session.accountId, details: session.impersonatorId ? { endedImpersonation: true } : {} });
};
