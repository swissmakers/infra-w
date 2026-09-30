const { Router } = require("express");
const { sendFailure } = require("../utils/error");
const { createSession, getSession, hibernateSession, resumeSession, deleteSession, startSharing, stopSharing, updateSharePermissions, duplicateSession, pasteIdentityPassword } = require("../controllers/serverSession");
const { createSessionValidation, sessionIdValidation, resumeSessionValidation, duplicateSessionValidation, promptAnswerValidation, shareValidation } = require("../validations/serverSession");
const { answerPrompt } = require("../utils/connectionPrompts");
const { validateSchema } = require("../utils/schema");
const stateBroadcaster = require("../lib/StateBroadcaster");
const { getClientIp } = require("../utils/requestIp");
const logger = require("../utils/logger");

const requestInfo = req => ({ ipAddress: getClientIp(req), userAgent: req.headers["user-agent"] || null });

const app = Router();

/**
 * POST /connections
 * @summary Create Connection
 * @description Creates a new server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - Session creation details
 * @return {object} 201 - Session created
 */
app.post("/", async (req, res) => {
    if (validateSchema(res, createSessionValidation, req.body)) return;

    try {
        const { entryId, ...options } = req.body;
        const result = await createSession(req.user.id, entryId, { ...options, ...requestInfo(req) });

        if (result?.code) {
            return sendFailure(res, result);
        }

        res.status(201).json(result);
    } catch (error) {
        logger.error('Error creating session', { error: error.message });
        res.status(500).json({ code: 500, message: 'Internal server error' });
    }
});

/**
 * POST /connections/prompts/{promptId}
 * @summary Answer a Sign-in Prompt
 * @description Answers (or cancels) a sign-in prompt of a connection that the server sent to the browser, for example a one-time code asked by keyboard-interactive SSH login. The answers go to the connection only and are not logged.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} promptId.path.required - Prompt ID from the CONNECTION_PROMPT event
 * @param {object} request.body.required - { "answers": ["123456"] } or { "cancel": true }
 * @return {object} 200 - Answer delivered
 * @return {object} 404 - The prompt is no longer open
 */
app.post("/prompts/:promptId", async (req, res) => {
    if (validateSchema(res, promptAnswerValidation, req.body)) return;
    const result = answerPrompt(req.user.id, req.params.promptId, req.body);
    if (result.code) return sendFailure(res, result);
    res.json(result);
});

/**
 * GET /connections/{id}
 * @summary Get Connection
 * @description Retrieves a specific server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Session details
 */
app.get("/:id", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;

    const result = await getSession(req.user.id, req.params.id);
    if (result?.code) {
        return sendFailure(res, result);
    }
    res.json(result);
});

/**
 * POST /connections/{id}/hibernate
 * @summary Hibernate Connection
 * @description Hibernates a server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Success message
 * @return {object} 403 - The connection belongs to another account
 * @return {object} 404 - Connection not found
 */
app.post("/:id/hibernate", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;

    const result = await hibernateSession(req.user.id, req.params.id);
    if (result?.code) {
        return sendFailure(res, result);
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * POST /connections/{id}/resume
 * @summary Resume Connection
 * @description Resumes a hibernated server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Success message
 * @return {object} 403 - The connection belongs to another account
 * @return {object} 404 - Connection not found
 */
app.post("/:id/resume", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    if (validateSchema(res, resumeSessionValidation, req.body)) return;

    const { tabId, browserId } = req.body;
    const result = await resumeSession(req.user.id, req.params.id, tabId, browserId);
    if (result?.code) {
        return sendFailure(res, result);
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * DELETE /connections/{id}
 * @summary Delete Connection
 * @description Deletes a server connection.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Success message
 * @return {object} 403 - The connection belongs to another account
 * @return {object} 404 - Connection not found
 */
app.delete("/:id", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;

    const result = await deleteSession(req.user.id, req.params.id);
    if (result?.code) {
        return sendFailure(res, result);
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * POST /connections/{id}/share
 * @summary Start Sharing
 * @description Shares a session through a link that expires after the given hours (default 8), at most the organization's limit. Organizations can turn sharing or writable sharing off. Sharing again keeps the link and applies the new permission and expiry.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @param {object} request.body - { "writable": false, "hours": 8 }
 * @return {object} 200 - Share details: shareId, writable, expiresAt (ms)
 * @return {object} 403 - Sharing (or writable sharing) is turned off for the organization
 */
app.post("/:id/share", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    const { error, value } = shareValidation.validate(req.body || {});
    if (error) return res.status(400).json({ code: 400, message: error.message });
    const result = await startSharing(req.user.id, req.params.id, value, requestInfo(req));
    if (result?.code) return sendFailure(res, result);
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * DELETE /connections/{id}/share
 * @summary Stop Sharing
 * @description Stops sharing a session.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Success message
 */
app.delete("/:id/share", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    const result = await stopSharing(req.user.id, req.params.id, requestInfo(req));
    if (result?.code) return sendFailure(res, result);
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * PATCH /connections/{id}/share
 * @summary Update Share Permissions
 * @description Updates share permissions for a session.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 200 - Updated permissions
 */
app.patch("/:id/share", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    const result = await updateSharePermissions(req.user.id, req.params.id, req.body?.writable === true, requestInfo(req));
    if (result?.code) return sendFailure(res, result);
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.json(result);
});

/**
 * POST /connections/{id}/duplicate
 * @summary Duplicate Connection
 * @description Creates a new connection with the same configuration as an existing one.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 * @return {object} 201 - New session created
 */
app.post("/:id/duplicate", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;
    if (validateSchema(res, duplicateSessionValidation, req.body)) return;

    const { tabId, browserId } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await duplicateSession(req.user.id, req.params.id, tabId, browserId, ipAddress, userAgent);
    if (result?.code) {
        return sendFailure(res, result);
    }
    stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });
    res.status(201).json(result);
});

/**
 * POST /connections/{id}/paste-password
 * @summary Paste identity password into session
 * @description Inserts the password of the identity attached to the session into the active session stream.
 * @tags Connection
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - Session ID
 */
app.post("/:id/paste-password", async (req, res) => {
    if (validateSchema(res, sessionIdValidation, req.params)) return;

    try {
        const result = await pasteIdentityPassword(req.user.id, req.params.id, getClientIp(req), req.headers?.["user-agent"]);
        if (result?.code) return sendFailure(res, result);
        res.json(result);
    } catch (error) {
        logger.error('Error pasting identity password', { error: error.message });
        res.status(500).json({ code: 500, message: 'Internal server error' });
    }
});

module.exports = app;
