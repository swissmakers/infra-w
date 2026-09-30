import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import SelectBox from "@/common/components/SelectBox";
import i18n, { languages } from "@/i18n.js";
import { SettingsSection, SettingsRow } from "@/pages/Settings/components/SettingsLayout.jsx";
import { UserContext, usePreferences, useToast } from "@/common/contexts";

export const Preferences = () => {
    const { t } = useTranslation();
    const { user, login } = useContext(UserContext);
    const { sendToast } = useToast();
    const { themeMode, setTheme, language, setLanguage } = usePreferences();
    const [sessionSync, setSessionSync] = useState(user?.sessionSync || "same_browser");

    const changeSessionSync = mode => {
        const previous = sessionSync;
        setSessionSync(mode);
        patchRequest("accounts/session-sync", { sessionSync: mode }).then(() => login()).catch(() => {
            setSessionSync(previous);
            sendToast("Error", t("common.errors.generalError"));
        });
    };

    return <SettingsSection>
        <SettingsRow title={t("settings.preferences.themeLabel")} description={t("settings.preferences.appearanceDescription")}>
            <SelectBox selected={themeMode} setSelected={setTheme} options={["light", "dark", "auto", "oled"].map(value =>
                ({ value, label: t(`settings.preferences.theme${value[0].toUpperCase()}${value.slice(1)}`) }))} />
        </SettingsRow>
        <SettingsRow title={t("settings.preferences.language")} description={t("settings.preferences.languageDescription")}>
            <SelectBox options={languages.map(lang => ({ label: lang.name, value: lang.code }))}
                selected={language || i18n.language || "en"} setSelected={setLanguage} />
        </SettingsRow>
        <SettingsRow title={t("settings.preferences.sessionSynchronization")} description={t(`settings.preferences.${{
            across_devices: "sessionSyncAcrossDevicesDesc", same_browser: "sessionSyncSameBrowserDesc", same_tab: "sessionSyncSameTabDesc",
        }[sessionSync]}`)}>
            <SelectBox selected={sessionSync} setSelected={changeSessionSync} options={[
                { label: t("settings.preferences.sessionSyncAcrossDevices"), value: "across_devices" },
                { label: t("settings.preferences.sessionSyncSameBrowser"), value: "same_browser" },
                { label: t("settings.preferences.sessionSyncSameTab"), value: "same_tab" },
            ]} />
        </SettingsRow>
    </SettingsSection>;
};
