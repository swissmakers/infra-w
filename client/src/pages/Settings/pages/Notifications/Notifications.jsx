import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { mdiLinkVariant, mdiLockOutline, mdiSend } from "@mdi/js";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import Checkbox from "@/common/components/Checkbox";
import { SettingsSection, SettingsRow } from "@/pages/Settings/components/SettingsLayout.jsx";
import { getRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts";
import "./styles.sass";

const eventKey = event => event.replace(/[._](\w)/g, (_, letter) => letter.toUpperCase());

export const Notifications = () => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const [settings, setSettings] = useState(null);
    const [secret, setSecret] = useState("");
    const [removeSecret, setRemoveSecret] = useState(false);
    const [busy, setBusy] = useState(false);
    const text = (key, values) => t(`settings.notifications.${key}`, values);

    useEffect(() => {
        getRequest("settings/notifications").then(loaded => setSettings({ ...loaded, webhookUrl: loaded.webhookUrl || "" })).catch(showError);
    }, [showError]);

    if (!settings) return <p className="settings-empty" role="status">{t("common.loading")}</p>;

    const toggleEvent = (event, on) => setSettings(prev => ({ ...prev,
        webhookEvents: on ? [...prev.webhookEvents, event] : prev.webhookEvents.filter(item => item !== event) }));

    const save = async () => {
        setBusy(true);
        try {
            const saved = await patchRequest("settings/notifications", { webhookUrl: settings.webhookUrl.trim(), webhookEvents: settings.webhookEvents,
                ...(secret ? { webhookSecret: secret } : removeSecret ? { webhookSecret: "" } : {}) });
            setSettings({ ...saved, webhookUrl: saved.webhookUrl || "" });
            setSecret("");
            setRemoveSecret(false);
            sendToast("Success", text("saved"));
        } catch (error) {
            showError(error, text("saveFailed"));
        } finally {
            setBusy(false);
        }
    };

    const sendTest = () => postRequest("settings/notifications/test").then(() => sendToast("Success", text("testSent")))
        .catch(error => showError(error, text("testFailed")));

    return <SettingsSection actions={<>
        <Button type="secondary" icon={mdiSend} text={text("sendTest")} onClick={sendTest} disabled={busy || !settings.webhookUrl} />
        <Button text={t("common.actions.save")} onClick={save} disabled={busy} />
    </>}>
        <SettingsRow title={text("url")} description={text("urlDescription")} htmlFor="webhook-url">
            <IconInput id="webhook-url" type="url" icon={mdiLinkVariant} value={settings.webhookUrl} placeholder="https://"
                setValue={webhookUrl => setSettings(prev => ({ ...prev, webhookUrl }))} />
        </SettingsRow>
        <SettingsRow title={text("secret")} description={text("secretDescription")} htmlFor="webhook-secret">
            <div className="webhook-secret">
                <IconInput id="webhook-secret" type="password" icon={mdiLockOutline} value={secret} setValue={setSecret} autoComplete="new-password"
                    placeholder={settings.hasSecret && !removeSecret ? text("secretKept") : text("secretNone")} />
                {settings.hasSecret && <div className="webhook-secret-remove">
                    <Checkbox id="webhook-secret-remove" checked={removeSecret} onChange={setRemoveSecret} />
                    <label htmlFor="webhook-secret-remove">{text("removeSecret")}</label>
                </div>}
            </div>
        </SettingsRow>
        <SettingsRow title={text("eventsTitle")} description={text("eventsDescription")}>
            <div className="webhook-events" role="group" aria-label={text("eventsTitle")}>
                {settings.events.map(event => <div className="webhook-event" key={event}>
                    <Checkbox id={`webhook-event-${event}`} checked={settings.webhookEvents.includes(event)} onChange={on => toggleEvent(event, on)} />
                    <label htmlFor={`webhook-event-${event}`}>{text(`events.${eventKey(event)}`)}</label>
                </div>)}
            </div>
        </SettingsRow>
    </SettingsSection>;
};
