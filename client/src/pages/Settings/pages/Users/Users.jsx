import "./styles.sass";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getRequest, deleteRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import PaginatedTable from "@/common/components/PaginatedTable";
import { mdiAccount, mdiDotsVertical, mdiKey, mdiSecurity, mdiAccountRemove, mdiLogin, mdiPlus, mdiMagnify, mdiLock, mdiLockOpenVariant,
    mdiShieldRefresh } from "@mdi/js";
import CreateUserDialog from "./components/CreateUserDialog";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import PasswordChange from "@/pages/Settings/pages/Account/dialogs/PasswordChange";
import { SettingsSection } from "@/pages/Settings/components/SettingsLayout.jsx";
import { DeviceListItem } from "@/pages/Settings/components/DeviceListItem.jsx";
import { ApiTokenListItem } from "@/pages/Settings/components/ApiTokenListItem.jsx";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserContext, useToast } from "@/common/contexts";

const ITEMS_PER_PAGE = 25;

const fullName = (account) => [account?.firstName, account?.lastName].filter(Boolean).join(" ") || account?.username || "";

export const Users = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [sessions, setSessions] = useState([]);
    const [tokens, setTokens] = useState([]);
    const { user, overrideToken } = useContext(UserContext);
    const { sendToast, showError } = useToast();
    const navigate = useNavigate();

    const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
    const [contextUserId, setContextUserId] = useState(null);
    const [passwordChangeDialogOpen, setPasswordChangeDialogOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    const contextMenu = useContextMenu();

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const [listQuery, setListQuery] = useState({ currentPage, debouncedSearch });
    if (listQuery.currentPage !== currentPage || listQuery.debouncedSearch !== debouncedSearch) {
        setListQuery({ currentPage, debouncedSearch });
        setLoading(true);
    }

    const fetchUsers = useCallback(() => {
        const offset = (currentPage - 1) * ITEMS_PER_PAGE;
        const params = new URLSearchParams({
            limit: ITEMS_PER_PAGE.toString(),
            offset: offset.toString(),
        });
        if (debouncedSearch) {
            params.set("search", debouncedSearch);
        }
        return getRequest(`users/list?${params}`).then(response => {
            setUsers(response.users || []);
            setTotal(response.total || 0);
        }).catch(() => {
            setUsers([]);
            setTotal(0);
        }).finally(() => setLoading(false));
    }, [currentPage, debouncedSearch]);

    const loadSessions = useCallback(() => getRequest("users/sessions").then(setSessions).catch(showError), [showError]);
    const loadTokens = useCallback(() => getRequest("users/tokens").then(setTokens).catch(showError), [showError]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        loadSessions();
        loadTokens();
    }, [loadSessions, loadTokens]);

    const loadUsers = () => {
        setLoading(true);
        return fetchUsers();
    };

    const { open: showContextMenu } = contextMenu;
    const openContextMenu = useCallback((e, userId) => {
        e.stopPropagation();
        setContextUserId(userId);
        showContextMenu(e);
    }, [showContextMenu]);

    const contextUser = users.find(u => u.id === contextUserId);
    const isSelf = user?.id === contextUserId;

    const confirmAction = (text, run, successKey) => setPendingAction({
        text,
        run: () => run().then(() => {
            if (successKey) sendToast("Success", t(successKey, { name: contextUser?.username }));
            return Promise.all([loadUsers(), loadSessions(), loadTokens()]);
        }).catch(showError),
    });

    const loginAsUser = (userId) => postRequest(`users/${userId}/login`).then(response => {
        overrideToken(response.token);
        navigate("/servers");
    });

    const revokeSession = (session) => deleteRequest(`users/sessions/${session.id}`).then(() => {
        sendToast("Success", t("settings.users.sessions.signedOut"));
        return loadSessions();
    }).catch(showError);

    const handlePageChange = useCallback((page) => {
        setCurrentPage(page);
    }, []);

    const pagination = useMemo(() => ({
        total,
        currentPage,
        itemsPerPage: ITEMS_PER_PAGE,
    }), [total, currentPage]);

    const columns = useMemo(() => [
        {
            key: "user",
            label: t("settings.users.table.user"),
            render: (currentUser) => (
                <div className="user-cell">
                    <span className="name">
                        {currentUser.firstName} {currentUser.lastName}
                        {currentUser.disabled && <span className="settings-status error">{t("settings.users.locked")}</span>}
                    </span>
                    <span className="username">@{currentUser.username}</span>
                </div>
            ),
        },
        {
            key: "role",
            label: t("settings.users.table.role"),
            mobileLabel: t("settings.users.table.role"),
            render: (currentUser) => t(currentUser.role === "admin" ? "settings.users.roles.admin" : "settings.users.roles.user"),
        },
        {
            key: "totp",
            label: t("settings.users.table.twoFactor"),
            mobileLabel: t("settings.users.table.twoFactor"),
            render: (currentUser) => (
                <span className={`settings-status ${currentUser.totpEnabled || currentUser.passkeys ? "positive" : ""}`}>
                    {currentUser.totpEnabled ? t("settings.users.twoFactorEnabled")
                        : currentUser.passkeys ? t("settings.users.passkeys", { count: currentUser.passkeys })
                            : t("settings.users.twoFactorDisabled")}
                </span>
            ),
        },
        {
            key: "actions",
            label: "",
            className: "actions-cell",
            render: (currentUser) => (
                <Button icon={mdiDotsVertical} title={t("settings.users.table.actions")} aria-label={t("settings.users.table.actions")}
                    onClick={(e) => openContextMenu(e, currentUser.id)} />
            ),
        },
    ], [openContextMenu, t]);

    const name = contextUser?.username;

    return (
        <div className="users-page">
            <CreateUserDialog open={createUserDialogOpen} onClose={() => setCreateUserDialogOpen(false)}
                              loadUsers={loadUsers} />

            <ActionConfirmDialog open={pendingAction !== null} setOpen={open => !open && setPendingAction(null)}
                                 onConfirm={() => pendingAction?.run()} text={pendingAction?.text} />

            <PasswordChange open={passwordChangeDialogOpen} onClose={() => setPasswordChangeDialogOpen(false)}
                            accountId={contextUserId} />

            <div className="users-toolbar">
                <div className="users-search">
                    <IconInput icon={mdiMagnify} placeholder={t("settings.users.searchPlaceholder")}
                        aria-label={t("settings.users.searchPlaceholder")} value={searchQuery} setValue={setSearchQuery} />
                </div>
                <span className="users-count">{t("settings.users.title", { count: total })}</span>
                <Button onClick={() => setCreateUserDialogOpen(true)} text={t("settings.users.createNewUser")} icon={mdiPlus} />
            </div>

            <PaginatedTable
                data={users}
                columns={columns}
                columnTemplate="minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) 40px"
                pagination={pagination}
                onPageChange={handlePageChange}
                getRowKey={(user) => user.id}
                loading={loading}
                emptyState={{
                    icon: mdiAccount,
                    title: debouncedSearch ? t("settings.users.noSearchResults") : t("settings.users.noUsers"),
                    subtitle: debouncedSearch ? t("settings.users.noSearchResultsDescription") : t("settings.users.noUsersDescription"),
                }}
            />

            <SettingsSection title={t("settings.users.sessions.title")} description={t("settings.users.sessions.description")}>
                {sessions.length ? sessions.map(session => <DeviceListItem key={session.id} session={session}
                    owner={fullName(session.account) || t("settings.users.sessions.deletedAccount")}
                    badge={session.current && <span className="settings-status positive">{t("settings.sessions.currentSession")}</span>}
                    meta={session.impersonator && t("settings.users.sessions.openedBy", { name: fullName(session.impersonator), interpolation: { escapeValue: false } })}
                    actions={!session.current && <Button type="secondary" text={t("settings.sessions.revoke")} onClick={() => revokeSession(session)} />} />)
                    : <p className="settings-empty">{t("settings.users.sessions.empty")}</p>}
            </SettingsSection>

            <SettingsSection title={t("settings.users.tokens.title")} description={t("settings.users.tokens.description")}>
                {tokens.length ? tokens.map(token => <ApiTokenListItem key={token.id} token={token}
                    owner={fullName(token.account) || t("settings.users.sessions.deletedAccount")}
                    actions={<Button type="secondary" text={t("settings.apiTokens.revoke")}
                        onClick={() => setPendingAction({ text: t("settings.apiTokens.revokeConfirm", { name: token.name }),
                            run: () => deleteRequest(`users/tokens/${token.id}`).then(loadTokens).catch(showError) })} />} />)
                    : <p className="settings-empty">{t("settings.users.tokens.empty")}</p>}
            </SettingsSection>

            <ContextMenu
                isOpen={contextMenu.isOpen}
                position={contextMenu.position}
                onClose={contextMenu.close}
                trigger={contextMenu.triggerRef}
            >
                {!contextUser?.authProviderType && <ContextMenuItem
                    icon={mdiKey}
                    label={t("settings.users.contextMenu.changePassword")}
                    onClick={() => setPasswordChangeDialogOpen(true)}
                />}

                {!isSelf && contextUser?.role === "user" && <ContextMenuItem icon={mdiSecurity} label={t("settings.users.contextMenu.promoteToAdmin")}
                    onClick={() => confirmAction(t("settings.users.contextMenu.promoteConfirm"),
                        () => patchRequest(`users/${contextUserId}/role`, { role: "admin" }))} />}

                {!isSelf && contextUser?.role === "admin" && <ContextMenuItem icon={mdiAccount} label={t("settings.users.contextMenu.demoteToUser")}
                    onClick={() => confirmAction(t("settings.users.contextMenu.demoteConfirm"),
                        () => patchRequest(`users/${contextUserId}/role`, { role: "user" }))} />}

                {!isSelf && (contextUser?.totpEnabled || contextUser?.passkeys > 0) && <ContextMenuItem icon={mdiShieldRefresh}
                    label={t("settings.users.contextMenu.resetSecondFactor")}
                    onClick={() => confirmAction(t("settings.users.contextMenu.resetSecondFactorConfirm", { name }),
                        () => deleteRequest(`users/${contextUserId}/second-factor`), "settings.users.messages.secondFactorReset")} />}

                {!isSelf && <ContextMenuItem icon={contextUser?.disabled ? mdiLockOpenVariant : mdiLock}
                    label={t(contextUser?.disabled ? "settings.users.contextMenu.unlockUser" : "settings.users.contextMenu.lockUser")}
                    onClick={() => confirmAction(t(contextUser?.disabled ? "settings.users.contextMenu.unlockConfirm" : "settings.users.contextMenu.lockConfirm", { name }),
                        () => patchRequest(`users/${contextUserId}/lock`, { locked: !contextUser?.disabled }),
                        contextUser?.disabled ? "settings.users.messages.unlocked" : "settings.users.messages.locked")} />}

                {!isSelf && !contextUser?.disabled && <ContextMenuItem icon={mdiLogin} label={t("settings.users.contextMenu.loginAsUser")}
                    onClick={() => setPendingAction({ text: t("settings.users.contextMenu.loginAsConfirm", { name }),
                        run: () => loginAsUser(contextUserId).catch(showError) })} />}

                {!isSelf && <ContextMenuItem icon={mdiAccountRemove} label={t("settings.users.contextMenu.deleteUser")} danger
                    onClick={() => confirmAction(t("settings.users.contextMenu.deleteConfirm"), () => deleteRequest(`users/${contextUserId}`))} />}
            </ContextMenu>
        </div>
    );
};
