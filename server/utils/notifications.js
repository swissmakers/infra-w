const crypto = require("crypto");
const SystemSettings = require("../models/SystemSettings");
const { encrypt, decrypt } = require("./encryption");
const logger = require("./logger");
const { version } = require("../../package.json");
const { NOTIFICATION_EVENTS } = require("../validations/systemSettings");

const WEBHOOK_TIMEOUT = 10000;

const readConfig = async () => {
    const row = await SystemSettings.findByPk(1);
    let events = [];
    try {
        events = JSON.parse(row?.webhookEvents || "[]");
    } catch {}
    return {
        webhookUrl: row?.webhookUrl || null,
        webhookEvents: events.filter(event => NOTIFICATION_EVENTS.includes(event)),
        secret: row?.webhookSecretEncrypted ? decrypt(row.webhookSecretEncrypted, row.webhookSecretIV, row.webhookSecretAuthTag) : null,
    };
};

const getNotificationSettings = async () => {
    const { webhookUrl, webhookEvents, secret } = await readConfig();
    return { webhookUrl, webhookEvents, hasSecret: Boolean(secret), events: NOTIFICATION_EVENTS };
};

const updateNotificationSettings = async ({ webhookUrl, webhookEvents, webhookSecret }) => {
    const changes = { webhookUrl: webhookUrl || null, webhookEvents: JSON.stringify(webhookEvents || []) };
    if (webhookSecret !== undefined) {
        const encrypted = webhookSecret ? encrypt(webhookSecret) : null;
        Object.assign(changes, { webhookSecretEncrypted: encrypted?.encrypted || null, webhookSecretIV: encrypted?.iv || null, webhookSecretAuthTag: encrypted?.authTag || null });
    }
    await SystemSettings.update(changes, { where: { id: 1 } });
    return getNotificationSettings();
};

// "text" is what Slack-style receivers (Slack, Mattermost, Google Chat) display
const sendWebhook = async ({ webhookUrl, secret }, { event, title, message, details = {} }) => {
    const body = JSON.stringify({ source: "INFRA-W", event, time: new Date().toISOString(), title, message, text: `${title}: ${message}`, details });
    const headers = { "Content-Type": "application/json", "User-Agent": `INFRA-W/${version}`, "X-INFRA-W-Event": event };
    if (secret) headers["X-INFRA-W-Signature"] = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
    const response = await fetch(webhookUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(WEBHOOK_TIMEOUT) });
    if (!response.ok) throw new Error(`The webhook answered with HTTP ${response.status}`);
};

const notify = async (event, content) => {
    try {
        const config = await readConfig();
        if (!config.webhookUrl || !config.webhookEvents.includes(event)) return;
        await sendWebhook(config, { event, ...content });
    } catch (error) {
        logger.warn("Notification webhook failed", { event, error: error.message });
    }
};

const sendTestNotification = async () => {
    const config = await readConfig();
    if (!config.webhookUrl) return { code: 400, message: "No webhook URL is set" };
    try {
        await sendWebhook(config, { event: "test", title: "INFRA-W test notification", message: "The webhook works." });
        return { success: true };
    } catch (error) {
        return { code: 502, message: error.message };
    }
};

module.exports = { NOTIFICATION_EVENTS, notify, getNotificationSettings, updateNotificationSettings, sendTestNotification, sendWebhook };
