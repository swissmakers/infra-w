const DEFAULTS = {
    ssh: { port: 22, renderer: "terminal" },
    rdp: { port: 3389, renderer: "guac" },
    vnc: { port: 5900, renderer: "guac" },
};

// an override to another protocol must not inherit the default's port or renderer
const resolveProtocolAction = (defaults = {}, override = {}) => {
    const protocol = override.protocol || defaults.protocol || "ssh";
    if (!DEFAULTS[protocol]) throw new Error(`Unsupported NetBox protocol: ${protocol}`);
    const inherited = protocol === (defaults.protocol || "ssh") ? defaults : {};
    const action = { ...DEFAULTS[protocol], ...inherited, ...override, protocol };
    action.port = Number(action.port || DEFAULTS[protocol].port);
    action.renderer = action.renderer || DEFAULTS[protocol].renderer;
    if (!Number.isInteger(action.port) || action.port < 1 || action.port > 65535) {
        throw new Error("Invalid NetBox protocol port");
    }
    return action;
};

module.exports = { resolveProtocolAction };
