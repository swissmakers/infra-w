import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { SettingsRow } from "@/pages/Settings/components/SettingsLayout.jsx";
import "./styles.sass";
import { useToast } from "@/common/contexts";

const ACTIVITY_TOGGLES = ["enableFileOperationAudit", "enableServerConnectionAudit", "enableIdentityManagementAudit",
    "enableIdentityCredentialsAccessAudit", "enableServerManagementAudit", "enableFolderManagementAudit", "enableScriptExecutionAudit"];

export const OrganizationAuditSettings = ({ organizationId }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [settings, setSettings] = useState(null);
    const text = key => t(`settings.organizations.audit.${key}`);
    const fieldId = key => `${key}-${organizationId}`;

    useEffect(() => {
        if (!organizationId) return;
        getRequest(`audit/organizations/${organizationId}/settings`).then(setSettings)
            .catch(() => sendToast("Error", t("settings.organizations.audit.loadFailed")));
    }, [organizationId, sendToast, t]);

    const saveSettings = async () => {
        try {
            await patchRequest(`audit/organizations/${organizationId}/settings`, settings);
            sendToast("Success", text("saved"));
        } catch {
            sendToast("Error", text("saveFailed"));
        }
    };

    if (!settings) return null;

    const toggleRow = (key, checked = settings[key], disabled = false) => (
        <SettingsRow key={key} title={text(`${key}.title`)} description={text(`${key}.description`)} htmlFor={fieldId(key)}>
            <ToggleSwitch id={fieldId(key)} checked={checked} disabled={disabled}
                onChange={value => setSettings(prev => ({ ...prev, [key]: value }))} />
        </SettingsRow>
    );

    const numberRow = (key, min, max, disabled) => (
        <SettingsRow title={text(`${key}.title`)} description={text(`${key}.description`)} htmlFor={fieldId(key)}>
            <input id={fieldId(key)} type="number" className="settings-number-input" min={min} max={max}
                value={settings[key]} disabled={disabled}
                onChange={event => {
                    const value = parseInt(event.target.value, 10);
                    if (value >= min && value <= max) setSettings(prev => ({ ...prev, [key]: value }));
                }} />
        </SettingsRow>
    );

    const group = (key, rows) => (
        <div className="audit-group">
            <h3>{text(`groups.${key}.title`)}</h3>
            <p>{text(`groups.${key}.description`)}</p>
            {rows}
        </div>
    );

    return (
        <div className="organization-audit-settings">
            {group("recording", <>
                {toggleRow("enableSessionRecording", settings.enableSessionRecording === true)}
                {numberRow("recordingRetentionDays", 1, 365, settings.enableSessionRecording !== true)}
            </>)}
            {group("sharing", <>
                {toggleRow("allowSessionSharing")}
                {toggleRow("allowWritableSharing", settings.allowWritableSharing, !settings.allowSessionSharing)}
                {numberRow("shareMaxHours", 1, 168, !settings.allowSessionSharing)}
            </>)}
            {group("connection", toggleRow("requireConnectionReason"))}
            {group("activity", ACTIVITY_TOGGLES.map(key => toggleRow(key)))}

            <div className="audit-actions"><Button text={text("save")} onClick={saveSettings} /></div>
        </div>
    );
};
