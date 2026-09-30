const { resolveSession } = require("../utils/sessionAuth");
const { resolveApiToken, API_TOKEN_PREFIX } = require("../utils/apiTokens");
const { getClientIp } = require("../utils/requestIp");

const READ_METHODS = ["GET", "HEAD", "OPTIONS"];

module.exports.authenticate = async (req, res, next) => {
    const authHeader = req.header("authorization");
    if (!authHeader)
        return res.status(400).json({ message: "You need to provide the 'authorization' header" });

    const headerTrimmed = authHeader.split(" ");
    if (headerTrimmed.length !== 2)
        return res.status(400).json({ message: "You need to provide the token in the 'authorization' header" });

    if (headerTrimmed[1].startsWith(API_TOKEN_PREFIX)) {
        const resolvedToken = await resolveApiToken(headerTrimmed[1]);
        if (!resolvedToken) return res.status(401).json({ code: 401, message: "The API token is not valid or has expired" });
        if (resolvedToken.token.scope === "read" && !READ_METHODS.includes(req.method))
            return res.status(403).json({ code: 403, message: "This API token can only read" });
        req.apiToken = resolvedToken.token;
        req.user = resolvedToken.account;
        req.session = null;
        return next();
    }

    const resolved = await resolveSession(headerTrimmed[1], { ip: getClientIp(req) });
    if (!resolved) return res.status(401).json({ message: "The provided token is not valid" });

    req.session = resolved.session;
    req.user = resolved.account;
    next();
};

module.exports.requireBrowserSession = (req, res, next) => (req.apiToken
    ? res.status(403).json({ code: 403, message: "This endpoint cannot be used with an API token" }) : next());

module.exports.authenticateDownload = async (req, res, next) => {
    const resolved = await resolveSession(req.query.token);
    if (!resolved) return res.status(401).json({ message: "Invalid token" });
    if (resolved.account.role !== "admin") return res.status(403).json({ message: "Admin access required" });

    req.user = resolved.account;
    req.session = resolved.session;
    next();
};
