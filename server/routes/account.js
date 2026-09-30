const { Router } = require("express");
const { registerValidation, totpSetup, passwordChangeValidation, updateNameValidation, updateSessionSyncValidation } = require("../validations/account");
const { preferencesValidation } = require("../validations/preferences");
const { createAccount, updateTOTP, changeOwnPassword, updateName, updateSessionSync, updatePreferences, searchUsers } = require("../controllers/account");
const speakeasy = require("speakeasy");
const { authenticate, requireBrowserSession } = require("../middlewares/auth");
const { validateSchema } = require("../utils/schema");
const { sendFailure } = require("../utils/error");
const Account = require("../models/Account");
const { auditRequest, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { getDisplayName } = require("../utils/displayName");

const app = Router();

/**
 * GET /accounts/search
 * @summary Search Users
 * @description Search for users by username, first name, or last name. Returns limited user info for autocomplete purposes. Requires at least 3 characters.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {string} search.query.required - Search term (min 3 characters)
 * @return {object} 200 - List of matching users (max 5)
 * @return {object} 401 - User is not authenticated
 */
app.get("/search", authenticate, async (req, res) => {
    const { search } = req.query;
    res.json(await searchUsers(search));
});

/**
 * GET /accounts/me
 * @summary Get Current User Information
 * @description Retrieves the authenticated user's profile information including username, TOTP status, name, and role.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - User profile information
 * @return {object} 401 - User is not authenticated
 */
app.get("/me", authenticate, async (req, res) => {
    const impersonator = req.session?.impersonatorId ? await Account.findByPk(req.session.impersonatorId) : null;

    res.json({
        impersonator: impersonator ? { id: impersonator.id, name: getDisplayName(impersonator) } : null,
        id: req.user.id, username: req.user.username, totpEnabled: req.user.totpEnabled,
        firstName: req.user.firstName, lastName: req.user.lastName, role: req.user.role,
        sessionSync: req.user.sessionSync, preferences: req.user.preferences || {},
        authProviderType: req.user.authProviderType || "internal",
        authProviderName: req.user.authProviderName || null,
    });
});

/**
 * PATCH /accounts/password
 * @summary Update Password
 * @description Updates the authenticated user's password. Requires current authentication.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {PasswordChange} request.body.required - New password information
 * @return {object} 200 - Password successfully updated
 * @return {object} 401 - User is not authenticated
 */
app.patch("/password", authenticate, requireBrowserSession, async (req, res) => {
    if (validateSchema(res, passwordChangeValidation, req.body)) return;

    const result = await changeOwnPassword(req.user, req.session.id, req.body.currentPassword, req.body.password);
    if (result?.code) return sendFailure(res, result);
    await auditRequest(req, { action: AUDIT_ACTIONS.ACCOUNT_PASSWORD_CHANGE, resource: RESOURCE_TYPES.ACCOUNT, resourceId: req.user.id });

    res.json({ message: "Your password has been successfully updated." });
});

/**
 * PATCH /accounts/name
 * @summary Update User Name
 * @description Updates the authenticated user's first name and last name.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {UpdateName} request.body.required - Name information containing firstName and lastName
 * @return {object} 200 - Name successfully updated
 * @return {object} 401 - User is not authenticated
 */
app.patch("/name", authenticate, async (req, res) => {
    if (validateSchema(res, updateNameValidation, req.body)) return;

    const result = await updateName(req.user.id, req.body);
    if (result?.code) return res.status(400).json({ message: result.message });

    res.json({ message: "Your name has been successfully updated." });
});

/**
 * POST /accounts/register
 * @summary Register New Account
 * @description Creates the first administrator account during first-time setup. Fails once an account exists.
 * @tags Account
 * @produces application/json
 * @param {Register} request.body.required - User registration information including username, password, and name details
 * @return {object} 200 - Account creation successful or error information
 */
app.post("/register", async (req, res) => {
    if (validateSchema(res, registerValidation, req.body)) return;

    const account = await createAccount(req.body);
    if (account.code) return sendFailure(res, account);

    res.json({ message: "Your account has been successfully created." });
});

/**
 * GET /accounts/totp/secret
 * @summary Get TOTP Secret
 * @description Retrieves the TOTP secret and QR code URL for setting up two-factor authentication. Used for configuring authenticator apps.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - TOTP secret and setup URL
 */
app.get("/totp/secret", authenticate, requireBrowserSession, async (req, res) => {
    // never hand out the secret of an active second factor
    if (req.user.totpEnabled) return sendFailure(res, { code: 409, message: "Two-factor authentication is already enabled" });

    res.json({
        secret: req.user?.totpSecret,
        url: `otpauth://totp/INFRA-W%20%28${req.user?.username}%29?secret=${req.user?.totpSecret}`,
    });
});

/**
 * POST /accounts/totp/enable
 * @summary Enable TOTP
 * @description Enables two-factor authentication for the user account by verifying a TOTP code from their authenticator app.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {TotpSetup} request.body.required - TOTP verification code
 * @return {object} 200 - TOTP successfully enabled
 * @return {object} 400 - Invalid or expired TOTP code
 */
app.post("/totp/enable", authenticate, requireBrowserSession, async (req, res) => {
    if (validateSchema(res, totpSetup, req.body)) return;

    const tokenCorrect = speakeasy.totp.verify({
        secret: req.user?.totpSecret || "",
        encoding: "base32",
        token: req.body.code,
    });

    if (!tokenCorrect)
        return sendFailure(res, { code: 400, message: "Your provided code is invalid or has expired.",
            serverTime: new Date().toISOString()
        });

    const enabledError = await updateTOTP(req.user?.id, true);
    if (enabledError?.code) return sendFailure(res, enabledError);

    res.json({ message: "TOTP has been successfully enabled on your account." });
});

/**
 * POST /accounts/totp/disable
 * @summary Disable TOTP
 * @description Disables two-factor authentication for the user account. Removes the requirement for TOTP codes during login.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - TOTP successfully disabled
 */
app.post("/totp/disable", authenticate, requireBrowserSession, async (req, res) => {
    const enabledError = await updateTOTP(req.user.id, false);
    if (enabledError?.code) return sendFailure(res, enabledError);

    res.json({ message: "TOTP has been successfully disabled on your account." });
});

/**
 * PATCH /accounts/session-sync
 * @summary Update Session Synchronization
 * @description Updates the session synchronization mode for the user account.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {UpdateSessionSync} request.body.required - Session sync mode
 * @return {object} 200 - Session sync mode successfully updated
 */
app.patch("/session-sync", authenticate, async (req, res) => {
    if (validateSchema(res, updateSessionSyncValidation, req.body)) return;

    const error = await updateSessionSync(req.user.id, req.body.sessionSync);
    if (error?.code) return sendFailure(res, error);

    res.json({ message: "Session synchronization mode has been successfully updated." });
});

/**
 * PATCH /accounts/me/preferences
 * @summary Update User Preferences
 * @description Updates the user's preferences (terminal settings, theme, file settings). Performs a deep merge with existing preferences.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - Preferences object with terminal, theme, and/or files properties
 * @return {object} 200 - Preferences successfully updated with the merged result
 * @return {object} 401 - User is not authenticated
 */
app.patch("/me/preferences", authenticate, async (req, res) => {
    if (validateSchema(res, preferencesValidation, req.body)) return;

    const result = await updatePreferences(req.user.id, req.body);
    if (result?.code) return sendFailure(res, result);

    res.json({ message: "Preferences successfully updated.", preferences: result });
});

module.exports = app;