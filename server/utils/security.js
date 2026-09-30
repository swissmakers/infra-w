const https = require("https");

const parseBooleanEnv = (name, defaultValue) => {
    const raw = process.env[name];
    if (raw === undefined) return defaultValue;
    return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
};

const isStrictTlsEnabled = () => parseBooleanEnv("STRICT_TLS", true);

const createHttpsAgent = () => new https.Agent({
    rejectUnauthorized: isStrictTlsEnabled(),
});

const getLdapTlsOptions = () => ({
    rejectUnauthorized: isStrictTlsEnabled(),
});

module.exports = {
    isStrictTlsEnabled,
    createHttpsAgent,
    getLdapTlsOptions,
};
