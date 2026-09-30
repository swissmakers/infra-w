const express = require("express");
const { getFTSStatus } = require("../controllers/account");
const packageJson = require("../../package.json");
const net = require("net");
const db = require("../utils/database");
const GuacdClient = require("../lib/GuacdClient");

const app = express.Router();

/**
 * GET /service/is-fts
 * @summary Check Status
 * @description Determines if the INFRA-W server requires initial setup. This endpoint is used during the first-time setup process to check if the server has been configured with initial user accounts and settings.
 * @tags Service
 * @produces application/json
 * @return {boolean} 200 - First Time Setup status information
 */
app.get("/is-fts", (req, res) => {
    getFTSStatus()
        .then(status => res.json(status))
        .catch(err => res.status(500).json({ code: 500, message: err.message }));
});

/**
 * GET /service/version
 * @summary Get Version
 * @description Returns the current INFRA-W server version.
 * @tags Service
 * @produces application/json
 * @return {object} 200 - Version information
 */
app.get("/version", (req, res) => {
    res.json({ version: packageJson.version });
});

/**
 * GET /service/health
 * @summary Health Check
 * @description Reports whether the database answers and guacd (remote desktops) accepts connections. Used by the container health check.
 * @tags Service
 * @produces application/json
 * @return {object} 200 - All components work
 * @return {object} 503 - A component does not work
 */
app.get("/health", async (req, res) => {
    const [database, guacd] = await Promise.all([
        db.query("SELECT 1").then(() => "ok", () => "unavailable"),
        new Promise(resolve => {
            const socket = net.connect({ host: GuacdClient.HOST, port: GuacdClient.PORT, timeout: 2000 });
            const finish = state => { socket.destroy(); resolve(state); };
            socket.once("connect", () => finish("ok"));
            socket.once("timeout", () => finish("unavailable"));
            socket.once("error", () => finish("unavailable"));
        }),
    ]);
    const healthy = database === "ok" && guacd === "ok";
    res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "degraded", database, guacd });
});

module.exports = app;