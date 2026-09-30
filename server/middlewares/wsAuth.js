const { resolveSession, touchSession } = require("../utils/sessionAuth");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const SessionManager = require("../lib/SessionManager");
const { validateEntryAccess } = require("../controllers/entry");
const { getOrgAuditSettings } = require("../utils/orgAuditSettings");
const { resolveIdentity } = require("../utils/identityResolver");
const { getClientIp } = require("../utils/requestIp");

const authenticateSharedSession = async (ws, req) => {
    const { query } = req;
    const { shareId } = query;

    const session = SessionManager.getByShareId(shareId);
    if (!session) return ws.close(4013, "Invalid share link"), null;

    const entry = await Entry.findByPk(session.entryId, { attributes: ['id', 'type', 'config', 'integrationId'] });
    if (!entry) return ws.close(4005, "Entry not found"), null;

    return {
        entry,
        integration: null,
        identity: null,
        user: null,
        session: null,
        serverSession: session,
        containerId: "0",
        connectionReason: null,
        ipAddress: getClientIp(req),
        userAgent: query.userAgent || "unknown",
        isShared: true,
        shareWritable: session.shareWritable,
    };
};

const isKeepAlive = message => /^(?:\d+\.(?:sync|nop)(?:,\d+\.[^;]*)*;)+$/.test(message.toString());

const authenticateWebSocket = async (ws, query) => {
    const { sessionToken, entryId, sessionId } = query;

    if (!sessionToken) {
        ws.close(4001, "You need to provide the token in the 'sessionToken' parameter");
        return null;
    }

    const resolved = await resolveSession(sessionToken);
    if (!resolved) {
        ws.close(4003, "The token is not valid");
        return null;
    }
    const { session, account: user } = resolved;
    // Guacamole sync/nop acks arrive on their own and must not keep an idle sign-in alive
    ws.on("message", message => {
        if (!isKeepAlive(message)) touchSession(session.id).catch(() => {});
    });

    let targetEntryId = entryId;
    let serverSession = null;

    if (sessionId) {
        serverSession = SessionManager.get(sessionId);
        if (!serverSession) {
            ws.close(4007, "Invalid session ID");
            return null;
        }
        if (serverSession.accountId !== user.id) {
            ws.close(4003, "Unauthorized session access");
            return null;
        }
        targetEntryId = serverSession.entryId;
        SessionManager.updateActivity(sessionId);
    }

    if (!targetEntryId) {
        ws.close(4002, "You need to provide the entryId or sessionId");
        return null;
    }

    const entry = await Entry.findByPk(targetEntryId);
    if (!entry) {
        ws.close(4005, "Entry not found");
        return null;
    }

    const accessResult = await validateEntryAccess(user.id, entry);
    if (!accessResult.valid) {
        ws.close(4005, "You don't have access to this entry");
        return null;
    }

    return { user, entry, session, serverSession };
}

module.exports = async (ws, req, { allowShared = false } = {}) => {
    if (allowShared && req.query.shareId) return authenticateSharedSession(ws, req);

    const baseAuth = await authenticateWebSocket(ws, req.query);
    if (!baseAuth) return null;

    const { user, entry, session, serverSession } = baseAuth;
    let { identityId, connectionReason, containerId } = req.query;
    let directIdentity = null;

    if (serverSession) {
        if (serverSession.configuration?.identityId) identityId = serverSession.configuration.identityId;
        if (serverSession.configuration?.directIdentity) directIdentity = serverSession.configuration.directIdentity;
        if (serverSession.connectionReason) connectionReason = serverSession.connectionReason;
    }

    const integration = entry.integrationId ? await Integration.findByPk(entry.integrationId) : null;

    if (entry.organizationId) {
        const auditSettings = await getOrgAuditSettings(entry.organizationId);
        if (auditSettings?.requireConnectionReason && !connectionReason) {
            ws.close(4008, "Connection reason required");
            return null;
        }
    }

    const result = await resolveIdentity(entry, identityId, directIdentity, user.id);
    const identity = result?.identity !== undefined ? result.identity : result;

    if (result.accessDenied) {
        ws.close(4006, "You don't have access to this identity");
        return null;
    }

    if (result.requiresIdentity && !identity) {
        ws.close(4006, "Identity not found");
        return null;
    }

    return {
        entry,
        integration,
        identity,
        user,
        session,
        serverSession,
        containerId: containerId || "0",
        connectionReason: connectionReason || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || 'unknown',
    };
};
