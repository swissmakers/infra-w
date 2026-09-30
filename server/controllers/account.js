const { genSalt, hash, compare } = require("bcrypt");
const { Op } = require("sequelize");
const Account = require("../models/Account");
const Folder = require("../models/Folder");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const EntryTag = require("../models/EntryTag");
const Identity = require("../models/Identity");
const Credential = require("../models/Credential");
const Tag = require("../models/Tag");
const Snippet = require("../models/Snippet");
const Script = require("../models/Script");
const Keymap = require("../models/Keymap");
const Session = require("../models/Session");
const OrganizationMember = require("../models/OrganizationMember");
const Passkey = require("../models/Passkey");
const ApiToken = require("../models/ApiToken");
const db = require("../utils/database");
const { handOverOrganizations } = require("./organization");
const speakeasy = require("speakeasy");
const logger = require("../utils/logger");
const SessionManager = require("../lib/SessionManager");
const stateBroadcaster = require("../lib/StateBroadcaster");
const { revokeSessions } = require("../utils/sessionAuth");

module.exports.createAccount = async (configuration, firstTimeSetup = true) => {
    if (await Account.count() > 0 && firstTimeSetup)
        return { code: 409, message: "First time setup is already completed" };

    const account = await Account.findOne({ where: { username: configuration.username } });

    if (account !== null)
        return { code: 409, message: "This account already exists" };

    const salt = await genSalt(10);
    const password = await hash(configuration.password, salt);

    const newAccount = await Account.create({ ...configuration, password, role: firstTimeSetup ? "admin" : "user" });

    logger.system(`Account created`, {
        accountId: newAccount.id,
        username: newAccount.username,
        role: newAccount.role,
        firstTimeSetup,
    });

    return { id: newAccount.id, username: newAccount.username, role: newAccount.role };
};

module.exports.deleteAccount = async (id) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 404, message: "The provided account does not exist" };

    if (await Account.count({ where: { role: "admin" } }) === 1 && account.role === "admin")
        return { code: 409, message: "You cannot delete the last admin account" };

    stateBroadcaster.forceLogout(id);
    await SessionManager.removeAllByAccountId(id);
    const organizations = await handOverOrganizations(Number(id));

    // organization items have no accountId and stay
    const ids = async (Model) => (await Model.findAll({ where: { accountId: id }, attributes: ["id"] })).map(row => row.id);
    const [entryIds, identityIds, tagIds] = [await ids(Entry), await ids(Identity), await ids(Tag)];
    await db.transaction(async (transaction) => {
        const options = where => ({ where, transaction });
        await EntryIdentity.destroy(options({ [Op.or]: [{ entryId: { [Op.in]: entryIds } }, { identityId: { [Op.in]: identityIds } }] }));
        await EntryTag.destroy(options({ [Op.or]: [{ entryId: { [Op.in]: entryIds } }, { tagId: { [Op.in]: tagIds } }] }));
        await Credential.destroy(options({ identityId: { [Op.in]: identityIds } }));
        for (const Model of [Entry, Identity, Tag, Folder, Snippet, Script, Keymap, Passkey, ApiToken, Session, OrganizationMember]) {
            await Model.destroy(options({ accountId: id }));
        }
        await Account.destroy(options({ id }));
    });

    logger.system(`Account deleted`, { accountId: id, username: account.username });
    return { username: account.username, organizations };
};

module.exports.updateName = async (id, configuration) => {
    const account = await Account.findByPk(id);
    if (account === null)
        return { code: 404, message: "The provided account does not exist" };

    const firstName = configuration.firstName !== undefined
        ? String(configuration.firstName).trim()
        : (account.firstName ?? "");
    const lastName = configuration.lastName !== undefined
        ? String(configuration.lastName).trim()
        : (account.lastName ?? "");

    await Account.update({ firstName, lastName }, { where: { id } });
};

const setPassword = async (accountId, password) =>
    Account.update({ password: await hash(password, await genSalt(10)) }, { where: { id: accountId } });

module.exports.updatePassword = async (id, password) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 404, message: "The provided account does not exist" };
    if (account.authProviderType)
        return { code: 400, message: "The password of this account is managed by its sign-in provider" };

    await setPassword(account.id, password);
    await revokeSessions(await Session.findAll({ where: { accountId: account.id }, attributes: ["id", "accountId"] }));
};

module.exports.changeOwnPassword = async (account, currentSessionId, currentPassword, password) => {
    if (account.authProviderType)
        return { code: 400, message: "The password of this account is managed by its sign-in provider" };

    if (!(await compare(currentPassword, account.password)))
        return { code: 403, message: "The current password is incorrect" };

    await setPassword(account.id, password);
    await revokeSessions(await Session.findAll({
        where: { accountId: account.id, id: { [Op.ne]: currentSessionId } }, attributes: ["id", "accountId"],
    }));
};

module.exports.updateRole = async (id, role) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 404, message: "The provided account does not exist" };

    if (role === account.role)
        return { code: 400, message: "The provided role is the same as the current role" };

    if (role !== "admin" && role !== "user")
        return { code: 400, message: "The provided role is invalid" };

    await Account.update({ role }, { where: { id } });

    logger.system(`Account role updated`, {
        accountId: id,
        username: account.username,
        oldRole: account.role,
        newRole: role,
    });
};

// refusing self-locks keeps an active administrator
module.exports.setLocked = async (id, locked, actingAccountId) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 404, message: "The provided account does not exist" };
    if (account.id === actingAccountId)
        return { code: 400, message: "You cannot lock your own account" };
    if (Boolean(account.disabled) === locked)
        return { code: 409, message: `The account is already ${locked ? "locked" : "unlocked"}` };

    await Account.update({ disabled: locked }, { where: { id: account.id } });
    if (locked) await revokeSessions(await Session.findAll({ where: { accountId: account.id }, attributes: ["id", "accountId"] }));

    logger.system(`Account ${locked ? "locked" : "unlocked"}`, { accountId: account.id, username: account.username });
    return { username: account.username };
};

module.exports.resetSecondFactor = async (id) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 404, message: "The provided account does not exist" };

    const passkeys = await Passkey.destroy({ where: { accountId: account.id } });
    if (!account.totpEnabled && passkeys === 0)
        return { code: 409, message: "The account has no second factor to reset" };

    // a new secret keeps the lost authenticator from working again
    await Account.update({ totpEnabled: false, totpSecret: speakeasy.generateSecret().base32 }, { where: { id: account.id } });

    logger.system("Second factor reset", { accountId: account.id, username: account.username });
    return { username: account.username, totp: Boolean(account.totpEnabled), passkeys };
};

module.exports.updateTOTP = async (id, status) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 404, message: "The provided account does not exist" };

    if (account.totpEnabled === status)
        return { code: 409, message: `TOTP is already ${status ? "enabled" : "disabled"} on your account` };

    await Account.update({ totpEnabled: status }, { where: { id } });
};

module.exports.updateSessionSync = async (id, sessionSync) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 404, message: "The provided account does not exist" };

    await Account.update({ sessionSync }, { where: { id } });
};

const deepMerge = (target, source) => {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
};

module.exports.updatePreferences = async (id, preferences) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 404, message: "The provided account does not exist" };

    const currentPreferences = account.preferences || {};
    const mergedPreferences = deepMerge(currentPreferences, preferences);

    await Account.update({ preferences: mergedPreferences }, { where: { id } });

    return mergedPreferences;
};

module.exports.getFTSStatus = async () => {
    return await Account.count() === 0;
};

module.exports.searchUsers = async (search = "") => {
    if (!search || search.trim().length < 3) {
        return { users: [] };
    }

    const searchTerm = `%${search.trim()}%`;
    const users = await Account.findAll({
        where: {
            [Op.or]: [
                { username: { [Op.like]: searchTerm } },
                { firstName: { [Op.like]: searchTerm } },
                { lastName: { [Op.like]: searchTerm } },
            ],
        },
        attributes: ["id", "username", "firstName", "lastName", "role"],
        limit: 5,
        order: [["username", "ASC"]],
    });

    return { users };
};

module.exports.listUsers = async (options = {}) => {
    const { search = "", limit = 50, offset = 0 } = options;

    const whereClause = {};

    if (search) {
        const searchTerm = `%${search}%`;
        whereClause[Op.or] = [
            { username: { [Op.like]: searchTerm } },
            { firstName: { [Op.like]: searchTerm } },
            { lastName: { [Op.like]: searchTerm } },
        ];
    }

    const [users, total] = await Promise.all([
        Account.findAll({
            where: whereClause,
            attributes: { exclude: ["password", "totpSecret", "preferences", "sessionSync"] },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["id", "DESC"]],
        }),
        Account.count({ where: whereClause }),
    ]);

    const passkeys = await Passkey.findAll({ where: { accountId: { [Op.in]: users.map(user => user.id) } }, attributes: ["accountId"] });
    const passkeyCount = id => passkeys.filter(passkey => passkey.accountId === id).length;

    return {
        users: users.map(user => ({ ...user, disabled: Boolean(user.disabled), totpEnabled: Boolean(user.totpEnabled), passkeys: passkeyCount(user.id) })),
        total,
    };
};