const { Op } = require("sequelize");
const Session = require("../models/Session");
const Account = require("../models/Account");
const { revokeSessions, createSignInSession } = require("../utils/sessionAuth");

module.exports.listSessions = async (accountId, currentSessionId) => {
    return (await Session.findAll({ where: { accountId } }))
        .sort((a, b) => b.lastActivity - a.lastActivity)
        .map(session => ({ id: session.id, ip: session.ip, userAgent: session.userAgent, lastActivity: session.lastActivity,
            createdAt: session.createdAt, current: session.id === currentSessionId }));
}

module.exports.createSession = async (accountId, impersonatorId, ip, userAgent) => {
    const account = await Account.findByPk(accountId);

    if (account === null)
        return { code: 404, message: "The provided account does not exist" };
    if (account.id === impersonatorId)
        return { code: 400, message: "You are already signed in to this account" };
    if (account.disabled)
        return { code: 409, message: "This account is locked" };

    const session = await createSignInSession(account, { ip, userAgent, method: "impersonation", impersonatorId });

    return { token: session.token };
}

module.exports.listAllSessions = async (currentSessionId) => {
    const sessions = await Session.findAll({ attributes: ["id", "accountId", "ip", "userAgent", "lastActivity", "createdAt", "impersonatorId"] });
    const accounts = await Account.findAll({ where: { id: { [Op.in]: [...new Set(sessions.flatMap(s => [s.accountId, s.impersonatorId]).filter(Boolean))] } },
        attributes: ["id", "username", "firstName", "lastName"] });
    const accountById = new Map(accounts.map(account => [account.id, account]));
    return sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)).map(session => ({
        ...session, account: accountById.get(session.accountId) || null,
        impersonator: session.impersonatorId ? accountById.get(session.impersonatorId) || null : null, current: session.id === currentSessionId,
    }));
};

module.exports.revokeAnySession = async (sessionId) => {
    const session = await Session.findByPk(sessionId, { attributes: ["id", "accountId"] });
    if (session === null)
        return { code: 404, message: "The provided session does not exist" };
    await revokeSessions([session]);
    return { accountId: session.accountId };
};

module.exports.destroyOtherSessions = async (accountId, currentSessionId) => {
    const others = await Session.findAll({ where: { accountId, id: { [Op.ne]: currentSessionId } }, attributes: ["id", "accountId"] });
    await revokeSessions(others);
    return { count: others.length };
};

module.exports.destroySession = async (accountId, sessionId) => {
    const session = await Session.findOne({ where: { accountId, id: sessionId } });

    if (session === null)
        return { code: 404, message: "The provided session does not exist" };

    await revokeSessions([session]);

    return { message: "The session has been successfully destroyed" };
};