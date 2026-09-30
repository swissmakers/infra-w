const { Router } = require("express");
const { sendFailure } = require("../utils/error");
const { validateSchema } = require("../utils/schema");
const { createApiTokenValidation } = require("../validations/apiToken");
const { createApiToken, listApiTokens, revokeApiToken } = require("../utils/apiTokens");
const { auditRequest, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const app = Router();

/**
 * GET /tokens
 * @summary List My API Tokens
 * @description Lists the caller's personal API tokens (never the token values). Needs a browser sign-in.
 * @tags API Tokens
 * @produces application/json
 * @security BearerAuth
 * @return {array<object>} 200 - Tokens: name, prefix, scope (read or write), expiry, last use
 */
app.get("/", async (req, res) => {
    res.json(await listApiTokens(req.user.id));
});

/**
 * PUT /tokens
 * @summary Create an API Token
 * @description Creates a personal token that acts with the caller's rights: "read" allows only reading requests, "write" all. It expires after 1-365 days and is shown only in this response. Tokens cannot manage passwords, second factors, sign-in sessions or tokens, and do not open terminals. Send it as "Authorization: Bearer infw_...".
 * @tags API Tokens
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - { "name": "CI inventory", "scope": "read", "days": 90 }
 * @return {object} 200 - The token (only here) and its details
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createApiTokenValidation, req.body)) return;
    const created = await createApiToken(req.user.id, req.body);
    await auditRequest(req, { action: AUDIT_ACTIONS.API_TOKEN_CREATE, resource: RESOURCE_TYPES.ACCOUNT, resourceId: req.user.id,
        details: { name: created.name, scope: created.scope, expiresAt: created.expiresAt } });
    res.json(created);
});

/**
 * DELETE /tokens/{id}
 * @summary Revoke an API Token
 * @description Revokes one of the caller's tokens; it stops working at once.
 * @tags API Tokens
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Token ID
 * @return {object} 200 - Token revoked
 * @return {object} 404 - Token not found
 */
app.delete("/:id", async (req, res) => {
    const result = await revokeApiToken(Number(req.params.id), req.user.id);
    if (result.code) return sendFailure(res, result);
    await auditRequest(req, { action: AUDIT_ACTIONS.API_TOKEN_REVOKE, resource: RESOURCE_TYPES.ACCOUNT, resourceId: req.user.id, details: { name: result.name } });
    res.json({ message: "API token revoked" });
});

module.exports = app;
