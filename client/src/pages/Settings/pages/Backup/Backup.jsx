import "./styles.sass";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getRequest, patchRequest, postRequest, deleteRequest, downloadFile } from "@/common/utils/RequestUtil.js";
import { formatBytes, formatDate } from "@/common/utils/formatUtils.js";
import Button from "@/common/components/Button";
import SelectBox from "@/common/components/SelectBox";
import Checkbox from "@/common/components/Checkbox";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { SettingsSection, SettingsRow } from "@/pages/Settings/components/SettingsLayout.jsx";
import Icon from "@mdi/react";
import {
    mdiPlus, mdiHarddisk, mdiLanConnect, mdiCloud, mdiPencil, mdiTrashCan, mdiCloudUpload, mdiLoading, mdiRestore, mdiDownload,
    mdiFolderOpen, mdiChevronRight,
} from "@mdi/js";
import BackupTargetDialog from "./components/BackupTargetDialog";
import FileBrowserDialog from "./components/FileBrowserDialog";
import { useToast } from "@/common/contexts";

const PROVIDER_ICONS = { smb: mdiLanConnect, webdav: mdiCloud };

export const Backup = () => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({ scheduleInterval: 0, retention: 5, includeDatabase: true, includeRecordings: true, includeLogs: false, providers: [] });
    const [storage, setStorage] = useState({ database: 0, recordings: 0, logs: 0 });
    const [providerDialogOpen, setProviderDialogOpen] = useState(false);
    const [editProvider, setEditProvider] = useState(null);
    const [expandedProviderId, setExpandedProviderId] = useState(null);
    const [backupsByProvider, setBackupsByProvider] = useState({});
    const [loadingBackups, setLoadingBackups] = useState({});
    const [deleteDialog, setDeleteDialog] = useState({ open: false, provider: null });
    const [restoreDialog, setRestoreDialog] = useState({ open: false, provider: null, backup: null });
    const [creatingBackup, setCreatingBackup] = useState({});
    const [restoring, setRestoring] = useState(null);
    const [fileBrowser, setFileBrowser] = useState({ open: false, type: null });

    const scheduleOptions = [
        { value: 0, label: t("settings.backup.schedule.disabled") },
        { value: 1, label: t("settings.backup.schedule.hourly") },
        { value: 6, label: t("settings.backup.schedule.every6h") },
        { value: 12, label: t("settings.backup.schedule.every12h") },
        { value: 24, label: t("settings.backup.schedule.daily") },
        { value: 168, label: t("settings.backup.schedule.weekly") },
    ];

    const retentionOptions = [1, 3, 5, 10, 20, 50].map(n => ({
        value: n,
        label: `${n} ${t("settings.backup.backups")}`,
    }));

    const loadData = useCallback(() => Promise.all([
        getRequest("backup/settings"),
        getRequest("backup/storage"),
    ]).then(([settingsData, storageData]) => {
        setSettings(settingsData);
        setStorage(storageData);
    }).catch(() => {
        sendToast("Error", t("settings.backup.errors.loadFailed"));
    }), [sendToast, t]);

    useEffect(() => { loadData(); }, [loadData]);

    const fetchBackups = async (providerId) => {
        setLoadingBackups(prev => ({ ...prev, [providerId]: true }));
        try {
            const data = await getRequest(`backup/providers/${providerId}/backups`);
            setBackupsByProvider(prev => ({ ...prev, [providerId]: data }));
        } catch {
            sendToast("Error", t("settings.backup.errors.loadBackupsFailed"));
        } finally {
            setLoadingBackups(prev => ({ ...prev, [providerId]: false }));
        }
    };

    const handleProviderClick = async (provider) => {
        if (expandedProviderId === provider.id) {
            setExpandedProviderId(null);
        } else {
            setExpandedProviderId(provider.id);
            if (!backupsByProvider[provider.id]) {
                await fetchBackups(provider.id);
            }
        }
    };

    const handleInputChange = useCallback((field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    }, []);

    const saveSettings = async () => {
        try {
            setSaving(true);
            const updateData = { ...settings };
            delete updateData.providers;
            const updated = await patchRequest("backup/settings", updateData);
            setSettings(prev => ({ ...prev, ...updated }));
            sendToast("Success", t("settings.backup.saveSuccess"));
        } catch {
            sendToast("Error", t("settings.backup.errors.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const openAddProvider = () => {
        setEditProvider(null);
        setProviderDialogOpen(true);
    };

    const openEditProvider = (provider) => {
        setEditProvider(provider);
        setProviderDialogOpen(true);
    };

    const handleProviderSaved = () => {
        setProviderDialogOpen(false);
        loadData();
    };

    const handleDeleteProvider = async () => {
        try {
            await deleteRequest(`backup/providers/${deleteDialog.provider.id}`);
            sendToast("Success", t("settings.backup.providerDeleted"));
            setExpandedProviderId(null);
            loadData();
        } catch {
            sendToast("Error", t("settings.backup.errors.deleteFailed"));
        }
        setDeleteDialog({ open: false, provider: null });
    };

    const createBackup = async (provider) => {
        setCreatingBackup(prev => ({ ...prev, [provider.id]: true }));
        try {
            await postRequest(`backup/providers/${provider.id}/backups`);
            sendToast("Success", t("settings.backup.backupCreated"));
            await fetchBackups(provider.id);
        } catch {
            sendToast("Error", t("settings.backup.errors.backupFailed"));
        } finally {
            setCreatingBackup(prev => ({ ...prev, [provider.id]: false }));
        }
    };

    const handleRestore = async () => {
        const { provider, backup } = restoreDialog;
        setRestoreDialog({ open: false, provider: null, backup: null });
        setRestoring(backup.name);
        try {
            await postRequest(`backup/providers/${provider.id}/backups/${encodeURIComponent(backup.name)}/restore`);
            sendToast("Success", t("settings.backup.restoreStarted"));
        } catch {
            sendToast("Error", t("settings.backup.errors.restoreFailed"));
            setRestoring(null);
        }
    };

    const storageRows = [
        ["database", t("settings.backup.storage.database"), mdiDownload, t("common.actions.download"), () => downloadFile("backup/export/database")],
        ["recordings", t("settings.backup.storage.recordings"), mdiFolderOpen, t("settings.backup.storage.browse"), () => setFileBrowser({ open: true, type: "recordings" })],
        ["logs", t("settings.backup.storage.logs"), mdiFolderOpen, t("settings.backup.storage.browse"), () => setFileBrowser({ open: true, type: "logs" })],
    ];

    const includeOptions = [
        ["includeDatabase", t("settings.backup.includes.database")],
        ["includeRecordings", t("settings.backup.includes.recordings")],
        ["includeLogs", t("settings.backup.includes.logs")],
    ];

    const iconButton = (icon, label, onClick, busy) => <Button icon={busy ? mdiLoading : icon} busy={busy}
        title={label} aria-label={label} onClick={onClick} />;

    const renderBackups = (provider) => {
        const backups = backupsByProvider[provider.id];
        if (loadingBackups[provider.id]) return <p className="settings-empty" role="status">{t("settings.backup.loadingBackups")}</p>;
        if (!backups?.length) return <p className="settings-empty">{t("settings.backup.noBackups")}</p>;
        return <ul>{backups.map(backup => <li key={backup.name}>
            <div>
                <strong>{backup.name}</strong>
                <span>{formatBytes(backup.size)} · {formatDate(backup.created)}</span>
            </div>
            {iconButton(mdiRestore, t("common.actions.restore"), () => setRestoreDialog({ open: true, provider, backup }), restoring === backup.name)}
        </li>)}</ul>;
    };

    return (
        <>
            <SettingsSection title={t("settings.backup.storage.title")} description={t("settings.backup.storage.description")}>
                <table className="backup-usage">
                    <tbody>
                        {storageRows.map(([key, label, icon, actionLabel, onClick]) => <tr key={key}>
                            <th scope="row">{label}</th>
                            <td>{formatBytes(storage[key])}</td>
                            <td>{iconButton(icon, actionLabel, onClick)}</td>
                        </tr>)}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th scope="row">{t("settings.backup.storage.total")}</th>
                            <td>{formatBytes(storage.database + storage.recordings + storage.logs)}</td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </SettingsSection>

            <SettingsSection title={t("settings.backup.backupsSection.title")} description={t("settings.backup.backupsSection.description")}
                actions={<Button text={t("settings.backup.saveSettings")} onClick={saveSettings} disabled={saving} />}>
                <SettingsRow title={t("settings.backup.schedule.title")}>
                    <SelectBox options={scheduleOptions} selected={settings.scheduleInterval} setSelected={(v) => handleInputChange("scheduleInterval", v)} />
                </SettingsRow>
                <SettingsRow title={t("settings.backup.retention.title")}>
                    <SelectBox options={retentionOptions} selected={settings.retention} setSelected={(v) => handleInputChange("retention", v)} />
                </SettingsRow>
                <SettingsRow title={t("settings.backup.includes.title")}>
                    <div className="backup-includes" role="group" aria-label={t("settings.backup.includes.title")}>
                        {includeOptions.map(([field, label]) => <div className="backup-include" key={field}>
                            <Checkbox id={`backup-include-${field}`} checked={settings[field]} onChange={checked => handleInputChange(field, checked)} />
                            <label htmlFor={`backup-include-${field}`}>{label}</label>
                        </div>)}
                    </div>
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title={t("settings.backup.providers")}
                actions={<Button type="secondary" text={t("settings.backup.addProvider")} icon={mdiPlus} onClick={openAddProvider} />}>
                {settings.providers.length === 0 ? <p className="settings-empty">{t("settings.backup.noProvidersDescription")}</p>
                    : <ul className="backup-providers">{settings.providers.map(provider => {
                        const expanded = expandedProviderId === provider.id;
                        const location = provider.path || provider.share || provider.url;
                        return <li key={provider.id}>
                            <div className="backup-provider">
                                <button type="button" className="backup-provider-toggle" aria-expanded={expanded} onClick={() => handleProviderClick(provider)}>
                                    <Icon path={mdiChevronRight} className="backup-chevron" />
                                    <Icon path={PROVIDER_ICONS[provider.type] || mdiHarddisk} />
                                    <span>
                                        <strong>{provider.name}</strong>
                                        <span>{t(`settings.backup.providerTypes.${provider.type}`)}{location && ` · ${location}`}</span>
                                    </span>
                                </button>
                                {iconButton(mdiCloudUpload, t("settings.backup.createBackup"), () => createBackup(provider), creatingBackup[provider.id])}
                                {iconButton(mdiPencil, t("settings.backup.editProvider"), () => openEditProvider(provider))}
                                {iconButton(mdiTrashCan, t("settings.backup.deleteProvider"), () => setDeleteDialog({ open: true, provider }))}
                            </div>
                            {expanded && <div className="backup-archives" role="region" aria-label={t("settings.backup.backupList", { name: provider.name })}>
                                {renderBackups(provider)}
                            </div>}
                        </li>;
                    })}</ul>}
            </SettingsSection>

            <BackupTargetDialog open={providerDialogOpen} onClose={() => setProviderDialogOpen(false)} provider={editProvider} onSaved={handleProviderSaved} />
            <FileBrowserDialog open={fileBrowser.open} onClose={() => setFileBrowser({ open: false, type: null })} type={fileBrowser.type} onFilesChanged={loadData} />
            <ActionConfirmDialog open={deleteDialog.open} setOpen={(open) => setDeleteDialog(prev => ({ ...prev, open }))} onConfirm={handleDeleteProvider} text={t("settings.backup.deleteProviderConfirm", { name: deleteDialog.provider?.name })} />
            <ActionConfirmDialog open={restoreDialog.open} setOpen={(open) => setRestoreDialog(prev => ({ ...prev, open }))} onConfirm={handleRestore} text={t("settings.backup.restoreConfirm", { name: restoreDialog.backup?.name })} />
        </>
    );
};

export default Backup;
