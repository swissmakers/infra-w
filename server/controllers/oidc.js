const client = require("openid-client");
const { joinOrganizations } = require("./organization");
const OIDCProvider = require("../models/OIDCProvider");
const LDAPProvider = require("../models/LDAPProvider");
const Account = require("../models/Account");
const { createSignInSession, refuseLockedAccount, directoryRole } = require("../utils/sessionAuth");
const { genSalt, hash } = require("bcrypt");
const crypto = require("crypto");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

const stateStore = new Map();

const hasOtherEnabledProvider = async (excludeOidcId = null) => {
    const [oidc, ldap] = await Promise.all([
        OIDCProvider.findOne({ where: excludeOidcId ? { enabled: true, id: { [Op.ne]: excludeOidcId } } : { enabled: true } }),
        LDAPProvider.findOne({ where: { enabled: true } }),
    ]);
    return !!(oidc || ldap);
};

const groupsOf = (claim) => (Array.isArray(claim) ? claim : typeof claim === "string" ? claim.split(",") : [])
    .map(group => String(group).trim().toLowerCase()).filter(Boolean);

const mapGroups = (provider, claims) => {
    const groups = new Set(groupsOf(claims[provider.groupsClaim || "groups"]));
    const has = group => groups.has(String(group).trim().toLowerCase());
    return {
        role: provider.adminGroups?.length ? (provider.adminGroups.some(has) ? "admin" : "user") : null,
        organizationIds: (provider.organizationGroups || []).filter(mapping => has(mapping.group)).map(mapping => mapping.organizationId),
    };
};

module.exports.mapGroups = mapGroups;

module.exports.listProviders = async (includeSecret = false) => {
    const providers = await OIDCProvider.findAll();

    if (!includeSecret) {
        return providers.map(provider => ({
            id: provider.id, name: provider.name, issuer: provider.issuer,
            clientId: provider.clientId, redirectUri: provider.redirectUri, scope: provider.scope,
            enabled: provider.enabled,
            usernameAttribute: provider.usernameAttribute,
            firstNameAttribute: provider.firstNameAttribute, lastNameAttribute: provider.lastNameAttribute,
            isInternal: provider.isInternal,
            groupsClaim: provider.groupsClaim, adminGroups: provider.adminGroups, organizationGroups: provider.organizationGroups,
        }));
    }

    return providers;
};

// public: only what the sign-in page needs
module.exports.listPublicProviders = async () => {
    const [providers, ldapProvider] = await Promise.all([
        OIDCProvider.findAll(),
        LDAPProvider.findOne({ where: { enabled: true } }),
    ]);
    return providers.filter(provider => provider.enabled || provider.isInternal).map(provider => ({
        id: provider.id, name: provider.name, issuer: provider.issuer, isInternal: provider.isInternal,
        enabled: provider.isInternal ? Boolean(provider.enabled || ldapProvider) : true,
    }));
};

module.exports.createProvider = async (data) => {
    return OIDCProvider.create(data);
};

module.exports.updateProvider = async (providerId, data) => {
    const provider = await OIDCProvider.findByPk(providerId);
    if (!provider) return { code: 404, message: "Provider not found" };

    if (data.enabled === false && provider.enabled) {
        if (!await hasOtherEnabledProvider(providerId)) {
            return { code: 400, message: "At least one authentication provider must remain enabled" };
        }
    }

    if (provider.isInternal) {
        if (Object.keys(data).length !== 1 || !Object.hasOwn(data, "enabled")) {
            return { code: 400, message: "Internal authentication provider can only be enabled or disabled" };
        }

        if (data.enabled === true) {
            await LDAPProvider.update({ enabled: false }, { where: {} });
        }
    }

    await OIDCProvider.update(data, { where: { id: providerId } });
    return { message: "Provider updated successfully" };
};

module.exports.deleteProvider = async (providerId) => {
    const provider = await OIDCProvider.findByPk(providerId);
    if (!provider) {
        return { code: 404, message: "Provider not found" };
    }

    if (provider.isInternal) {
        return { code: 400, message: "Cannot delete internal authentication provider" };
    }

    if (provider.enabled && !await hasOtherEnabledProvider(providerId)) {
        return { code: 400, message: "Cannot delete the only enabled authentication provider" };
    }

    await OIDCProvider.destroy({ where: { id: providerId } });
    return { message: "Provider deleted successfully" };
};

module.exports.initiateOIDCLogin = async (providerId) => {
    try {
        const provider = await OIDCProvider.findByPk(providerId);

        if (!provider || !provider.enabled) {
            return { code: 404, message: "Provider not found or disabled" };
        }

        const configuration = await client.discovery(
            new URL(provider.issuer),
            provider.clientId,
            provider.clientSecret,
        );

        const state = client.randomState();
        const nonce = client.randomNonce();

        const codeVerifier = client.randomPKCECodeVerifier();
        const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

        stateStore.set(state, { nonce, providerId, codeVerifier, timestamp: Date.now() });

        for (const [key, value] of stateStore.entries()) {
            if (Date.now() - value.timestamp > 10 * 60 * 1000) {
                stateStore.delete(key);
            }
        }

        const parameters = { 
            redirect_uri: provider.redirectUri, 
            scope: provider.scope, 
            state, 
            nonce,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        };
        const redirectTo = client.buildAuthorizationUrl(configuration, parameters);

        return { url: redirectTo.href };
    } catch (error) {
        logger.error("OIDC login initiation failed", { providerId, error: error.message, stack: error.stack });
        return { code: 500, message: "Failed to initiate OIDC login: " + error.message };
    }
};

module.exports.handleOIDCCallback = async (query, userInfo) => {
    try {
        const storedData = stateStore.get(query.state);
        if (!storedData) {
            logger.warn("OIDC callback received with invalid or expired state", { state: query.state });
            return { code: 400, message: "Invalid or expired state" };
        }

        stateStore.delete(query.state);

        const { providerId, nonce, codeVerifier } = storedData;
        const provider = await OIDCProvider.findByPk(providerId);

        if (!provider) {
            return { code: 404, message: "Provider not found" };
        }

        const configuration = await client.discovery(new URL(provider.issuer), provider.clientId, provider.clientSecret);

        const url = new URL(provider.redirectUri + "?" + new URLSearchParams(query).toString());

        const tokens = await client.authorizationCodeGrant(configuration, url, {
            expectedState: query.state,
            expectedNonce: nonce,
            pkceCodeVerifier: codeVerifier,
        });

        let userinfo;
        try {
            userinfo = await client.fetchUserInfo(configuration, tokens.access_token, tokens.claims().sub);
        } catch (userinfoError) {
            logger.warn("Failed to fetch userinfo, falling back to ID token claims", { error: userinfoError.message });
            userinfo = tokens.claims();
        }

        const username = userinfo[provider.usernameAttribute] || userinfo.preferred_username || userinfo.email || userinfo.sub;
        const { role, organizationIds } = mapGroups(provider, { ...tokens.claims(), ...userinfo });
        const firstName = userinfo[provider.firstNameAttribute] || userinfo.given_name || "";
        const lastName = userinfo[provider.lastNameAttribute] || userinfo.family_name || "";

        let account = await Account.findOne({ where: { username: String(username) } });

        if (account && account.authProviderType !== "oidc") {
            logger.warn("OIDC login rejected: username belongs to another authentication source", { accountId: account.id });
            return { code: 403, message: "This username belongs to another sign-in method" };
        }

        const locked = await refuseLockedAccount(account, { ip: userInfo.ip, userAgent: userInfo.userAgent, method: "oidc" });
        if (locked) return locked;

        if (!account) {
            const randomPassword = crypto.randomBytes(16).toString("hex");
            const salt = await genSalt(10);
            const hashedPassword = await hash(randomPassword, salt);

            account = await Account.create({
                username: String(username),
                password: hashedPassword,
                firstName: String(firstName),
                lastName: String(lastName),
                role: role || "user",
                authProviderType: "oidc",
                authProviderName: provider.name,
            });
        } else {
            const newRole = await directoryRole(account, role);
            await Account.update({
                firstName: String(firstName),
                lastName: String(lastName),
                ...(newRole && { role: newRole }),
            }, { where: { id: account.id } });
            if (newRole && newRole !== account.role) logger.system("OIDC group mapping changed the role", { accountId: account.id, role: newRole });
            if (newRole) account = { ...account, role: newRole };
        }
        await joinOrganizations(account.id, organizationIds);

        const session = await createSignInSession(account, { ip: userInfo.ip, userAgent: userInfo.userAgent, method: "oidc" });

        return {
            token: session.token,
            user: {
                id: account.id,
                username: account.username,
                firstName: account.firstName,
                lastName: account.lastName,
                role: account.role,
            },
        };
    } catch (error) {
        logger.error("OIDC callback processing failed", { error: error.message, stack: error.stack });
        return { code: 500, message: "Failed to process OIDC login: " + error.message };
    }
};

module.exports.ensureInternalProvider = async () => {
    const internalProvider = await OIDCProvider.findOne({ where: { isInternal: true } });

    if (!internalProvider) {
        await OIDCProvider.create({
            name: "Internal Authentication",
            issuer: "internal",
            clientId: "internal",
            clientSecret: null,
            redirectUri: "internal",
            scope: "internal",
            enabled: true,
            isInternal: true,
            usernameAttribute: "username",
            firstNameAttribute: "firstName",
            lastNameAttribute: "lastName",
        });
    }
};

