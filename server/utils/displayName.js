module.exports.getDisplayName = (account) =>
    [account?.firstName, account?.lastName].filter(Boolean).join(" ") || account?.username || "";
