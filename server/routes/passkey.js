const { Router } = require("express");
const { authenticate, requireBrowserSession } = require("../middlewares/auth");
const { validateSchema } = require("../utils/schema");
const { sendFailure } = require("../utils/error");
const { passkeyRenameValidation, passkeyRegistrationValidation } = require("../validations/passkey");
const { generateRegistrationOptions, verifyRegistration, listPasskeys, deletePasskey, renamePasskey } = require("../controllers/passkey");

const app = Router();

/**
 * GET /accounts/passkeys
 * @summary List Passkeys
 * @tags Account
 * @security BearerAuth
 */
app.get("/", authenticate, requireBrowserSession, async (req, res) => {
    res.json(await listPasskeys(req.user.id));
});

/**
 * POST /accounts/passkeys/register/options
 * @summary Get Passkey Registration Options
 * @tags Account
 * @security BearerAuth
 */
app.post("/register/options", authenticate, requireBrowserSession, async (req, res) => {
    const options = await generateRegistrationOptions(req, req.user.id, req.body.origin);
    res.json(options);
});

/**
 * POST /accounts/passkeys/register/verify
 * @summary Verify Passkey Registration
 * @tags Account
 * @security BearerAuth
 */
app.post("/register/verify", authenticate, requireBrowserSession, async (req, res) => {
    if (validateSchema(res, passkeyRegistrationValidation, req.body)) return;
    const result = await verifyRegistration(req, req.user.id, req.body.response, req.body.name, req.body.origin);
    if (result?.code) return sendFailure(res, result);
    res.json({ message: "Passkey registered successfully", verified: true });
});

/**
 * DELETE /accounts/passkeys/{id}
 * @summary Delete Passkey
 * @tags Account
 * @security BearerAuth
 */
app.delete("/:id", authenticate, requireBrowserSession, async (req, res) => {
    const passkeyId = parseInt(req.params.id, 10);
    if (isNaN(passkeyId)) return sendFailure(res, { code: 400, message: "Invalid passkey ID" });
    const result = await deletePasskey(req.user.id, passkeyId);
    if (result?.code) return sendFailure(res, result);
    res.json({ message: "Passkey deleted successfully" });
});

/**
 * PATCH /accounts/passkeys/{id}
 * @summary Rename Passkey
 * @tags Account
 * @security BearerAuth
 */
app.patch("/:id", authenticate, requireBrowserSession, async (req, res) => {
    if (validateSchema(res, passkeyRenameValidation, req.body)) return;
    const passkeyId = parseInt(req.params.id, 10);
    if (isNaN(passkeyId)) return sendFailure(res, { code: 400, message: "Invalid passkey ID" });
    const result = await renamePasskey(req.user.id, passkeyId, req.body.name);
    if (result?.code) return sendFailure(res, result);
    res.json({ message: "Passkey renamed successfully" });
});

module.exports = app;
