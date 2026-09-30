import "./styles.sass";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { postRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { mdiHarddisk, mdiLanConnect, mdiFormTextbox, mdiFolderOpen, mdiAccount, mdiLock, mdiWeb, mdiCloud } from "@mdi/js";
import { useToast } from "@/common/contexts";

// the stored password is never sent back, an empty field keeps it
const toForm = (provider) => ({
    type: provider?.type || "local", name: provider?.name || "", path: provider?.path || "", url: provider?.url || "",
    folder: provider?.folder || "", username: provider?.username || "", password: "", share: provider?.share || "", domain: provider?.domain || "",
});

const TYPE_FIELDS = {
    local: [["path", "localPath", mdiFolderOpen]],
    smb: [["share", "smbShare", mdiWeb], ["folder", "smbFolder", mdiFolderOpen], ["username", "smbUsername", mdiAccount],
        ["password", "smbPassword", mdiLock], ["domain", "smbDomain", mdiWeb]],
    webdav: [["url", "webdavUrl", mdiWeb], ["folder", "webdavFolder", mdiFolderOpen], ["username", "webdavUsername", mdiAccount],
        ["password", "webdavPassword", mdiLock]],
};

export const BackupTargetDialog = ({ open, onClose, provider, onSaved }) => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const [form, setForm] = useState(() => toForm(provider));
    const [saving, setSaving] = useState(false);
    const setField = (key) => (value) => setForm(prev => ({ ...prev, [key]: value }));

    const typeOptions = [
        { value: "local", label: t("settings.backup.providerTypes.local"), icon: mdiHarddisk },
        { value: "smb", label: t("settings.backup.providerTypes.smb"), icon: mdiLanConnect },
        { value: "webdav", label: t("settings.backup.providerTypes.webdav"), icon: mdiCloud },
    ];

    const [formSource, setFormSource] = useState({ open, provider });
    if (formSource.open !== open || formSource.provider !== provider) {
        setFormSource({ open, provider });
        if (open) setForm(toForm(provider));
    }

    const handleSubmit = async () => {
        if (!form.name) return sendToast("Error", t("settings.backup.errors.nameRequired"));
        setSaving(true);
        try {
            const { password, ...data } = form;
            if (password) data.password = password;
            provider
                ? await patchRequest(`backup/providers/${provider.id}`, data)
                : await postRequest("backup/providers", data);
            sendToast("Success", t(provider ? "settings.backup.providerUpdated" : "settings.backup.providerCreated"));
            onSaved();
        } catch (err) {
            showError(err, t("settings.backup.errors.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const renderField = ([key, labelKey, icon]) => {
        const placeholder = key === "password" && provider?.hasPassword ? t("settings.backup.passwordUnchanged") : t(`settings.backup.${labelKey}Placeholder`);
        return <div className="form-group" key={key}>
            <label htmlFor={`backup-target-${key}`}>{t(`settings.backup.${labelKey}`)}</label>
            <IconInput id={`backup-target-${key}`} type={key === "password" ? "password" : "text"} icon={icon} value={form[key]}
                setValue={setField(key)} placeholder={placeholder} />
        </div>;
    };

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={() => JSON.stringify(form) !== JSON.stringify(toForm(provider))}>
            <div className="backup-provider-dialog">
                <h2>{t(provider ? "settings.backup.editProvider" : "settings.backup.addProvider")}</h2>
                <div className="dialog-content">
                    <div className="form-group">
                        <label htmlFor="backup-target-name">{t("settings.backup.providerName")}</label>
                        <IconInput id="backup-target-name" icon={mdiFormTextbox} value={form.name} setValue={setField("name")}
                            placeholder={t("settings.backup.providerNamePlaceholder")} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="backup-target-type">{t("settings.backup.providerType")}</label>
                        <SelectBox id="backup-target-type" options={typeOptions} selected={form.type} setSelected={setField("type")} />
                    </div>
                    {TYPE_FIELDS[form.type].map(renderField)}
                </div>
                <div className="dialog-actions">
                    <Button text={t("common.actions.cancel")} onClick={onClose} type="secondary" />
                    <Button text={t("common.actions.save")} onClick={handleSubmit} type="primary" disabled={saving || !form.name} />
                </div>
            </div>
        </DialogProvider>
    );
};
