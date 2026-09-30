const { Op } = require("sequelize");
const Session = require("../models/Session");
const Account = require("../models/Account");
const { getSystemSettings } = require("../controllers/systemSettings");
const stateBroadcaster = require("../lib/StateBroadcaster");
const SessionManager = require("../lib/SessionManager");
const logger = require("./logger");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const HOUR = 60 * 60 * 1000;
const ACTIVITY_WRITE_INTERVAL = 60 * 1000;
const lastActivityWrites = new Map();

const isExpired = (session, { sessionIdleHours, sessionMaxDays }, now = Date.now()) =>
    now - new Date(session.lastActivity).getTime() > sessionIdleHours * HOUR
    || now - new Date(session.createdAt).getTime() > sessionMaxDays * 24 * HOUR;

const touchSession = async (sessionId, ip = null) => {
    const now = Date.now();
    if (!ip && now - (lastActivityWrites.get(sessionId) || 0) < ACTIVITY_WRITE_INTERVAL) return;
    lastActivityWrites.set(sessionId, now);
    await Session.update({ lastActivity: new Date(now), ...(ip && { ip }) }, { where: { id: sessionId } });
};

// call after the credentials are verified, so only someone who knows them learns about the lock
const refuseLockedAccount = async (account, { ip, userAgent, method }) => {
    if (!account?.disabled) return null;
    await createAuditLog({ accountId: account.id, action: AUDIT_ACTIONS.SIGN_IN_FAILED, resource: RESOURCE_TYPES.ACCOUNT,
        resourceId: account.id, details: { method, reason: "locked" }, ipAddress: ip, userAgent });
    return { code: 205, message: "This account is locked" };
};

// never demotes the last admin, a renamed group or wrong claim would lock everyone out of the settings
const directoryRole = async (account, role) => {
    if (role !== "user" || account?.role !== "admin") return role;
    if (await Account.count({ where: { role: "admin", disabled: false } }) > 1) return role;
    logger.warn("A directory sign-in would demote the last administrator; the role is kept", { accountId: account.id });
    return null;
};

const createSignInSession = async (account, { ip, userAgent, method, impersonatorId = null }) => {
    const session = await Session.create({ accountId: account.id, ip: ip || "unknown", userAgent: userAgent || "unknown", impersonatorId });
    logger.system(`User ${account.username} signed in`, { accountId: account.id, ip, method });
    await createAuditLog(impersonatorId
        ? { accountId: impersonatorId, action: AUDIT_ACTIONS.IMPERSONATE, resource: RESOURCE_TYPES.ACCOUNT, resourceId: account.id,
            details: { username: account.username }, ipAddress: ip, userAgent }
        : { accountId: account.id, action: AUDIT_ACTIONS.SIGN_IN, resource: RESOURCE_TYPES.ACCOUNT, resourceId: account.id,
            details: { method }, ipAddress: ip, userAgent });
    return session;
};

const resolveSession = async (token, { ip = null } = {}) => {
    if (!token || typeof token !== "string") return null;

    const session = await Session.findOne({ where: { token } });
    if (!session) return null;

    if (isExpired(session, await getSystemSettings())) {
        await revokeSessions([session]);
        return null;
    }

    const account = await Account.findByPk(session.accountId);
    if (!account) return null;
    if (account.disabled) {
        await revokeSessions([session]);
        return null;
    }

    await touchSession(session.id, ip !== session.ip ? ip : null);
    return { session, account };
};

const revokeSessions = async (sessions) => {
    if (sessions.length === 0) return;
    await Session.destroy({ where: { id: { [Op.in]: sessions.map(session => session.id) } } });
    sessions.forEach(session => {
        lastActivityWrites.delete(session.id);
        stateBroadcaster.forceLogoutSession(session.id);
    });
    for (const accountId of new Set(sessions.map(session => session.accountId))) {
        if (await Session.count({ where: { accountId } }) === 0) await SessionManager.removeAllByAccountId(accountId);
    }
};

const sweepExpiredSessions = async () => {
    const policy = await getSystemSettings();
    const now = Date.now();
    const expired = (await Session.findAll({
        where: {
            [Op.or]: [
                { lastActivity: { [Op.lt]: new Date(now - policy.sessionIdleHours * HOUR) } },
                { createdAt: { [Op.lt]: new Date(now - policy.sessionMaxDays * 24 * HOUR) } },
            ],
        },
        attributes: ["id", "accountId"],
    }));
    if (expired.length === 0) return 0;

    await revokeSessions(expired);
    logger.info("Expired sign-in sessions removed", { count: expired.length });
    return expired.length;
};

const startSessionSweep = () => {
    setInterval(() => sweepExpiredSessions().catch(error =>
        logger.error("Session sweep failed", { error: error.message })), 60 * 1000).unref();
};

module.exports = { refuseLockedAccount, directoryRole, createSignInSession, resolveSession, touchSession, revokeSessions, sweepExpiredSessions, startSessionSweep, isExpired };
