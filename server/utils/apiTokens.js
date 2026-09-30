const crypto = require("crypto");
const { Op } = require("sequelize");
const ApiToken = require("../models/ApiToken");
const Account = require("../models/Account");

const API_TOKEN_PREFIX = "infw_";
const LAST_USED_WRITE_INTERVAL = 5 * 60 * 1000;
const PUBLIC_FIELDS = ["id", "accountId", "name", "prefix", "scope", "expiresAt", "lastUsedAt", "createdAt"];

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const createApiToken = async (accountId, { name, scope, days }) => {
    const token = `${API_TOKEN_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
    const row = await ApiToken.create({ accountId, name, scope, tokenHash: hashToken(token), prefix: token.slice(0, 12),
        expiresAt: new Date(Date.now() + days * 24 * 3600 * 1000), createdAt: new Date() });
    return { token, ...Object.fromEntries(PUBLIC_FIELDS.map(field => [field, row[field]])) };
};

const listApiTokens = async (accountId = null) => {
    const tokens = await ApiToken.findAll({ where: accountId ? { accountId } : {}, attributes: PUBLIC_FIELDS, order: [["createdAt", "DESC"]] });
    if (accountId) return tokens;
    const accounts = await Account.findAll({ where: { id: { [Op.in]: [...new Set(tokens.map(t => t.accountId))] } }, attributes: ["id", "username", "firstName", "lastName"] });
    return tokens.map(token => ({ ...token, account: accounts.find(account => account.id === token.accountId) || null }));
};

const revokeApiToken = async (id, accountId = null) => {
    const token = await ApiToken.findOne({ where: { id, ...(accountId && { accountId }) }, attributes: ["id", "accountId", "name"] });
    if (!token) return { code: 404, message: "The API token does not exist" };
    await ApiToken.destroy({ where: { id: token.id } });
    return token;
};

const resolveApiToken = async (token) => {
    const row = await ApiToken.findOne({ where: { tokenHash: hashToken(token) } });
    if (!row || new Date(row.expiresAt) <= new Date()) return null;
    const account = await Account.findByPk(row.accountId);
    if (!account || account.disabled) return null;
    if (!row.lastUsedAt || Date.now() - new Date(row.lastUsedAt) > LAST_USED_WRITE_INTERVAL) {
        await ApiToken.update({ lastUsedAt: new Date() }, { where: { id: row.id } });
    }
    return { token: row, account };
};

module.exports = { API_TOKEN_PREFIX, createApiToken, listApiTokens, revokeApiToken, resolveApiToken };
