const { Router } = require("express");
const { sendFailure } = require("../utils/error");
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/permission");
const oidc = require("../controllers/oidc");
const ldap = require("../controllers/ldap");
const { validateSchema } = require("../utils/schema");
const { oidcProviderValidation, oidcProviderUpdateValidation } = require("../validations/oidc");
const { ldapProviderValidation, ldapProviderUpdateValidation, ldapTestUsersValidation, ldapDraftTestValidation } = require("../validations/ldap");
const { getClientIp } = require("../utils/requestIp");
const { auditRequest, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

// field names only, the values can hold secrets
const auditProvider = (req, action, type, id) => auditRequest(req, {
    action, resource: RESOURCE_TYPES.AUTH_PROVIDER, resourceId: Number(id),
    details: { type, ...(req.body?.name && { name: req.body.name }), fields: Object.keys(req.body || {}) },
});

const app = Router();

/**
 * GET /auth/providers
 * @summary List Public Auth Providers
 * @description What the sign-in page needs: the enabled OIDC providers (id, name, issuer) and the internal provider, whose enabled flag tells whether the password form is shown (it is also on while an LDAP provider is enabled).
 * @tags Auth Providers
 * @produces application/json
 * @return {array} 200 - List of auth providers with id, name, and enabled status
 */
app.get("/providers", async (req, res) => {
    try {
        const providers = await oidc.listPublicProviders();
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * GET /auth/providers/admin
 * @summary List All Auth Providers (Admin)
 * @description Retrieves all OIDC and LDAP providers with their full configurations for administrative management.
 * @tags Auth Providers
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Object containing oidc and ldap provider arrays
 * @return {object} 401 - User is not authenticated
 * @return {object} 403 - User is not an administrator
 */
app.get("/providers/admin", authenticate, isAdmin, async (req, res) => {
    try {
        const [oidcProviders, ldapProviders] = await Promise.all([
            oidc.listProviders(false),
            ldap.listProviders(false),
        ]);
        res.json({ oidc: oidcProviders, ldap: ldapProviders });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * PUT /auth/providers/admin/oidc
 * @summary Create OIDC Provider
 * @description Creates a new OIDC authentication provider with the specified configuration.
 * @tags Auth Providers
 * @produces application/json
 * @security BearerAuth
 * @param {OIDCProvider} request.body.required - OIDC provider configuration including name, issuer, clientId, clientSecret, redirectUri, and scope
 * @return {object} 201 - Provider created successfully with ID
 * @return {object} 400 - Validation error
 * @return {object} 401 - User is not authenticated
 * @return {object} 403 - User is not an administrator
 */
app.put("/providers/admin/oidc", authenticate, isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, oidcProviderValidation, req.body)) return;
        const provider = await oidc.createProvider(req.body);
        await auditProvider(req, AUDIT_ACTIONS.AUTH_PROVIDER_CREATE, "oidc", provider.id);
        res.status(201).json({ message: "Provider created successfully", id: provider.id });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * PATCH /auth/providers/admin/oidc/{id}
 * @summary Update OIDC Provider
 * @description Updates an existing OIDC provider's configuration. At least one provider must remain enabled.
 * @tags Auth Providers
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - OIDC provider ID
 * @param {OIDCProviderUpdate} request.body.required - Updated OIDC provider configuration
 * @return {object} 200 - Provider updated successfully
 * @return {object} 400 - Validation error or cannot disable last provider
 * @return {object} 401 - User is not authenticated
 * @return {object} 403 - User is not an administrator
 * @return {object} 404 - Provider not found
 */
app.patch("/providers/admin/oidc/:id", authenticate, isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, oidcProviderUpdateValidation, req.body)) return;
        const result = await oidc.updateProvider(req.params.id, req.body);
        if (result.code) return sendFailure(res, result);
        await auditProvider(req, AUDIT_ACTIONS.AUTH_PROVIDER_UPDATE, "oidc", req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * DELETE /auth/providers/admin/oidc/{id}
 * @summary Delete OIDC Provider
 * @description Deletes an OIDC provider. Cannot delete internal provider or the last enabled provider.
 * @tags Auth Providers
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - OIDC provider ID
 * @return {object} 200 - Provider deleted successfully
 * @return {object} 400 - Cannot delete internal provider or last enabled provider
 * @return {object} 401 - User is not authenticated
 * @return {object} 403 - User is not an administrator
 * @return {object} 404 - Provider not found
 */
app.delete("/providers/admin/oidc/:id", authenticate, isAdmin, async (req, res) => {
    try {
        const result = await oidc.deleteProvider(req.params.id);
        if (result.code) return sendFailure(res, result);
        await auditProvider(req, AUDIT_ACTIONS.AUTH_PROVIDER_DELETE, "oidc", req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * POST /auth/providers/admin/ldap/test
 * @summary Test LDAP Settings
 * @description Tests the entered LDAP settings (connection, bind and a user search) without saving or enabling a provider. The bind password of a saved provider is reused when the masked value is sent.
 * @tags Auth Providers
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - LDAP settings as in the provider dialog
 * @return {object} 200 - Test result with diagnostics
 * @return {object} 400 - Invalid settings
 * @return {object} 403 - User is not an administrator
 */
app.post("/providers/admin/ldap/test", authenticate, isAdmin, async (req, res) => {
    try {
        const { error, value } = ldapDraftTestValidation.validate(req.body);
        if (error) return res.status(400).json({ message: error.message });
        const result = await ldap.testDraftConnection(value);
        res.status(result.code || 200).json(result);
    } catch {
        res.status(500).json({ message: "LDAP connection test failed" });
    }
});

/**
 * PUT /auth/providers/admin/ldap
 * @summary Create LDAP Provider
 * @description Creates a new LDAP authentication provider with the specified configuration.
 * @tags Auth Providers
 * @produces application/json
 * @security BearerAuth
 * @param {LDAPProvider} request.body.required - LDAP provider configuration including name, host, port, bindDN, bindPassword, baseDN, and userSearchFilter
 * @return {object} 201 - Provider created successfully with ID
 * @return {object} 400 - Validation error
 * @return {object} 401 - User is not authenticated
 * @return {object} 403 - User is not an administrator
 */
app.put("/providers/admin/ldap", authenticate, isAdmin, async (req, res) => {
    try {
        const { error, value } = ldapProviderValidation.validate(req.body);
        if (error) return res.status(400).json({ message: error.message });
        const provider = await ldap.createProvider(value);
        await auditProvider(req, AUDIT_ACTIONS.AUTH_PROVIDER_CREATE, "ldap", provider.id);
        res.status(201).json({ message: "Provider created successfully", id: provider.id });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * PATCH /auth/providers/admin/ldap/{id}
 * @summary Update LDAP Provider
 * @description Updates an existing LDAP provider's configuration. At least one provider must remain enabled.
 * @tags Auth Providers
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - LDAP provider ID
 * @param {LDAPProviderUpdate} request.body.required - Updated LDAP provider configuration
 * @return {object} 200 - Provider updated successfully
 * @return {object} 400 - Validation error or cannot disable last provider
 * @return {object} 401 - User is not authenticated
 * @return {object} 403 - User is not an administrator
 * @return {object} 404 - Provider not found
 */
app.patch("/providers/admin/ldap/:id", authenticate, isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, ldapProviderUpdateValidation, req.body)) return;
        const result = await ldap.updateProvider(req.params.id, req.body);
        if (result.code) return sendFailure(res, result);
        await auditProvider(req, AUDIT_ACTIONS.AUTH_PROVIDER_UPDATE, "ldap", req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * DELETE /auth/providers/admin/ldap/{id}
 * @summary Delete LDAP Provider
 * @description Deletes an LDAP provider. Cannot delete if it's the last enabled provider.
 * @tags Auth Providers
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - LDAP provider ID
 * @return {object} 200 - Provider deleted successfully
 * @return {object} 400 - Cannot delete last enabled provider
 * @return {object} 401 - User is not authenticated
 * @return {object} 403 - User is not an administrator
 * @return {object} 404 - Provider not found
 */
app.delete("/providers/admin/ldap/:id", authenticate, isAdmin, async (req, res) => {
    try {
        const result = await ldap.deleteProvider(req.params.id);
        if (result.code) return sendFailure(res, result);
        await auditProvider(req, AUDIT_ACTIONS.AUTH_PROVIDER_DELETE, "ldap", req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * POST /auth/providers/admin/ldap/{id}/test-users
 * @summary Test LDAP User Discovery
 * @description Runs a user discovery test against the LDAP provider and returns a user preview plus admin-candidate matches.
 * @tags Auth Providers
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - LDAP provider ID
 * @param {object} request.body - Optional limit for preview (max 100)
 * @return {object} 200 - Test results with users and admin candidates
 * @return {object} 400 - Test failed or validation error
 * @return {object} 401 - User is not authenticated
 * @return {object} 403 - User is not an administrator
 * @return {object} 404 - Provider not found
 */
app.post("/providers/admin/ldap/:id/test-users", authenticate, isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, ldapTestUsersValidation, req.body || {})) return;
        const result = await ldap.testUsers(req.params.id, req.body || {});
        if (result.code) return sendFailure(res, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * POST /auth/oidc/login/{providerId}
 * @summary Initiate OIDC Login
 * @description Initiates the OIDC authentication flow for the specified provider. Returns an authorization URL to redirect the user.
 * @tags Auth Providers
 * @produces application/json
 * @param {string} providerId.path.required - OIDC provider ID
 * @return {object} 200 - Authorization URL for redirect
 * @return {object} 404 - Provider not found or disabled
 */
app.post("/oidc/login/:providerId", async (req, res) => {
    try {
        const result = await oidc.initiateOIDCLogin(req.params.providerId);
        if (result.code) return sendFailure(res, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * GET /auth/oidc/callback
 * @summary OIDC Callback
 * @description Handles the OIDC callback after user authentication. Redirects to the app with a session token or error.
 * @tags Auth Providers
 * @produces application/json
 * @param {string} code.query.required - Authorization code from OIDC provider
 * @param {string} state.query.required - State parameter for CSRF protection
 * @return {redirect} 302 - Redirects to app with token or error
 */
app.get("/oidc/callback", async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) return res.status(400).json({ message: "Missing required parameters" });

        const userInfo = { ip: getClientIp(req), userAgent: req.headers["user-agent"] };
        const result = await oidc.handleOIDCCallback(req.query, userInfo);

        if (result.code) return res.redirect(`/?error=${encodeURIComponent(result.message)}`);
        res.redirect(`/?token=${result.token}`);
    } catch (error) {
        res.redirect(`/?error=${encodeURIComponent("Authentication failed")}`);
    }
});

module.exports = app;
