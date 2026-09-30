import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { SettingsSection, SettingsRow } from "@/pages/Settings/components/SettingsLayout.jsx";
import { useToast } from "@/common/contexts";

export const Monitoring = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [settings, setSettings] = useState(null);
    const [saving, setSaving] = useState(false);
    const text = key => t(`settings.monitoring.${key}`);

    useEffect(() => {
        getRequest("status-checker/settings/global").then(result => setSettings({
            statusCheckerEnabled: Boolean(result.statusCheckerEnabled),
            statusInterval: Number(result.statusInterval || 30),
        })).catch(() => sendToast("Error", t("settings.monitoring.errors.loadSettings")));
    }, [sendToast, t]);

    const saveSettings = async () => {
        setSaving(true);
        try {
            await patchRequest("status-checker/settings/global", settings);
            sendToast("Success", text("saveSuccess"));
        } catch {
            sendToast("Error", text("errors.saveSettings"));
        } finally {
            setSaving(false);
        }
    };

    if (!settings) return <p className="settings-empty" role="status">{text("loading")}</p>;

    return (
        <SettingsSection actions={<Button text={text("saveSettings")} onClick={saveSettings} disabled={saving} />}>
            <SettingsRow title={text("statusChecker.enable.title")} description={text("statusChecker.enable.description")} htmlFor="status-checker">
                <ToggleSwitch id="status-checker" checked={settings.statusCheckerEnabled}
                    onChange={value => setSettings(prev => ({ ...prev, statusCheckerEnabled: value }))} />
            </SettingsRow>
            {settings.statusCheckerEnabled && <SettingsRow title={text("statusChecker.interval.title")}
                description={text("statusChecker.interval.description")} htmlFor="status-interval">
                <input id="status-interval" className="settings-number-input" type="number" min={10} max={300} value={settings.statusInterval}
                    onChange={event => setSettings(prev => ({ ...prev, statusInterval: Math.max(10, Math.min(300, parseInt(event.target.value, 10) || 10)) }))} />
                <span className="settings-unit">{text("seconds")}</span>
            </SettingsRow>}
        </SettingsSection>
    );
};
