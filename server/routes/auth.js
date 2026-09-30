const { Router } = require("express");
const { sendFailure } = require("../utils/error");
const rateLimit = require("express-rate-limit");
const { login, logout } = require("../controllers/auth");
const { loginValidation, tokenValidation } = require("../validations/auth");
const { passkeyAuthenticationValidation, passkeyAuthOptionsValidation } = require("../validations/passkey");
const { validateSchema } = require("../utils/schema");
const { generateAuthenticationOptions, verifyAuthentication } = require("../controllers/passkey");
const { getClientIp } = require("../utils/requestIp");

const app = Router();

const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    // a reply that asks for the second factor is not a completed sign-in
    requestWasSuccessful: (_req, res) => res.locals.authenticated === true,
    message: { code: 429, message: "Too many authentication attempts. Try again later." },
});

/**
 * POST /auth/login
 * @summary User Authentication
 * @description Authenticates a user with username, password, and optional TOTP code. Returns a session token on success.
 * @tags Authentication
 * @produces application/json
 * @param {Login} request.body.required - User credentials including username, password, and optional totp code
 * @return {object} 200 - Session token and success message
 * @return {object} 401 - Invalid credentials or TOTP code
 */
app.post("/login", loginRateLimiter, async (req, res) => {
    if (validateSchema(res, loginValidation, req.body)) return;
    const session = await login(req.body, { ip: getClientIp(req), userAgent: req.header("User-Agent") || "None" });
    if (session?.code) return sendFailure(res, session);
    res.locals.authenticated = Boolean(session?.token);
    res.header("Authorization", session?.token).json({ ...session, message: "Your session got successfully created" });
});

/**
 * POST /auth/logout
 * @summary User Logout
 * @description Destroys the user session associated with the provided token, logging the user out.
 * @tags Authentication
 * @produces application/json
 * @param {Logout} request.body.required - Session token to invalidate
 * @return {object} 200 - Logout success confirmation
 */
app.post("/logout", async (req, res) => {
    if (validateSchema(res, tokenValidation, req.body)) return;
    const session = await logout(req.body.token);
    if (session?.code) return sendFailure(res, session);
    res.json({ message: "Your session got deleted successfully" });
});

/**
 * POST /auth/passkey/options
 * @summary Get Passkey Authentication Options
 * @description Retrieves WebAuthn authentication options for passkey-based login. Used to initiate the passkey authentication flow.
 * @tags Authentication
 * @produces application/json
 * @param {PasskeyAuthOptions} request.body.required - Username and origin for passkey authentication
 * @return {object} 200 - WebAuthn authentication options
 * @return {object} 400 - User not found or passkey not configured
 */
app.post("/passkey/options", loginRateLimiter, async (req, res) => {
    if (validateSchema(res, passkeyAuthOptionsValidation, req.body)) return;
    const result = await generateAuthenticationOptions(req, req.body.username, req.body.origin);
    if (result?.code) return sendFailure(res, result);
    res.json(result.options);
});

/**
 * POST /auth/passkey/verify
 * @summary Verify Passkey Authentication
 * @description Verifies the passkey authentication response and creates a new session on success.
 * @tags Authentication
 * @produces application/json
 * @param {PasskeyVerify} request.body.required - WebAuthn authentication response
 * @return {object} 200 - Session token on successful verification
 * @return {object} 401 - Passkey verification failed
 */
app.post("/passkey/verify", loginRateLimiter, async (req, res) => {
    if (validateSchema(res, passkeyAuthenticationValidation, req.body)) return;
    const result = await verifyAuthentication(req, req.body.response, { ip: getClientIp(req), userAgent: req.header("User-Agent") || "None" }, req.body.origin);
    if (result?.code) return sendFailure(res, result);
    res.locals.authenticated = Boolean(result?.token);
    res.header("Authorization", result.token).json({ token: result.token, message: "Your session got successfully created" });
});

module.exports = app;
