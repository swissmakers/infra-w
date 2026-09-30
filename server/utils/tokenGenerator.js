const logger = require("./logger");
const { normalizeCertFingerprints } = require("./certFingerprints");

module.exports.createVNCToken = (hostname, port, username, password, options = {}) => {
    logger.verbose(`VNC token generated`, { hostname, port });
    const settings = { hostname, port, password, "ignore-cert": true };

    if (username) settings.username = username;

    if (options.colorDepth) settings["color-depth"] = options.colorDepth;
    if (options.resizeMethod && options.resizeMethod !== "none") settings["resize-method"] = options.resizeMethod;

    return { connection: { type: "vnc", settings } };
};

module.exports.createRDPToken = (hostname, port, username, password, options = {}) => {
    let domain = "";
    if (username && username.includes("\\")) [domain, username] = username.split("\\");
    logger.verbose(`RDP token generated`, { hostname, port, domain });

    const settings = {
        hostname,
        username,
        port,
        password,
        domain,
        "server-layout": options.keyboardLayout || "en-us-qwerty",
    };

    // without a pin the certificate is not checked, most RDP hosts use self-signed ones
    const pinned = normalizeCertFingerprints(options.certFingerprints);
    if (pinned) settings["cert-fingerprints"] = pinned;
    else settings["ignore-cert"] = true;

    if (options.colorDepth) settings["color-depth"] = options.colorDepth;
    if (options.resizeMethod && options.resizeMethod !== "none") settings["resize-method"] = options.resizeMethod;

    if (options.enableWallpaper !== false) settings["enable-wallpaper"] = true;
    if (options.enableTheming !== false) settings["enable-theming"] = true;
    if (options.enableFontSmoothing !== false) settings["enable-font-smoothing"] = true;
    if (options.enableFullWindowDrag === true) settings["enable-full-window-drag"] = true;
    if (options.enableDesktopComposition === true) settings["enable-desktop-composition"] = true;
    if (options.enableMenuAnimations === true) settings["enable-menu-animations"] = true;

    return { connection: { type: "rdp", settings } };
};
