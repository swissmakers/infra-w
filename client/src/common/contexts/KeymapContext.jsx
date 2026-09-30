import { useCallback, useContext, useEffect, useState } from "react";
import { getRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { UserContext, KeymapContext } from "@/common/contexts";
import { isMac, parseKeybind } from "@/common/utils/keybinds.js";

export const KeymapProvider = ({ children }) => {
    const { user } = useContext(UserContext);
    const [keymaps, setKeymaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [parsedKeybinds, setParsedKeybinds] = useState({});
    const [prevUser, setPrevUser] = useState(user);

    if (user !== prevUser) {
        setPrevUser(user);
        if (user) setLoading(true);
    }

    const fetchKeymaps = useCallback(() => getRequest("keymaps")
        .then(data => {
            setKeymaps(data);

            const parsed = {};
            data.forEach(keymap => {
                if (keymap.enabled) parsed[keymap.action] = parseKeybind(keymap.key);
            });
            setParsedKeybinds(parsed);
        })
        .catch(error => console.error("Failed to load keymaps:", error))
        .finally(() => setLoading(false)), []);

    const loadKeymaps = async () => {
        if (!user) return;
        setLoading(true);
        await fetchKeymaps();
    };

    const updateKeymap = async (action, updates) => {
        try {
            await patchRequest(`keymaps/${action}`, updates);
            await loadKeymaps();
        } catch (error) {
            console.error("Failed to update keymap:", error);
            throw error;
        }
    };

    const resetKeymap = async (action) => {
        try {
            await postRequest(`keymaps/${action}/reset`);
            await loadKeymaps();
        } catch (error) {
            console.error("Failed to reset keymap:", error);
            throw error;
        }
    };

    const resetAllKeymaps = async () => {
        try {
            await postRequest("keymaps/reset");
            await loadKeymaps();
        } catch (error) {
            console.error("Failed to reset all keymaps:", error);
            throw error;
        }
    };

    const getParsedKeybind = (action) => parsedKeybinds[action] || null;
    const formatKey = (key) => {
        if (!key) return "";

        const mac = isMac();

        return key
            .split("+")
            .map(k => {
                if (mac && k === "ctrl") return "⌘";
                if (k === "meta") return mac ? "⌘" : "META";
                return k.toUpperCase();
            })
            .join(" + ");
    };

    useEffect(() => {
        if (user) fetchKeymaps();
    }, [user, fetchKeymaps]);

    return (
        <KeymapContext.Provider value={{
            keymaps,
            loading,
            updateKeymap,
            resetKeymap,
            resetAllKeymaps,
            getParsedKeybind,
            formatKey,
        }}>
            {children}
        </KeymapContext.Provider>
    );
};
