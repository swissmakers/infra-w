const { loadSecrets } = require("./utils/secrets");
loadSecrets();

const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const db = require("./utils/database");
const packageJson = require("../package.json");
const MigrationRunner = require("./utils/migrationRunner");
const { authenticate, requireBrowserSession } = require("./middlewares/auth");
const expressWs = require("express-ws");
const { startStatusChecker, stopStatusChecker } = require("./utils/statusChecker");
const { ensureInternalProvider } = require("./controllers/oidc");
const recordingService = require("./utils/recordingService");
const { isAdmin } = require("./middlewares/permission");
const logger = require("./utils/logger");
const backupService = require("./utils/backupService");
const { startNetboxIntegrationService, stopNetboxIntegrationService } = require("./utils/netboxIntegrationService");
const { getTrustProxyConfig } = require("./utils/requestIp");
const { startSessionSweep } = require("./utils/sessionAuth");
const { startAuditRetention } = require("./controllers/audit");
const { CERTS_DIR, ensureDataDirs } = require("./utils/dataPaths");
ensureDataDirs();

process.on("uncaughtException", (err) => require("./utils/uncaughtHandler")(err));

const APP_PORT = process.env.SERVER_PORT || 6989;
const HTTPS_PORT = process.env.HTTPS_PORT || 5878;

const CERT_PATH = path.join(CERTS_DIR, "cert.pem");
const KEY_PATH = path.join(CERTS_DIR, "key.pem");

const hasSSLCerts = () => fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

const app = expressWs(express()).app;
const trustProxyConfig = getTrustProxyConfig();
app.set("trust proxy", trustProxyConfig);

app.disable("x-powered-by");
app.use(express.json());

app.use("/api/service", require("./routes/service"));
app.use("/api/accounts", require("./routes/account"));
app.use("/api/accounts/passkeys", require("./routes/passkey"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/auth", require("./routes/authProviders"));

app.ws("/api/ws/term", require("./routes/term"));
app.ws("/api/ws/guac", require("./routes/guac"));
app.ws("/api/ws/sftp", require("./routes/sftpWS"));
app.ws("/api/ws/state", require("./routes/state"));

app.use("/api/entries/sftp", require("./routes/sftp"));

app.use("/api/users", authenticate, isAdmin, require("./routes/users"));
app.use("/api/settings", authenticate, isAdmin, require("./routes/systemSettings"));
app.use("/api/host-keys", authenticate, isAdmin, require("./routes/hostKeys"));
app.use("/api/sessions", authenticate, requireBrowserSession, require("./routes/session"));
app.use("/api/tokens", authenticate, requireBrowserSession, require("./routes/apiTokens"));
app.use("/api/connections", authenticate, require("./routes/serverSession"));
app.use("/api/folders", authenticate, require("./routes/folder"));
app.use("/api/entries", authenticate, require("./routes/entry"));
app.use("/api/status-checker", authenticate, require("./routes/statusChecker"));
app.use("/api/integrations", authenticate, require("./routes/integration"));
app.use("/api/audit", authenticate, isAdmin, require("./routes/audit"));
app.use("/api/identities", authenticate, require("./routes/identity"));
app.use("/api/snippets", authenticate, require("./routes/snippet"));
app.use("/api/organizations", authenticate, require("./routes/organization"));
app.use("/api/tags", authenticate, require("./routes/tag"));
app.use("/api/keymaps", authenticate, require("./routes/keymap"));
app.use("/api/backup/export", require("./routes/backupExport"));
app.use("/api/backup", authenticate, isAdmin, require("./routes/backup"));

app.use("/api/scripts", authenticate, require("./routes/scripts"));
app.use("/api/share", require("./routes/share"));

app.use("/api", (req, res) => res.status(404).json({ code: 404, message: "Not found" }));

if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../dist")));

    app.get("/{*name}", (req, res) =>
        res.sendFile(path.join(__dirname, "../dist", "index.html"))
    );
} else {
    app.get("/{*name}", (req, res) =>
        res.status(500).sendFile(path.join(__dirname, "templates", "env.html"))
    );
}

app.use((error, req, res, next) => {
    logger.error("Unhandled request error", { method: req.method, path: req.path, error: error.message });
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({ code: error.status || 500, message: error.status ? error.message : "Internal server error" });
});

if (!process.env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY not found. Set it via Docker secret (/run/secrets/encryption_key) or environment variable.");

logger.system(`Starting INFRA-W version ${packageJson.version} in ${process.env.NODE_ENV || 'development'} mode`);
logger.system(`Running on Node.js ${process.version}`);
logger.system("Configured proxy trust", {
    trustProxy: Array.isArray(trustProxyConfig) ? trustProxyConfig.join(",") : trustProxyConfig,
});

db.authenticate()
    .catch((err) => {
        logger.error("Could not connect to database", { error: err.message });
        process.exit(111);
    })
    .then(async () => {
        logger.system("Successfully connected to database");

        const migrationRunner = new MigrationRunner();
        await migrationRunner.runMigrations();

        await ensureInternalProvider();

        startSessionSweep();
        startAuditRetention();
        startStatusChecker();

        recordingService.start();

        backupService.start();
        startNetboxIntegrationService();

        app.listen(APP_PORT, () =>
            logger.system(`Server listening on port ${APP_PORT}`)
        );

        if (hasSSLCerts()) {
            try {
                const sslOptions = {
                    cert: fs.readFileSync(CERT_PATH),
                    key: fs.readFileSync(KEY_PATH)
                };

                const httpsServer = https.createServer(sslOptions, app);
                expressWs(app, httpsServer);

                httpsServer.listen(HTTPS_PORT, () =>
                    logger.system(`HTTPS server listening on port ${HTTPS_PORT}`)
                );
            } catch (err) {
                logger.error("Failed to start HTTPS server", { error: err.message });
            }
        }
    });

// node runs as PID 1 and would ignore SIGTERM, then get killed mid-write on container stop
let shuttingDown = false;
const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.system("Shutting down server");

    recordingService.stop();
    stopStatusChecker();
    backupService.stop();
    stopNetboxIntegrationService();

    await db.close();

    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
