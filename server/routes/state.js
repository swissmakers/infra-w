const { resolveSession } = require("../utils/sessionAuth");
const stateBroadcaster = require("../lib/StateBroadcaster");

module.exports = async (ws, req) => {
    const { sessionToken, tabId, browserId } = req.query;
    if (!sessionToken) return ws.close(4001, "Missing sessionToken");

    // 4010 makes the client sign out instead of reconnecting forever
    const resolved = await resolveSession(sessionToken);
    if (!resolved) return ws.close(4010, "Session invalidated");
    const { session, account: user } = resolved;

    const conn = { ws, tabId: tabId || null, browserId: browserId || null, sessionId: session.id };
    stateBroadcaster.register(user.id, session.id, ws, tabId || null, browserId || null);
    stateBroadcaster.sendAllStateToConnection(user.id, conn).catch(() => {});

    ws.on("close", () => stateBroadcaster.unregister(user.id, ws));
    ws.on("error", () => stateBroadcaster.unregister(user.id, ws));
};
