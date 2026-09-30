import { useState, useEffect, useCallback, useContext, useMemo, useRef, useSyncExternalStore } from "react";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import i18n from "@/i18n.js";
import { PreferencesContext, UserContext } from "@/common/contexts";

const mergePreferences = (base = {}, updates = {}) => Object.entries(updates).reduce(
    (merged, [section, values]) => ({ ...merged, [section]: { ...merged[section], ...values } }), base);

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";
const getSystemTheme = () => window.matchMedia?.(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
const subscribeSystemTheme = (onChange) => {
    const query = window.matchMedia?.(SYSTEM_DARK_QUERY);
    query?.addEventListener("change", onChange);
    return () => query?.removeEventListener("change", onChange);
};

const DEFAULT_TERMINAL_THEMES = {
    default: {
        name: "Default",
        background: "#13181C",
        foreground: "#F5F5F5",
        brightWhite: "#FFFFFF",
        cursor: "#F5F5F5",
        black: "#000000",
        red: "#E25A5A",
        green: "#7FBF7F",
        yellow: "#FFBF7F",
        blue: "#7F7FBF",
        magenta: "#BF7FBF",
        cyan: "#7FBFBF",
        white: "#BFBFBF",
        brightBlack: "#404040",
        brightRed: "#FF6B6B",
        brightGreen: "#9ECEFF",
        brightYellow: "#FFD93D",
        brightBlue: "#9D9DFF",
        brightMagenta: "#FF9DFF",
        brightCyan: "#9DFFFF",
    },
    dracula: {
        name: "Dracula",
        background: "#282A36",
        foreground: "#F8F8F2",
        brightWhite: "#FFFFFF",
        cursor: "#F8F8F2",
        black: "#21222C",
        red: "#FF5555",
        green: "#50FA7B",
        yellow: "#F1FA8C",
        blue: "#BD93F9",
        magenta: "#FF79C6",
        cyan: "#8BE9FD",
        white: "#F8F8F2",
        brightBlack: "#6272A4",
        brightRed: "#FF6E6E",
        brightGreen: "#69FF94",
        brightYellow: "#FFFFA5",
        brightBlue: "#D6ACFF",
        brightMagenta: "#FF92DF",
        brightCyan: "#A4FFFF",
    },
    monokai: {
        name: "Monokai",
        background: "#272822",
        foreground: "#F8F8F2",
        brightWhite: "#F8F8F2",
        cursor: "#F8F8F0",
        black: "#272822",
        red: "#F92672",
        green: "#A6E22E",
        yellow: "#F4BF75",
        blue: "#66D9EF",
        magenta: "#AE81FF",
        cyan: "#A1EFE4",
        white: "#F8F8F2",
        brightBlack: "#75715E",
        brightRed: "#F92672",
        brightGreen: "#A6E22E",
        brightYellow: "#F4BF75",
        brightBlue: "#66D9EF",
        brightMagenta: "#AE81FF",
        brightCyan: "#A1EFE4",
    },
    solarizedDark: {
        name: "Solarized Dark",
        background: "#002B36",
        foreground: "#839496",
        brightWhite: "#FDF6E3",
        cursor: "#93A1A1",
        black: "#073642",
        red: "#DC322F",
        green: "#859900",
        yellow: "#B58900",
        blue: "#268BD2",
        magenta: "#D33682",
        cyan: "#2AA198",
        white: "#EEE8D5",
        brightBlack: "#002B36",
        brightRed: "#CB4B16",
        brightGreen: "#586E75",
        brightYellow: "#657B83",
        brightBlue: "#839496",
        brightMagenta: "#6C71C4",
        brightCyan: "#93A1A1",
    },
    nord: {
        name: "Nord",
        background: "#2E3440",
        foreground: "#D8DEE9",
        brightWhite: "#ECEFF4",
        cursor: "#D8DEE9",
        black: "#3B4252",
        red: "#BF616A",
        green: "#A3BE8C",
        yellow: "#EBCB8B",
        blue: "#81A1C1",
        magenta: "#B48EAD",
        cyan: "#88C0D0",
        white: "#E5E9F0",
        brightBlack: "#4C566A",
        brightRed: "#BF616A",
        brightGreen: "#A3BE8C",
        brightYellow: "#EBCB8B",
        brightBlue: "#81A1C1",
        brightMagenta: "#B48EAD",
        brightCyan: "#8FBCBB",
    },
    ocean: {
        name: "Ocean",
        background: "#001122",
        foreground: "#A3D5FF",
        brightWhite: "#FFFFFF",
        cursor: "#00CCFF",
        black: "#001122",
        red: "#FF6B6B",
        green: "#4ECDC4",
        yellow: "#FFE66D",
        blue: "#5DADE2",
        magenta: "#BB8FCE",
        cyan: "#76D7C4",
        white: "#BDC3C7",
        brightBlack: "#34495E",
        brightRed: "#FF8A80",
        brightGreen: "#80CBC4",
        brightYellow: "#FFF176",
        brightBlue: "#81D4FA",
        brightMagenta: "#CE93D8",
        brightCyan: "#A7FFEB",
    },
};

const DEFAULT_FONTS = [
    { name: "Monospace", value: "monospace" },
    { name: "Fira Code", value: "'Fira Code', monospace" },
    { name: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
    { name: "Source Code Pro", value: "'Source Code Pro', monospace" },
    { name: "Inconsolata", value: "Inconsolata, monospace" },
    { name: "Ubuntu Mono", value: "'Ubuntu Mono', monospace" },
    { name: "Roboto Mono", value: "'Roboto Mono', monospace" },
    { name: "Hack", value: "Hack, monospace" },
];

const CURSOR_STYLES = ["block", "underline", "bar"];

export const PreferencesProvider = ({ children }) => {
    const { user } = useContext(UserContext);
    const userId = user?.id;
    // stays on top of the account's values, also if the account reloads before the edits are saved
    const [edits, setEdits] = useState(() => ({ userId, values: {} }));
    const saveTimerRef = useRef(null);
    const pendingRef = useRef({});

    if (edits.userId !== userId) setEdits({ userId, values: {} });

    const preferences = useMemo(() => mergePreferences(user?.preferences, edits.values), [user?.preferences, edits.values]);
    const get = (path, fallback) => {
        const [section, key] = path.split(".");
        return preferences[section]?.[key] ?? fallback;
    };

    const save = useCallback(() => {
        clearTimeout(saveTimerRef.current);
        const updates = pendingRef.current;
        pendingRef.current = {};
        if (Object.keys(updates).length) {
            patchRequest("accounts/me/preferences", updates).catch(error => console.error("Saving preferences failed:", error));
        }
    }, []);

    const set = useCallback((path, value) => {
        const [section, key] = path.split(".");
        const update = { [section]: { [key]: value } };
        setEdits(prev => ({ ...prev, values: mergePreferences(prev.values, update) }));
        if (!userId) return;
        pendingRef.current = mergePreferences(pendingRef.current, update);
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(save, 500);
    }, [userId, save]);

    useEffect(() => {
        const saveWhenHidden = () => document.visibilityState === "hidden" && save();
        document.addEventListener("visibilitychange", saveWhenHidden);
        return () => {
            document.removeEventListener("visibilitychange", saveWhenHidden);
            save();
        };
    }, [save]);

    const themeMode = get("theme.mode", "auto");
    const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemTheme);
    const actualTheme = themeMode === "auto" ? systemTheme : themeMode;

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", actualTheme);
    }, [actualTheme]);

    const selectedTheme = get("terminal.theme", "default");
    const selectedFont = get("terminal.fontFamily", "monospace");
    const fontSize = get("terminal.fontSize", 16);
    const cursorStyle = get("terminal.cursorStyle", "block");
    const cursorBlink = get("terminal.cursorBlink", true);

    const getTerminalTheme = useCallback((theme) => {
        const baseTheme = DEFAULT_TERMINAL_THEMES[theme] || DEFAULT_TERMINAL_THEMES.default;
        if (themeMode === "oled" && theme === "default") {
            return { ...baseTheme, background: "#000000" };
        }
        return baseTheme;
    }, [themeMode]);

    const getCurrentTheme = useCallback(() => getTerminalTheme(selectedTheme), [getTerminalTheme, selectedTheme]);

    const getAvailableThemes = useCallback(() => Object.keys(DEFAULT_TERMINAL_THEMES).map(key => {
        const theme = DEFAULT_TERMINAL_THEMES[key];
        if (themeMode === "oled" && key === "default") {
            return { key, ...theme, background: "#000000" };
        }
        return { key, ...theme };
    }), [themeMode]);

    const getAvailableFonts = useCallback(() => DEFAULT_FONTS, []);
    const getCursorStyles = useCallback(() => CURSOR_STYLES, []);

    const setTheme = useCallback((mode) => set("theme.mode", mode), [set]);
    const toggleTheme = useCallback(() => setTheme(actualTheme === "light" ? "dark" : "light"), [setTheme, actualTheme]);

    const setSelectedTheme = useCallback((theme) => set("terminal.theme", theme), [set]);
    const setSelectedFont = useCallback((font) => set("terminal.fontFamily", font), [set]);
    const setFontSize = useCallback((size) => set("terminal.fontSize", size), [set]);
    const setCursorStyle = useCallback((style) => set("terminal.cursorStyle", style), [set]);
    const setCursorBlink = useCallback((blink) => set("terminal.cursorBlink", blink), [set]);

    const showThumbnails = get("files.showThumbnails", true);
    const defaultViewMode = get("files.defaultViewMode", "list");
    const showHiddenFiles = get("files.showHiddenFiles", false);
    const confirmBeforeDelete = get("files.confirmBeforeDelete", true);
    const dragDropAction = get("files.dragDropAction", "ask");

    const setShowThumbnails = useCallback((v) => set("files.showThumbnails", v), [set]);
    const setDefaultViewMode = useCallback((v) => set("files.defaultViewMode", v), [set]);
    const setShowHiddenFiles = useCallback((v) => set("files.showHiddenFiles", v), [set]);
    const setConfirmBeforeDelete = useCallback((v) => set("files.confirmBeforeDelete", v), [set]);
    const setDragDropAction = useCallback((v) => set("files.dragDropAction", v), [set]);

    const language = get("general.language", null);
    const setLanguage = useCallback((lang) => set("general.language", lang), [set]);

    useEffect(() => {
        if (language && i18n.language !== language) i18n.changeLanguage(language);
    }, [language]);

    return (
        <PreferencesContext.Provider value={{
            theme: actualTheme, themeMode, setTheme, toggleTheme,
            selectedTheme, setSelectedTheme, selectedFont, setSelectedFont, fontSize, setFontSize,
            cursorStyle, setCursorStyle, cursorBlink, setCursorBlink,
            getCurrentTheme, getTerminalTheme, getAvailableThemes, getAvailableFonts, getCursorStyles,
            showThumbnails, setShowThumbnails,
            defaultViewMode, setDefaultViewMode,
            showHiddenFiles, setShowHiddenFiles,
            confirmBeforeDelete, setConfirmBeforeDelete,
            dragDropAction, setDragDropAction,
            language, setLanguage,
        }}>
            {children}
        </PreferencesContext.Provider>
    );
};
