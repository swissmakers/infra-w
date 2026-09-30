const speakeasy = require("speakeasy");

module.exports.verifyAccountTotp = (account, code) => {
    if (!account.totpEnabled) return null;
    if (!code) return { code: 202, message: "TOTP is required for this account" };
    if (!speakeasy.totp.verify({ secret: account.totpSecret || "", encoding: "base32", token: String(code) })) {
        return { code: 203, message: "Your provided code is invalid or has expired." };
    }
    return null;
};
