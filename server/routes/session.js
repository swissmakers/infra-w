const { Router } = require("express");
const { sendFailure } = require("../utils/error");
const { listSessions, destroySession, destroyOtherSessions } = require("../controllers/session");

const app = Router();

/**
 * GET /sessions/list
 * @summary List Active Sessions
 * @description Retrieves a list of all active sessions for the authenticated user. The session used for the request is marked as current.
 * @tags Session
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of active user sessions with details
 */
app.get("/list", async (req, res) => {
    res.json(await listSessions(req.user.id, req.session.id));
});

/**
 * DELETE /sessions/others
 * @summary Sign Out Other Devices
 * @description Ends every sign-in of the account except the current one.
 * @tags Session
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Number of ended sessions
 */
app.delete("/others", async (req, res) => {
    res.json(await destroyOtherSessions(req.user.id, req.session.id));
});

/**
 * DELETE /sessions/{id}
 * @summary Destroy Session
 * @description Permanently destroys a specific session, effectively logging out that session. Useful for managing active sessions across multiple devices.
 * @tags Session
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the session to destroy
 * @return {object} 200 - Session destruction result
 * @return {object} 404 - The session does not exist or belongs to another account
 */
app.delete("/:id", async (req, res) => {
    const result = await destroySession(req.user.id, req.params.id);
    if (result.code) return sendFailure(res, result);
    res.json(result);
});

module.exports = app;