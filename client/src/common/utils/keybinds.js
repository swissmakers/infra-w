export const isMac = () =>
    navigator.userAgentData
        ? navigator.userAgentData.platform === "macOS"
        : /Mac/i.test(navigator.userAgent);

export const parseKeybind = (keybind) => {
    if (!keybind) return null;

    const parts = keybind.toLowerCase().split("+");
    return {
        ctrl: parts.includes("ctrl"),
        shift: parts.includes("shift"),
        alt: parts.includes("alt"),
        meta: parts.includes("meta"),
        key: parts[parts.length - 1],
        original: keybind
    };
};

export const matchesKeybind = (event, parsedKeybind) => {
    if (!parsedKeybind) return false;

    const mac = isMac();

    if (event.key.toLowerCase() !== parsedKeybind.key) return false;

    if (parsedKeybind.ctrl) {
        if (mac) {
            if (!(event.ctrlKey || event.metaKey)) return false;
        } else {
            if (!event.ctrlKey) return false;
        }
    } else {
        if (event.ctrlKey) return false;
    }

    if (parsedKeybind.meta && !event.metaKey) return false;
    if (!parsedKeybind.meta && event.metaKey && !parsedKeybind.ctrl) return false;

    if (event.shiftKey !== parsedKeybind.shift) return false;
    if (event.altKey !== parsedKeybind.alt) return false;

    return true;
};
