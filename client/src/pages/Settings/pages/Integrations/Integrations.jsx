import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteRequest, getRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import IntegrationDialog from "@/pages/Servers/components/IntegrationDialog";
import { SettingsSection, SettingsListItem } from "@/pages/Settings/components/SettingsLayout.jsx";
import { mdiCloudSyncOutline, mdiDeleteOutline, mdiLanConnect, mdiPencilOutline, mdiPlus, mdiSync, mdiTestTube } from "@mdi/js";
import { useToast } from "@/common/contexts";
import { formatDate } from "@/common/utils/formatUtils.js";

const STATUS_CLASSES = { online: "positive", offline: "error" };

export const Integrations = () => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionState, setActionState] = useState({});
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editIntegrationId, setEditIntegrationId] = useState(null);
    const [dialogType, setDialogType] = useState("proxmox");
    const [deleteState, setDeleteState] = useState({ open: false, integration: null });

    const fetchIntegrations = useCallback(() => getRequest("integrations/list").then((data) => {
        setIntegrations(Array.isArray(data) ? data : []);
    }).catch((error) => {
        showError(error, t("settings.integrations.errors.loadFailed"));
    }).finally(() => setLoading(false)), [showError, t]);

    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations]);

    const loadIntegrations = () => {
        setLoading(true);
        return fetchIntegrations();
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditIntegrationId(null);
        setDialogType("proxmox");
        loadIntegrations();
    };

    const openCreateDialog = (type = "proxmox") => {
        setEditIntegrationId(null);
        setDialogType(type);
        setDialogOpen(true);
    };

    const openEditDialog = (integration) => {
        setEditIntegrationId(integration.id);
        setDialogType(integration.type || "proxmox");
        setDialogOpen(true);
    };

    const withAction = async (id, key, fn) => {
        setActionState((prev) => ({ ...prev, [`${key}-${id}`]: true }));
        try {
            await fn();
        } finally {
            setActionState((prev) => ({ ...prev, [`${key}-${id}`]: false }));
        }
    };

    const runAction = async (integration, action) => {
        await withAction(integration.id, action, async () => {
            try {
                const endpoint = action === "test"
                    ? `integrations/${integration.id}/test`
                    : `integrations/${integration.id}/sync`;
                const response = await postRequest(endpoint, {});
                sendToast("Success", response?.message || t("settings.integrations.messages.actionSuccess"));
                loadIntegrations();
            } catch (error) {
                showError(error, t("settings.integrations.errors.actionFailed"));
            }
        });
    };

    const handleDelete = async () => {
        const integration = deleteState.integration;
        if (!integration) return;

        await withAction(integration.id, "delete", async () => {
            try {
                await deleteRequest(`integrations/${integration.id}`);
                sendToast("Success", t("settings.integrations.messages.deleted"));
                setDeleteState({ open: false, integration: null });
                loadIntegrations();
            } catch (error) {
                showError(error, t("settings.integrations.errors.deleteFailed"));
            }
        });
    };

    const renderIntegration = (integration) => {
        const busy = ["test", "sync", "delete"].some(key => actionState[`${key}-${integration.id}`]);
        const status = integration.status || "unknown";
        const actions = [
            ["test", mdiTestTube, () => runAction(integration, "test"), busy],
            ["sync", mdiSync, () => runAction(integration, "sync"), busy],
            ["edit", mdiPencilOutline, () => openEditDialog(integration)],
            ["delete", mdiDeleteOutline, () => setDeleteState({ open: true, integration }), busy],
        ];
        return (
            <SettingsListItem key={integration.id} icon={integration.type === "netbox" ? mdiLanConnect : mdiCloudSyncOutline} title={integration.name}
                badge={<span className={`settings-status ${STATUS_CLASSES[status] || ""}`}>{t(`workspace.${status}`, { defaultValue: status })}</span>}
                meta={[`${integration.type === "netbox" ? "NetBox" : "Proxmox"} · ${t("settings.integrations.lastSync")}: ${integration.lastSyncAt ? formatDate(integration.lastSyncAt) : "-"}`,
                    integration.lastSyncMessage && `${t("settings.integrations.lastMessage")}: ${integration.lastSyncMessage}`]}
                actions={actions.map(([key, icon, onClick, disabled]) => {
                    const label = t(`settings.integrations.actions.${key}`);
                    return <Button key={key} icon={icon} title={label} aria-label={label} onClick={onClick} disabled={disabled} />;
                })} />
        );
    };

    return (
        <>
            <SettingsSection actions={<>
                <Button type="secondary" text={t("settings.integrations.actions.addProxmox")} icon={mdiPlus} onClick={() => openCreateDialog("proxmox")} />
                <Button type="secondary" text={t("settings.integrations.actions.addNetbox")} icon={mdiPlus} onClick={() => openCreateDialog("netbox")} />
            </>}>
                {integrations.length > 0 ? <div>{integrations.map(renderIntegration)}</div>
                    : <p className="settings-empty" role="status">{t(loading ? "common.loading" : "settings.integrations.empty")}</p>}
            </SettingsSection>

            <IntegrationDialog
                open={dialogOpen}
                onClose={closeDialog}
                currentFolderId={null}
                currentOrganizationId={null}
                editServerId={editIntegrationId}
                initialType={dialogType}
            />

            <ActionConfirmDialog
                open={deleteState.open}
                setOpen={(open) => setDeleteState((prev) => ({ ...prev, open }))}
                onConfirm={handleDelete}
                text={t("settings.integrations.confirmDelete", { name: deleteState.integration?.name || "" })}
            />
        </>
    );
};
