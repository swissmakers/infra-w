const { Router } = require("express");
const { requireBrowserSession } = require("../middlewares/auth");
const { listApiTokens, revokeApiToken } = require("../utils/apiTokens");
const { sendFailure } = require("../utils/error");
const { listUsers, createAccount, deleteAccount, updatePassword, updateRole, setLocked, resetSecondFactor } = require("../controllers/account");
const { validateSchema } = require("../utils/schema");
const { createUserValidation, updateRoleValidation, lockValidation } = require("../validations/users");
const { createSession, listAllSessions, revokeAnySession } = require("../controllers/session");
const { getClientIp } = require("../utils/requestIp");
const { auditRequest, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const audit = (req, action, resourceId, details) => auditRequest(req, { action, resource: RESOURCE_TYPES.ACCOUNT, resourceId, details });
const { passwordResetValidation } = require("../validations/account");

const app = Router();

/**
 * GET /users/list
 * @summary List All Users (Admin)
 * @description Retrieves a paginated list of all user accounts in the system including their roles and status. Supports search by username, first name, or last name. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} search.query - Search term to filter users by username, first name, or last name
 * @param {number} limit.query - Maximum number of users to return (default: 50)
 * @param {number} offset.query - Number of users to skip for pagination (default: 0)
 * @return {object} 200 - Paginated list of user accounts with total count
 * @return {object} 403 - Admin access required
 */
app.get("/list", async (req, res) => {
    const { search, limit, offset } = req.query;
    res.json(await listUsers({ search, limit, offset }));
});

/**
 * PUT /users
 * @summary Create User Account (Admin)
 * @description Creates a new user account with specified role and credentials. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {CreateUser} request.body.required - User account details including username, password, name, and role
 * @return {object} 200 - Account successfully created
 * @return {object} 403 - Admin access required
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createUserValidation, req.body)) return;

    const account = await createAccount(req.body, false);
    if (account?.code) return sendFailure(res, account);
    await audit(req, AUDIT_ACTIONS.ACCOUNT_CREATE, account.id, { username: account.username, role: account.role });

    res.json({ message: "Account got successfully created" });
});

/**
 * POST /users/{accountId}/login
 * @summary Create User Session (Admin)
 * @description Creates a session token for a specific user account, allowing administrators to impersonate users for support purposes. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @return {object} 200 - Session successfully created with token
 * @return {object} 404 - User account not found
 * @return {object} 403 - Admin access required
 */
app.post("/:accountId/login", requireBrowserSession, async (req, res) => {
    const account = await createSession(req.params.accountId, req.user.id, getClientIp(req), req.headers["user-agent"]);
    if (account?.code) return sendFailure(res, account);

    res.json({ message: "Session got successfully created", token: account.token });
});

/**
 * DELETE /users/{accountId}
 * @summary Delete User Account (Admin)
 * @description Permanently removes a user account and all associated data. This action cannot be undone. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account to delete
 * @return {object} 200 - Account successfully deleted
 * @return {object} 404 - User account not found
 * @return {object} 403 - Admin access required
 */
app.delete("/:accountId", async (req, res) => {
    const account = await deleteAccount(req.params.accountId);
    if (account?.code) return sendFailure(res, account);
    await audit(req, AUDIT_ACTIONS.ACCOUNT_DELETE, Number(req.params.accountId), { username: account.username,
        organizationsTransferred: account.organizations.transferred.length, organizationsDeleted: account.organizations.deleted.length });

    res.json({ message: "Account got successfully deleted" });
});

/**
 * PATCH /users/{accountId}/password
 * @summary Update User Password (Admin)
 * @description Updates a user's password. Admin access required to modify other users' passwords.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @param {PasswordChange} request.body.required - New password for the user account
 * @return {object} 200 - Password successfully updated
 * @return {object} 404 - User account not found
 * @return {object} 403 - Admin access required
 */
app.patch("/:accountId/password", requireBrowserSession, async (req, res) => {
    if (validateSchema(res, passwordResetValidation, req.body)) return;

    const account = await updatePassword(req.params.accountId, req.body.password);
    if (account?.code) return sendFailure(res, account);
    await audit(req, AUDIT_ACTIONS.ACCOUNT_PASSWORD_RESET, Number(req.params.accountId));

    res.json({ message: "Password got successfully updated" });
});

/**
 * PATCH /users/{accountId}/role
 * @summary Update User Role (Admin)
 * @description Updates a user's role in the system (e.g., admin, user). Administrators cannot change their own role. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @param {UpdateRole} request.body.required - New role for the user account
 * @return {object} 200 - Role successfully updated
 * @return {object} 400 - Cannot change your own role or invalid account ID
 * @return {object} 403 - Admin access required
 */
app.patch("/:accountId/role", async (req, res) => {
    try {
        if (req.user.id === parseInt(req.params.accountId))
            return res.status(400).json({ code: 400, message: "You cannot change your own role" });

        if (validateSchema(res, updateRoleValidation, req.body)) return;

        const account = await updateRole(req.params.accountId, req.body.role);
        if (account?.code) return sendFailure(res, account);
        await audit(req, AUDIT_ACTIONS.ACCOUNT_ROLE_CHANGE, Number(req.params.accountId), { role: req.body.role });

        res.json({ message: "Role got successfully updated" });
    } catch (error) {
        res.status(400).json({ code: 400, message: "You need to provide a correct id"});
    }
});

/**
 * PATCH /users/{accountId}/lock
 * @summary Lock or Unlock a User (Admin)
 * @description A locked account keeps its data but cannot sign in by any method; locking ends its sign-ins. Administrators cannot lock themselves.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @param {object} request.body.required - { "locked": true }
 * @return {object} 200 - Lock state updated
 * @return {object} 400 - Cannot lock your own account
 * @return {object} 404 - User account not found
 * @return {object} 409 - The account already has this lock state
 */
app.patch("/:accountId/lock", async (req, res) => {
    if (validateSchema(res, lockValidation, req.body)) return;

    const result = await setLocked(Number(req.params.accountId), req.body.locked, req.user.id);
    if (result?.code) return sendFailure(res, result);
    await audit(req, req.body.locked ? AUDIT_ACTIONS.ACCOUNT_LOCK : AUDIT_ACTIONS.ACCOUNT_UNLOCK, Number(req.params.accountId),
        { username: result.username });

    res.json({ message: req.body.locked ? "Account locked" : "Account unlocked" });
});

/**
 * DELETE /users/{accountId}/second-factor
 * @summary Reset Two-Factor Authentication (Admin)
 * @description Turns off TOTP and removes all passkeys of a user who lost their authenticator.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @return {object} 200 - Second factor reset
 * @return {object} 404 - User account not found
 * @return {object} 409 - The account has no second factor
 */
app.delete("/:accountId/second-factor", requireBrowserSession, async (req, res) => {
    const result = await resetSecondFactor(Number(req.params.accountId));
    if (result?.code) return sendFailure(res, result);
    await audit(req, AUDIT_ACTIONS.ACCOUNT_MFA_RESET, Number(req.params.accountId),
        { username: result.username, totp: result.totp, passkeys: result.passkeys });

    res.json({ message: "Second factor reset" });
});

/**
 * GET /users/sessions
 * @summary List All Sign-ins (Admin)
 * @description Lists the sign-in sessions of all accounts with their device, address and activity, most recent first.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @return {array<object>} 200 - Sign-in sessions
 */
app.get("/sessions", requireBrowserSession, async (req, res) => {
    res.json(await listAllSessions(req.session.id));
});

/**
 * DELETE /users/sessions/{sessionId}
 * @summary Sign Out a Session (Admin)
 * @description Ends one sign-in session of any account; its browser tabs are signed out.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} sessionId.path.required - The unique identifier of the session
 * @return {object} 200 - Session ended
 * @return {object} 404 - Session not found
 */
app.delete("/sessions/:sessionId", requireBrowserSession, async (req, res) => {
    const result = await revokeAnySession(Number(req.params.sessionId));
    if (result?.code) return sendFailure(res, result);
    await auditRequest(req, { action: AUDIT_ACTIONS.SESSION_REVOKE, resource: RESOURCE_TYPES.ACCOUNT, resourceId: result.accountId,
        details: { sessionId: Number(req.params.sessionId) } });

    res.json({ message: "Session ended" });
});

/**
 * GET /users/tokens
 * @summary List All API Tokens (Admin)
 * @description Lists the API tokens of all accounts with their owner, scope, expiry and last use (never the token values).
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @return {array<object>} 200 - API tokens
 */
app.get("/tokens", requireBrowserSession, async (req, res) => {
    res.json(await listApiTokens());
});

/**
 * DELETE /users/tokens/{id}
 * @summary Revoke Any API Token (Admin)
 * @description Revokes an API token of any account; it stops working at once.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - Token ID
 * @return {object} 200 - Token revoked
 * @return {object} 404 - Token not found
 */
app.delete("/tokens/:id", requireBrowserSession, async (req, res) => {
    const result = await revokeApiToken(Number(req.params.id));
    if (result.code) return sendFailure(res, result);
    await audit(req, AUDIT_ACTIONS.API_TOKEN_REVOKE, result.accountId, { name: result.name });
    res.json({ message: "API token revoked" });
});

module.exports = app;