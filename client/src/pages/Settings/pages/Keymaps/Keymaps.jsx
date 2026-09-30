import "./styles.sass";
import { useEffect, useState } from "react";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { mdiRestore } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { SettingsSection, SettingsRow } from "@/pages/Settings/components/SettingsLayout.jsx";
import { useKeymaps, useToast } from "@/common/contexts";

const KeybindRecorder = ({ action, currentKey, onUpdate, onReset }) => {
    const [recording, setRecording] = useState(false);
    const [recordedKey, setRecordedKey] = useState("");
    const { formatKey } = useKeymaps();
    const { t } = useTranslation();

    useEffect(() => {
        if (!recording) return;

        const handleKeyDown = (e) => {
            const plain = !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey;
            if (plain && e.key === "Tab") return;
            e.preventDefault();
            e.stopPropagation();
            if (plain && e.key === "Escape") {
                setRecording(false);
                setRecordedKey("");
                return;
            }

            const parts = [];
            if (e.ctrlKey) parts.push("ctrl");
            if (e.shiftKey) parts.push("shift");
            if (e.altKey) parts.push("alt");
            if (e.metaKey) parts.push("meta");

            const key = e.key.toLowerCase();
            if (!["control", "shift", "alt", "meta"].includes(key)) {
                parts.push(key);
            }

            if (parts.length > 0 && parts[parts.length - 1] !== "ctrl" && parts[parts.length - 1] !== "shift" && parts[parts.length - 1] !== "alt" && parts[parts.length - 1] !== "meta") {
                const combination = parts.join("+");
                setRecordedKey(combination);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [recording]);

    const startRecording = () => {
        setRecording(true);
        setRecordedKey("");
    };

    const cancelRecording = () => {
        setRecording(false);
        setRecordedKey("");
    };

    const saveRecording = () => {
        if (recordedKey) {
            onUpdate(action, recordedKey);
            setRecording(false);
            setRecordedKey("");
        }
    };

    return (
        <>
            <button type="button" className={`keybind-display${recording ? " recording" : ""}`} onClick={recording ? undefined : startRecording}>
                {recording && !recordedKey ? <span>{t("settings.keymaps.recorder.pressKeys")}</span> : formatKey(recording ? recordedKey : currentKey)}
            </button>
            {recording ? <>
                <Button text={t("settings.keymaps.recorder.save")} onClick={saveRecording} disabled={!recordedKey} />
                <Button type="secondary" text={t("settings.keymaps.recorder.cancel")} onClick={cancelRecording} />
            </> : <Button icon={mdiRestore} title={t("settings.keymaps.recorder.reset")} aria-label={t("settings.keymaps.recorder.reset")}
                onClick={() => onReset(action)} />}
        </>
    );
};

export const Keymaps = () => {
    const { t } = useTranslation();
    const { keymaps, loading, updateKeymap, resetKeymap, resetAllKeymaps } = useKeymaps();
    const { sendToast, showError } = useToast();

    const handleUpdate = async (action, key) => {
        try {
            await updateKeymap(action, { key });
            sendToast("Success", t("settings.keymaps.messages.updateSuccess"));
        } catch (error) {
            showError(error, t("settings.keymaps.messages.updateFailed"));
        }
    };

    const handleToggle = async (action, enabled) => {
        try {
            await updateKeymap(action, { enabled });
        } catch (error) {
            showError(error, t("settings.keymaps.messages.updateFailed"));
        }
    };

    const handleReset = async (action) => {
        try {
            await resetKeymap(action);
            sendToast("Success", t("settings.keymaps.messages.resetSuccess"));
        } catch (error) {
            showError(error, t("settings.keymaps.messages.resetFailed"));
        }
    };

    const handleResetAll = async () => {
        try {
            await resetAllKeymaps();
            sendToast("Success", t("settings.keymaps.messages.resetAllSuccess"));
        } catch (error) {
            showError(error, t("settings.keymaps.messages.resetAllFailed"));
        }
    };

    if (loading) return <p className="settings-empty" role="status">{t("common.loading")}</p>;

    return (
        <SettingsSection actions={<Button type="secondary" text={t("settings.keymaps.resetAll")} icon={mdiRestore} onClick={handleResetAll} />}>
            {keymaps.map(keymap => {
                const actionKey = keymap.action.replace(/-/g, "");
                const title = t(`settings.keymaps.actions.${actionKey}.title`);
                return <SettingsRow key={keymap.action} title={title}
                    description={t(`settings.keymaps.actions.${actionKey}.description`)}>
                    <KeybindRecorder action={keymap.action} currentKey={keymap.key} onUpdate={handleUpdate} onReset={handleReset} />
                    <ToggleSwitch id={`keymap-${keymap.action}`} checked={Boolean(keymap.enabled)}
                        aria-label={t("settings.keymaps.enable", { name: title })} onChange={enabled => handleToggle(keymap.action, enabled)} />
                </SettingsRow>;
            })}
        </SettingsSection>
    );
};
