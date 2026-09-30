import "./styles.sass";
import SelectBox from "@/common/components/SelectBox";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSection, SettingsRow } from "@/pages/Settings/components/SettingsLayout.jsx";
import { usePreferences } from "@/common/contexts";

export const Terminal = () => {
    const { t } = useTranslation();
    const {
        selectedTheme, setSelectedTheme, selectedFont, setSelectedFont,
        fontSize, setFontSize, cursorStyle, setCursorStyle, cursorBlink, setCursorBlink,
        getAvailableThemes, getAvailableFonts, getTerminalTheme, getCursorStyles,
    } = usePreferences();

    const [previewText] = useState(t("settings.terminal.preview.text"));
    const themes = getAvailableThemes();
    const fonts = getAvailableFonts();
    const cursorStyles = getCursorStyles();

    const fontOptions = fonts.map(font => ({ label: font.name, value: font.value }));
    const fontSizeOptions = Array.from({ length: 13 }, (_, i) => i + 10)
        .concat([24, 26, 28, 30, 32])
        .map(size => ({ label: `${size}px`, value: size }));
    const cursorStyleOptions = cursorStyles.map(value => ({ label: t(`settings.terminal.cursor.styles.${value}`), value }));

    const cursorBlinkOptions = [
        { label: t("settings.terminal.cursor.enabled"), value: "true" }, 
        { label: t("settings.terminal.cursor.disabled"), value: "false" }
    ];

    const fontStyle = { fontFamily: selectedFont, fontSize: `${fontSize}px` };

    const renderTerminalPreview = (theme) => {
        const themeColors = getTerminalTheme(theme.key);
        const previewLines = previewText.split("\n");

        return (
            <div className="terminal-preview"
                 style={{ backgroundColor: themeColors.background, color: themeColors.foreground, ...fontStyle }}>
                <div className="terminal-content" style={fontStyle}>
                    {previewLines.map((line, index) => (
                        <div key={index} className="terminal-line" style={fontStyle}>
                            {line}
                            {index === previewLines.length - 1 && (
                                <span
                                    className={`terminal-cursor cursor-${cursorStyle} ${cursorBlink ? "blinking" : ""}`}
                                    style={{
                                        backgroundColor: cursorStyle === "block" ? themeColors.cursor : "transparent",
                                        borderColor: themeColors.cursor,
                                    }} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderSection = (key, children) => (
        <SettingsSection title={t(`settings.terminal.${key}.title`)} description={t(`settings.terminal.${key}.description`)}>
            {children}
        </SettingsSection>
    );

    const renderOption = (label, options, selected, setter) => (
        <SettingsRow title={label}>
            <SelectBox options={options} selected={selected} setSelected={setter} />
        </SettingsRow>
    );

    return (
        <>
            {renderSection("font", <>
                {renderOption(t("settings.terminal.font.fontFamily"), fontOptions, selectedFont, setSelectedFont)}
                {renderOption(t("settings.terminal.font.fontSize"), fontSizeOptions, fontSize, setFontSize)}
            </>)}

            {renderSection("cursor", <>
                {renderOption(t("settings.terminal.cursor.cursorStyle"), cursorStyleOptions, cursorStyle, setCursorStyle)}
                {renderOption(t("settings.terminal.cursor.cursorBlinking"), cursorBlinkOptions, cursorBlink.toString(), (value) => setCursorBlink(value === "true"))}
            </>)}

            {renderSection("theme", (
                <div className="theme-cards">
                    {themes.map((theme) => (
                        <button type="button" key={theme.key} aria-pressed={selectedTheme === theme.key}
                            className={`theme-card ${selectedTheme === theme.key ? "selected" : ""}`}
                            onClick={() => setSelectedTheme(theme.key)}>
                            <div className="theme-header">
                                <h4>{theme.key === "default" ? t("settings.terminal.theme.default") : theme.name}</h4>
                                {selectedTheme === theme.key && <div className="selected-indicator" />}
                            </div>
                            {renderTerminalPreview(theme)}
                        </button>
                    ))}
                </div>
            ))}
        </>
    );
};
