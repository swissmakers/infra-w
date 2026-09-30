import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteRequest, getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { getProviderIcon } from "@/common/utils/iconUtils";
import { mdiPencil, mdiPlus, mdiTrashCan, mdiLock, mdiServer } from "@mdi/js";
import OidcProviderDialog from "./components/OidcProviderDialog";
import LDAPProviderDialog from "./components/LDAPProviderDialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { SettingsSection, SettingsListItem, SettingsRow } from "@/pages/Settings/components/SettingsLayout.jsx";
import { useToast } from "@/common/contexts";

const SESSION_LIMITS = { sessionIdleHours: [1, 720], sessionMaxDays: [1, 365] };

const SessionLifetime = () => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const [values, setValues] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getRequest("settings").then(({ sessionIdleHours, sessionMaxDays }) => setValues({ sessionIdleHours, sessionMaxDays }))
            .catch(error => showError(error, t("settings.authentication.sessions.loadFailed")));
    }, [showError, t]);

    const save = async () => {
        setSaving(true);
        try {
            await patchRequest("settings", values);
            sendToast("Success", t("settings.authentication.sessions.saved"));
        } catch (error) {
            showError(error, t("settings.authentication.sessions.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const field = (key, unit) => {
        const [min, max] = SESSION_LIMITS[key];
        return <SettingsRow title={t(`settings.authentication.sessions.${key}`)}
            description={t(`settings.authentication.sessions.${key}Description`)} htmlFor={key}>
            <input id={key} className="settings-number-input" type="number" min={min} max={max} value={values[key]}
                onChange={event => setValues(prev => ({ ...prev, [key]: Math.max(min, Math.min(max, parseInt(event.target.value, 10) || min)) }))} />
            <span className="settings-unit">{t(`settings.authentication.sessions.${unit}`)}</span>
        </SettingsRow>;
    };

    return <SettingsSection title={t("settings.authentication.sessions.title")} description={t("settings.authentication.sessions.description")}
        actions={<Button text={t("settings.authentication.sessions.save")} onClick={save} disabled={saving || !values} />}>
        {values ? <>{field("sessionIdleHours", "hours")}{field("sessionMaxDays", "days")}</>
            : <p className="settings-empty" role="status">{t("common.loading")}</p>}
    </SettingsSection>;
};

export const Authentication = () => {
    const { t } = useTranslation();
    const { showError } = useToast();
    const [providers, setProviders] = useState([]);
    const [ldapProviders, setLdapProviders] = useState([]);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [ldapDialogOpen, setLdapDialogOpen] = useState(false);
    const [editProvider, setEditProvider] = useState(null);
    const [editLdapProvider, setEditLdapProvider] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState(null);
    const [selectedProviderType, setSelectedProviderType] = useState(null);

    const loadProviders = () => getRequest("auth/providers/admin").then(response => {
        setProviders(response.oidc || []);
        setLdapProviders(response.ldap || []);
    }).catch(error => console.error("Error loading providers:", error));

    const handleDelete = async () => {
        try {
            const endpoint = `auth/providers/admin/${selectedProviderType}/${selectedProviderId}`;
            await deleteRequest(endpoint);
            await loadProviders();
            setDeleteDialogOpen(false);
        } catch (error) {
            showError(error, t("settings.authentication.errors.deleteProvider"));
        }
    };

    const toggleProvider = async (providerId, enabled, type = "oidc") => {
        try {
            const endpoint = `auth/providers/admin/${type}/${providerId}`;
            await patchRequest(endpoint, { enabled });
            await loadProviders();
        } catch (error) {
            showError(error, t("settings.authentication.errors.toggleProvider"));
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    const rows = [
        ...providers.map(provider => ({
            provider, type: "oidc", icon: provider.isInternal ? mdiLock : getProviderIcon(provider),
            name: provider.isInternal ? t("settings.authentication.internalProviderName") : provider.name,
            badge: provider.isInternal ? t("settings.authentication.system") : "OIDC",
            meta: provider.isInternal ? t("settings.authentication.systemDescription") : provider.issuer,
            edit: !provider.isInternal && (() => {
                setEditProvider(provider);
                setCreateDialogOpen(true);
            }),
        })),
        ...ldapProviders.map(provider => ({
            provider, type: "ldap", icon: mdiServer, name: provider.name, badge: "LDAP",
            meta: [
                `${provider.host}:${provider.port}`,
                t("settings.authentication.ldapDialog.summary.organizations", { count: provider.organizationIds?.length || 0 }),
                t("settings.authentication.ldapDialog.summary.adminGroups", { count: provider.adminGroupDNs?.length || 0 }),
            ].join(" \u00b7 "),
            edit: () => {
                setEditLdapProvider(provider);
                setLdapDialogOpen(true);
            },
        })),
    ];

    return (
        <>
            <SessionLifetime />

            <SettingsSection title={t("settings.authentication.providers")} actions={<>
                <Button onClick={() => setLdapDialogOpen(true)} text={t("settings.authentication.addLdapProvider")} icon={mdiServer} type="secondary" />
                <Button onClick={() => setCreateDialogOpen(true)} text={t("settings.authentication.addProvider")} icon={mdiPlus} />
            </>}>
                {rows.map(({ provider, type, icon, name, badge, meta, edit }) => <SettingsListItem key={`${type}-${provider.id}`}
                    icon={icon} title={name} badge={<span className="settings-status">{badge}</span>} meta={meta} actions={<>
                        {edit && <>
                            <Button icon={mdiPencil} title={t("settings.authentication.editProvider")}
                                aria-label={t("settings.authentication.editProvider")} onClick={edit} />
                            <Button icon={mdiTrashCan} title={t("settings.authentication.deleteProvider")}
                                aria-label={t("settings.authentication.deleteProvider")} onClick={() => {
                                    setSelectedProviderId(provider.id);
                                    setSelectedProviderType(type);
                                    setDeleteDialogOpen(true);
                                }} />
                        </>}
                        <ToggleSwitch checked={provider.enabled} id={`${type}-toggle-${provider.id}`}
                            aria-label={t("settings.authentication.enableProvider", { name })}
                            onChange={(checked) => toggleProvider(provider.id, checked, type)} />
                    </>} />)}
            </SettingsSection>

            <OidcProviderDialog open={createDialogOpen} provider={editProvider}
                onClose={() => {
                    setCreateDialogOpen(false);
                    setEditProvider(null);
                }}
                onSave={loadProviders}
            />

            <LDAPProviderDialog open={ldapDialogOpen} provider={editLdapProvider}
                onClose={() => {
                    setLdapDialogOpen(false);
                    setEditLdapProvider(null);
                }}
                onSave={loadProviders}
            />

            <ActionConfirmDialog
                open={deleteDialogOpen}
                setOpen={setDeleteDialogOpen}
                text={t("settings.authentication.deleteConfirm")}
                onConfirm={handleDelete}
            />
        </>
    );
};