import { useCallback, useEffect, useState, useContext } from "react";
import { getRequest, postRequest, deleteRequest, saveDownload } from "@/common/utils/RequestUtil.js";
import Icon from "@mdi/react";
import { mdiAccountPlusOutline, mdiCheck, mdiChevronRight, mdiClose, mdiDownload, mdiLogout, mdiPencil, mdiPlus, mdiTrashCan } from "@mdi/js";
import Button from "@/common/components/Button";
import TabSwitcher from "@/common/components/TabSwitcher";
import OrganizationDialog from "./components/OrganizationDialog";
import InviteMemberDialog from "./components/InviteMemberDialog";
import MemberList from "./components/MemberList";
import OrganizationAuditSettings from "./components/OrganizationAuditSettings";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { SettingsSection } from "@/pages/Settings/components/SettingsLayout.jsx";
import { useTranslation } from "react-i18next";
import "./styles.sass";
import { useToast, ServerContext, UserContext, useOrganizations } from "@/common/contexts";

export const Organizations = () => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const { loadServers } = useContext(ServerContext);
    const isAdmin = useContext(UserContext).user?.role === "admin";

    const { organizations, loadOrganizations } = useOrganizations();
    const [pendingInvitations, setPendingInvitations] = useState([]);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editOrganization, setEditOrganization] = useState(null);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [selectedOrganization, setSelectedOrganization] = useState(null);
    const [expandedOrgId, setExpandedOrgId] = useState(null);
    const [membersByOrgId, setMembersByOrgId] = useState({});
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [confirmText, setConfirmText] = useState("");
    const [activeTab, setActiveTab] = useState({});

    // organization changes also change the inventory tree
    const fetchOrganizations = useCallback(() => loadOrganizations().then(() => loadServers()), [loadOrganizations, loadServers]);

    const fetchPendingInvitations = () => getRequest("organizations/invitations/pending")
        .then(invites => setPendingInvitations(invites))
        .catch(() => setPendingInvitations([]));

    const fetchMembers = async (orgId) => {
        try {
            const response = await getRequest(`organizations/${orgId}/members`);
            setMembersByOrgId(prev => ({ ...prev, [orgId]: response }));
            return response;
        } catch {
            return [];
        }
    };

    useEffect(() => {
        fetchOrganizations();
        fetchPendingInvitations();
    }, [fetchOrganizations]);

    const handleInvitationResponse = async (organizationId, accept) => {
        try {
            await postRequest(`organizations/invitations/${organizationId}/respond`, { accept });
            fetchPendingInvitations();
            if (accept) {
                sendToast("Success", t("common.messages.invitationAccepted"));
                fetchOrganizations();
            } else {
                sendToast("Success", t("common.messages.invitationDeclined"));
            }
        } catch {
            sendToast("Error", t("common.messages.invitationError"));
        }
    };

    const handleOrgClick = async (org) => {
        if (expandedOrgId === org.id) {
            setExpandedOrgId(null);
            setActiveTab(prev => ({ ...prev, [org.id]: "members" }));
        } else {
            setExpandedOrgId(org.id);
            setActiveTab(prev => ({ ...prev, [org.id]: prev[org.id] || "members" }));
            if (!membersByOrgId[org.id]) {
                await fetchMembers(org.id);
            }
        }
    };

    const handleInviteMember = (org) => {
        setSelectedOrganization(org);
        setInviteDialogOpen(true);
    };

    const showConfirmDialog = (action, text) => {
        setConfirmAction(() => action);
        setConfirmText(text);
        setConfirmDialogOpen(true);
    };

    const handleDeleteOrg = (orgId) => {
        showConfirmDialog(
            async () => {
                try {
                    await deleteRequest(`organizations/${orgId}`);
                    sendToast("Success", t("common.messages.organizationDeleted"));
                    fetchOrganizations();
                    setExpandedOrgId(null);
                } catch {
                    sendToast("Error", t("common.messages.organizationDeleteError"));
                }
            },
            t("settings.organizations.deleteConfirmation"),
        );
    };

    const handleLeaveOrg = (orgId) => {
        showConfirmDialog(
            async () => {
                try {
                    await postRequest(`organizations/${orgId}/leave`);
                    sendToast("Success", t("common.messages.leftOrganization"));
                    fetchOrganizations();
                    setExpandedOrgId(null);
                } catch {
                    sendToast("Error", t("common.messages.leaveOrganizationError"));
                }
            },
            t("settings.organizations.leaveConfirmation"),
        );
    };

    return (
        <div className="organizations-page">
            <SettingsSection actions={<Button text={t("settings.organizations.createOrganization")} icon={mdiPlus}
                onClick={() => setCreateDialogOpen(true)} />}>
                {organizations.length === 0 ? <p className="settings-empty">
                    {t("settings.organizations.noOrganizations")} {t("settings.organizations.noOrganizationsDescription")}
                </p> : organizations.map((org) => {
                    const expanded = expandedOrgId === org.id;
                    const tab = activeTab[org.id] || "members";
                    return <div key={org.id} className="org-item">
                        <div className="org-row">
                            <button type="button" className="org-toggle" aria-expanded={expanded} onClick={() => handleOrgClick(org)}>
                                <Icon path={mdiChevronRight} size={0.8} />
                                <span className="org-row-text">
                                    <strong className="org-row-title">{org.name}</strong>
                                    {org.description && <span className="org-row-meta">{org.description}</span>}
                                </span>
                            </button>
                            {(org.role === "owner" || org.role === "manager") && <>
                                <Button icon={mdiPencil} title={t("settings.organizations.edit")}
                                    aria-label={t("settings.organizations.edit")} onClick={() => setEditOrganization(org)} />
                                <Button icon={mdiAccountPlusOutline} title={t("settings.organizations.invite")}
                                    aria-label={t("settings.organizations.invite")} onClick={() => handleInviteMember(org)} />
                            </>}
                            {org.role === "owner" && <Button icon={mdiDownload} title={t("settings.organizations.exportAudit")}
                                aria-label={t("settings.organizations.exportAuditFor", { name: org.name })}
                                onClick={() => saveDownload(`organizations/${org.id}/audit/export`, `infra-w-audit-organization-${org.id}.csv`)
                                    .catch(error => showError(error, t("audit.export.failed")))} />}
                            {org.role === "owner"
                                ? <Button icon={mdiTrashCan} title={t("settings.organizations.delete")}
                                    aria-label={t("settings.organizations.delete")} onClick={() => handleDeleteOrg(org.id)} />
                                : <Button icon={mdiLogout} title={t("settings.organizations.leave")}
                                    aria-label={t("settings.organizations.leave")} onClick={() => handleLeaveOrg(org.id)} />}
                        </div>
                        {expanded && <div className="org-detail">
                            {isAdmin && <TabSwitcher activeTab={tab} onTabChange={(tabKey) => setActiveTab(prev => ({ ...prev, [org.id]: tabKey }))}
                                tabs={[
                                    { key: "members", label: t("settings.organizations.members") },
                                    { key: "audit", label: t("settings.organizations.auditSettings") },
                                ]} />}
                            {tab === "members" && membersByOrgId[org.id] && <MemberList members={membersByOrgId[org.id]}
                                organizationId={org.id} myRole={org.role} refreshMembers={() => fetchMembers(org.id)}
                                refreshOrganizations={fetchOrganizations} />}
                            {tab === "audit" && isAdmin && <OrganizationAuditSettings organizationId={org.id} />}
                        </div>}
                    </div>;
                })}
            </SettingsSection>

            {pendingInvitations.length > 0 && <SettingsSection title={t("settings.organizations.pendingInvitations")}>
                {pendingInvitations.map((invite) => <div key={invite.id} className="org-row org-invitation">
                    <span className="org-row-text">
                        <strong className="org-row-title">{invite.organization.name}</strong>
                        <span className="org-row-meta">{t("settings.organizations.invitedBy", { name: invite.invitedBy.name })}</span>
                    </span>
                    <Button icon={mdiCheck} title={t("settings.organizations.acceptInvitation")} aria-label={t("settings.organizations.acceptInvitation")}
                        onClick={() => handleInvitationResponse(invite.organization.id, true)} />
                    <Button icon={mdiClose} title={t("settings.organizations.declineInvitation")} aria-label={t("settings.organizations.declineInvitation")}
                        onClick={() => handleInvitationResponse(invite.organization.id, false)} />
                </div>)}
            </SettingsSection>}

            <OrganizationDialog open={createDialogOpen || editOrganization !== null} organization={editOrganization}
                                onClose={() => { setCreateDialogOpen(false); setEditOrganization(null); }}
                                refreshOrganizations={fetchOrganizations} />

            {selectedOrganization && (
                <InviteMemberDialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)}
                                    organization={selectedOrganization}
                                    refreshMembers={() => fetchMembers(selectedOrganization.id)} />
            )}

            <ActionConfirmDialog open={confirmDialogOpen} setOpen={setConfirmDialogOpen} text={confirmText}
                                 onConfirm={() => {
                                     confirmAction();
                                     setConfirmDialogOpen(false);
                                 }}
            />
        </div>
    );
};