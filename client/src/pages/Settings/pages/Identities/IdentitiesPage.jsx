import { useContext, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { deleteRequest } from "@/common/utils/RequestUtil.js";
import { mdiPlus, mdiTrashCan, mdiPencil, mdiKeyVariant, mdiLockOutline, mdiAccount, mdiDomain } from "@mdi/js";
import Button from "@/common/components/Button";
import SelectBox from "@/common/components/SelectBox";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { SettingsSection, SettingsListItem } from "@/pages/Settings/components/SettingsLayout.jsx";
import IdentityDialog from "./components/IdentityDialog";
import { IdentityContext, useToast, useOrganizations } from "@/common/contexts";

export const IdentitiesPage = () => {
    const { t } = useTranslation();
    const { identities, loadIdentities } = useContext(IdentityContext);
    const { sendToast, showError } = useToast();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingIdentity, setEditingIdentity] = useState(null);
    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({ open: false, identity: null });
    const { organizations } = useOrganizations();
    const [selectedScope, setSelectedScope] = useState(null);

    useEffect(() => {
        loadIdentities();
    }, [loadIdentities]);

    const scopeOptions = useMemo(() => [
        { value: null, label: t("settings.identities.personal"), icon: mdiAccount },
        ...organizations.map(org => ({ value: org.id, label: org.name, icon: mdiDomain })),
    ], [organizations, t]);

    const filteredIdentities = useMemo(() => {
        if (!identities) return [];
        if (selectedScope === null) {
            return identities.filter(i => i.scope === 'personal');
        }
        return identities.filter(i => i.scope === 'organization' && i.organizationId === selectedScope);
    }, [identities, selectedScope]);

    const openDialog = (identity = null) => {
        setEditingIdentity(identity);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setEditingIdentity(null);
        loadIdentities();
    };

    const handleDeleteConfirm = async () => {
        const identity = deleteConfirmDialog.identity;

        try {
            await deleteRequest(`identities/${identity.id}`);
            sendToast("Success", t("settings.identities.deleteSuccess"));
            loadIdentities();
        } catch (error) {
            showError(error, t("settings.identities.deleteError"));
        }

        setDeleteConfirmDialog({ open: false, identity: null });
    };

    return (
        <>
            <SettingsSection actions={<>
                {scopeOptions.length > 1 && <SelectBox options={scopeOptions} selected={selectedScope} setSelected={setSelectedScope} />}
                <Button text={t("settings.identities.createIdentity")} icon={mdiPlus} onClick={() => openDialog()} />
            </>}>
                {filteredIdentities.length > 0 ? filteredIdentities.map(identity => <SettingsListItem key={identity.id}
                    icon={identity.type === "ssh" ? mdiKeyVariant : mdiLockOutline} title={identity.name}
                    meta={`${identity.username || t("settings.identities.noUsername")} · ${t(identity.type === "ssh" ? "settings.identities.sshKey" : "settings.identities.password")}`}
                    actions={<>
                        <Button icon={mdiPencil} title={t("settings.identities.editIdentity")} aria-label={t("settings.identities.editIdentity")}
                            onClick={() => openDialog(identity)} />
                        <Button icon={mdiTrashCan} title={t("settings.identities.deleteIdentity")} aria-label={t("settings.identities.deleteIdentity")}
                            onClick={() => setDeleteConfirmDialog({ open: true, identity })} />
                    </>} />) : <p className="settings-empty">{t("settings.identities.noIdentitiesDescription")}</p>}
            </SettingsSection>

            <IdentityDialog open={dialogOpen} onClose={handleDialogClose} identity={editingIdentity} organizationId={selectedScope} />

            <ActionConfirmDialog open={deleteConfirmDialog.open} setOpen={open => setDeleteConfirmDialog(prev => ({ ...prev, open }))}
                onConfirm={handleDeleteConfirm} text={t("settings.identities.deleteConfirm", { name: deleteConfirmDialog.identity?.name })} />
        </>
    );
};
