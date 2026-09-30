import "./styles.sass";
import { startPointerDrag } from "@/common/utils/pointerDrag.js";
import { filterInventory, findOrganizationForServer, getOrganizationId, parseOrganizationId } from "@/common/utils/inventory.js";
import ServerSearch from "./components/ServerSearch";
import { useContext, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import ServerEntries from "./components/ServerEntries.jsx";
import Icon from "@mdi/react";
import {
    mdiCursorDefaultClick,
    mdiTag,
    mdiConnection,
    mdiContentCopy,
    mdiFolderOpen,
    mdiFolderPlus,
    mdiFolderRemove,
    mdiFormTextbox,
    mdiPencil,
    mdiPower,
    mdiServerMinus,
    mdiPowerPlug,
    mdiStop,
    mdiImport,
    mdiFileDocumentOutline,
    mdiPlusCircle,
    mdiConsole,
    mdiCog,
    mdiScript,
    mdiLanConnect,
} from "@mdi/js";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenu } from "@/common/components/ContextMenu";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { getIconPath } from "@/common/utils/iconUtils.js";
import { PROTOCOLS } from "@/common/utils/protocols.js";
import { useDrop, useDragLayer } from "react-dnd";
import { deleteRequest, patchRequest, postRequest, putRequest } from "@/common/utils/RequestUtil.js";
import TagFilterMenu from "./components/ServerSearch/components/TagFilterMenu";
import ProxmoxLogo from "./assets/proxmox.jsx";
import TagsSubmenu from "./components/TagsSubmenu";
import ScriptsMenu from "./components/ScriptsMenu";
import { IdentityMenuItem, ResumeSessionItem } from "@/pages/Servers/components/EntryMenuItems/EntryMenuItems.jsx";
import { useIdentityName } from "@/common/hooks/useIdentityName.js";
import { ServerContext, IdentityContext, UserContext, useToast, useScripts } from "@/common/contexts";
import { formatRelative } from "@/common/utils/formatUtils.js";

const applyRenameState = folderId => entry =>
    entry.type === "folder" && entry.id === parseInt(folderId)
        ? { ...entry, renameState: true }
        : entry.entries ? { ...entry, entries: entry.entries.map(applyRenameState(folderId)) } : entry;

export const ServerList = ({
    setServerDialogOpen,
    setCurrentFolderId,
    setIntegrationDialogOpen,
    setSSHConfigImportDialogOpen,
    setEditServerId,
    connectToServer,
    openSFTP,
    setCurrentOrganizationId,
    hibernatedSessions = [],
    resumeSession,
    openDirectConnect,
    runScript,
    mobileOpen = false,
    setMobileOpen,
}) => {
    const { t } = useTranslation();
    const { servers, loadServers, getServerById } = useContext(ServerContext);
    const { identities } = useContext(IdentityContext);
    const { sendToast, showError } = useToast();
    const { user } = useContext(UserContext);
    const isAdmin = user?.role === "admin";
    const [search, setSearch] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);
    const [showTagFilter, setShowTagFilter] = useState(false);
    const [contextClickedType, setContextClickedType] = useState(null);
    const [contextClickedId, setContextClickedId] = useState(null);
    const [renameStateId, setRenameStateId] = useState(null);
    const [width, setWidth] = useState(288);
    const [isResizing, setIsResizing] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [contextMenuOpenedAt, setContextMenuOpenedAt] = useState(0);
    const serverListRef = useRef(null);
    const serversContainerRef = useRef(null);
    const scrollIntervalRef = useRef(null);
    const tagButtonRef = useRef(null);
    const { allScripts: scripts } = useScripts();
    const [scriptsMenuOpen, setScriptsMenuOpen] = useState(false);
    const [scriptsMenuServer, setScriptsMenuServer] = useState(null);
    const [isMobile, setIsMobile] = useState(false);

    const contextMenu = useContextMenu();

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile && setMobileOpen) setMobileOpen(false);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [setMobileOpen]);

    useEffect(() => {
        if (!isMobile || !mobileOpen) return;
        const handleClickOutside = (e) => {
            if (serverListRef.current && !serverListRef.current.contains(e.target) && 
                !e.target.closest('.server-list-toggle') &&
                !e.target.closest('.mobile-nav')) {
                setMobileOpen?.(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isMobile, mobileOpen, setMobileOpen]);

    const server = contextClickedId ? (contextClickedType === "server-object" || contextClickedType?.startsWith("pve-")) ? getServerById(contextClickedId) : null : null;
    // not negations of each other: an unknown status keeps all actions available
    const pveUp = ["running", "online"].includes(server?.status);
    const pveDown = ["stopped", "offline"].includes(server?.status);
    const isOrgFolder = contextClickedId && contextClickedId.toString().startsWith("org-");

    const getServerOrganizationId = serverId => getOrganizationId(findOrganizationForServer(serverId, servers));

    const openScriptsMenu = () => {
        if (server) {
            setScriptsMenuServer(server);
            setScriptsMenuOpen(true);
            contextMenu.close();
        }
    };

    const closeScriptsMenu = () => {
        setScriptsMenuOpen(false);
        setScriptsMenuServer(null);
    };

    const wakeServer = async () => {
        if (!server) return;

        try {
            await postRequest(`entries/${server.id}/wake`);
            sendToast("Success", t("servers.wol.successDescription", { name: server.name }));
        } catch {
            sendToast("Error", t("servers.wol.errorDescription"));
        }
    };

    const { isDragging, clientOffset } = useDragLayer((monitor) => ({
        isDragging: monitor.isDragging(),
        clientOffset: monitor.getClientOffset(),
    }));

    const [{ isOver }, dropRef] = useDrop({
        accept: ["server", "folder"],
        drop: async (item, monitor) => {
            const didDrop = monitor.didDrop();
            if (didDrop) return;

            try {
                if (item.type === "server") {
                    await patchRequest(`entries/${item.id}/reposition`, {
                        targetId: null,
                        placement: "after",
                        folderId: null,
                    });
                    loadServers();
                    return {};
                }

                if (item.type === "folder") {
                    await patchRequest(`folders/${item.id}`, { parentId: null });
                    loadServers();
                    return {};
                }
            } catch (error) {
                console.error("Failed to drop item at root level", error.message);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
        }),
    });

    const filteredServers = search.trim() || selectedTags.length > 0
        ? filterInventory(servers, search, selectedTags)
        : servers;
    const renameStateServers = renameStateId ? filteredServers.map(applyRenameState(renameStateId)) : filteredServers;

    const handleContextMenu = (e) => {
        e.preventDefault();
        const targetElement = e.target.closest("[data-id]");
        if (targetElement !== null) {
            setContextClickedId(targetElement.getAttribute("data-id"));
            setContextClickedType(targetElement.classList[0]);
        } else {
            setContextClickedId(null);
            setContextClickedType(null);
        }

        setContextMenuOpenedAt(Date.now());
        contextMenu.open(e, { x: e.clientX, y: e.clientY });
    };

    const hibernatedSessionsForServer = server ? hibernatedSessions.filter(s => s.server.id == server.id) : [];

    const formatSessionDate = (session) => session?.lastActivity ? formatRelative(session.lastActivity, contextMenuOpenedAt) : "";

    const createFolder = () => {
        const organizationId = isOrgFolder ? parseOrganizationId(contextClickedId) : undefined;

        putRequest("folders", {
            name: t("servers.contextMenu.newFolderName"),
            parentId: isOrgFolder ? undefined : (contextClickedId === null ? undefined : contextClickedId),
            organizationId: organizationId,
        }).then(async (result) => {
            await loadServers();
            if (result.id) setRenameStateId(result.id);
        }).catch(showError);
    };

    const [pendingDelete, setPendingDelete] = useState(null);
    const deleteFolder = () => setPendingDelete({ path: "folders/" + contextClickedId, text: t("servers.contextMenu.deleteFolderConfirm") });
    const deleteServer = () => setPendingDelete({ path: "entries/" + contextClickedId, text: t("servers.contextMenu.deleteServerConfirm", { name: server?.name }) });
    const confirmDelete = () => deleteRequest(pendingDelete.path).then(loadServers).catch(showError);

    const setFolderContext = () => {
        if (isOrgFolder) {
            setCurrentFolderId(null);
            setCurrentOrganizationId(parseOrganizationId(contextClickedId));
        } else {
            setCurrentFolderId(contextClickedId);
            setCurrentOrganizationId(null);
        }
    };

    const createServer = (protocol) => { setFolderContext(); setServerDialogOpen(protocol); };
    const createPVEServer = () => { setFolderContext(); setIntegrationDialogOpen("proxmox"); };
    const createNetboxIntegration = () => { setFolderContext(); setIntegrationDialogOpen("netbox"); };
    const openSSHConfigImport = () => { setFolderContext(); setSSHConfigImportDialogOpen(); };

    const getIdentity = (id = null) => identities?.find(i => i.id === (id || server?.identities[0]));
    const connect = (id = null) => connectToServer(server?.id, server?.protocol === "telnet" ? undefined : getIdentity(id));
    const connectSFTP = (id = null) => openSFTP(server?.id, getIdentity(id));

    const getIdentityName = useIdentityName();

    const editServer = () => {
        const orgId = getServerOrganizationId(contextClickedId);
        setCurrentOrganizationId(orgId);
        setEditServerId(contextClickedId);
        setServerDialogOpen();
    };

    const editPVEServer = () => {
        const integrationId = server?.integrationId;
        if (integrationId) {
            setEditServerId(integrationId);
            setIntegrationDialogOpen();
        }
    };

    const editLinkedIntegration = () => {
        const integrationId = server?.integrationId;
        if (!integrationId) return;
        setEditServerId(integrationId);
        setIntegrationDialogOpen(server?.managedBy === "netbox" ? "netbox" : "proxmox");
    };

    const postPVEAction = (type) => {
        postRequest(`integrations/entry/${contextClickedId}/${type}`)
            .then(loadServers).catch(showError);
    };

    const duplicateServer = async () => {
        const serverToDuplicate = getServerById(contextClickedId);
        if (!serverToDuplicate) return;

        try {
            await postRequest(`entries/${serverToDuplicate.id}/duplicate`);
            await loadServers();
            sendToast("Success", t("servers.contextMenu.duplicated", { name: serverToDuplicate.name }));
        } catch (error) {
            showError(error);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showTagFilter && tagButtonRef.current && !tagButtonRef.current.contains(e.target)) {
                const tagMenu = document.querySelector(".tag-filter-menu");
                if (tagMenu && !tagMenu.contains(e.target)) {
                    setShowTagFilter(false);
                }
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showTagFilter]);

    const startResizing = (e) => {
        e.preventDefault();

        if (isCollapsed) {
            setIsCollapsed(false);
            setWidth(288);
            return;
        }

        const left = serverListRef.current.getBoundingClientRect().left;
        setIsResizing(true);
        startPointerDrag((move) => {
            const newWidth = move.clientX - left;
            setIsCollapsed(newWidth <= 180);
            setWidth(newWidth <= 180 ? 0 : newWidth);
        }, () => setIsResizing(false));
    };

    useEffect(() => {
        if (!isDragging || !clientOffset || !serversContainerRef.current) {
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
            return;
        }

        const container = serversContainerRef.current;
        const rect = container.getBoundingClientRect();
        const scrollThreshold = 50;
        const scrollSpeed = 10;

        const mouseY = clientOffset.y;
        const distanceFromTop = mouseY - rect.top;
        const distanceFromBottom = rect.bottom - mouseY;

        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }

        if (distanceFromTop < scrollThreshold && distanceFromTop > 0) {
            scrollIntervalRef.current = setInterval(() => {
                container.scrollTop = Math.max(0, container.scrollTop - scrollSpeed);
            }, 16);
        } else if (distanceFromBottom < scrollThreshold && distanceFromBottom > 0) {
            scrollIntervalRef.current = setInterval(() => {
                container.scrollTop = Math.min(
                    container.scrollHeight - container.clientHeight,
                    container.scrollTop + scrollSpeed,
                );
            }, 16);
        }

        return () => {
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
        };
    }, [isDragging, clientOffset]);

    return (
        <>
            <ActionConfirmDialog open={!!pendingDelete} setOpen={open => !open && setPendingDelete(null)}
                onConfirm={confirmDelete} text={pendingDelete?.text} />
            {isMobile && mobileOpen && <div className="server-list-overlay" onClick={() => setMobileOpen?.(false)} />}
            <div
                className={`server-list ${isCollapsed ? "collapsed" : ""} ${isMobile ? "mobile" : ""} ${mobileOpen ? "mobile-open" : ""}`}
                style={!isMobile ? { width: isCollapsed ? "0px" : `${width}px` } : undefined} 
                ref={serverListRef}
                onPointerDown={!isMobile && isCollapsed ? startResizing : undefined}>
            {(!isCollapsed || (isMobile && mobileOpen)) && (
                <div className="server-list-inner" ref={dropRef}>
                    <div className="inventory-heading"><span>{t("workspace.inventory")}</span>
                        <button type="button" aria-label={t("workspace.addServer")} onClick={() => {
                            setCurrentFolderId(null); setCurrentOrganizationId(null); setEditServerId(null); setServerDialogOpen(null);
                        }}><Icon path={mdiPlusCircle} size={0.85} /></button>
                    </div>
                    <div className="search-container">
                        <ServerSearch search={search} setSearch={setSearch} />
                        <button type="button" aria-label={t("servers.tags.filterByTags")} aria-expanded={showTagFilter}
                            ref={tagButtonRef}
                            className={`tag-filter-button ${selectedTags.length > 0 ? "active" : ""}`}
                            onClick={() => setShowTagFilter(!showTagFilter)}
                            title={t("servers.tags.filterByTags")}>
                            <Icon path={mdiTag} />
                            {selectedTags.length > 0 && (
                                <span className="tag-count">{selectedTags.length}</span>
                            )}
                        </button>
                    </div>
                    {showTagFilter && (
                        <TagFilterMenu
                            selectedTags={selectedTags}
                            setSelectedTags={setSelectedTags}
                            onClose={() => setShowTagFilter(false)}
                        />
                    )}
                    {servers && servers.length >= 1 && (
                        <div className={`servers${isOver ? " drop-zone-active" : ""}`}
                            onContextMenu={handleContextMenu}
                            ref={serversContainerRef}>
                            <ServerEntries entries={renameStateServers} setRenameStateId={setRenameStateId}
                                nestedLevel={0} connectToServer={connectToServer} hibernatedSessions={hibernatedSessions} />
                            {filteredServers.length === 0 && <p className="no-matches" role="status">{t("workspace.noMatches")}</p>}
                        </div>
                    )}
                    {servers && servers.length === 0 && (
                        <div className={`no-servers${isOver ? " drop-zone-active" : ""}`}
                            onContextMenu={handleContextMenu}>
                            <Icon path={mdiCursorDefaultClick} />
                            <p>{t("workspace.inventoryHint")}</p>
                        </div>
                    )}

                    <ContextMenu
                        isOpen={contextMenu.isOpen}
                        position={contextMenu.position}
                        onClose={contextMenu.close}
                        trigger={contextMenu.triggerRef}
                    >
                        {contextClickedType !== "server-object" && (
                            <>
                                {(contextClickedType === null || contextClickedType === "folder-object" || isOrgFolder) && (
                                    <ContextMenuItem
                                        icon={mdiPlusCircle}
                                        label={t("servers.contextMenu.new")}
                                    >
                                        <ContextMenuItem
                                            icon={mdiConsole}
                                            label={t("servers.contextMenu.sshServer")}
                                            onClick={() => createServer("ssh")}
                                        />
                                        <ContextMenuItem
                                            icon={mdiConsole}
                                            label={t("servers.contextMenu.telnetServer")}
                                            onClick={() => createServer("telnet")}
                                        />
                                        <ContextMenuItem
                                            icon={getIconPath(PROTOCOLS.rdp.icon)}
                                            label={t("servers.contextMenu.rdpServer")}
                                            onClick={() => createServer("rdp")}
                                        />
                                        <ContextMenuItem
                                            icon={getIconPath(PROTOCOLS.vnc.icon)}
                                            label={t("servers.contextMenu.vncServer")}
                                            onClick={() => createServer("vnc")}
                                        />
                                    </ContextMenuItem>
                                )}
                                {(contextClickedType === "folder-object" || isOrgFolder) && (isAdmin || !isOrgFolder) && (
                                    <ContextMenuItem
                                        icon={mdiImport}
                                        label={t("servers.contextMenu.import")}
                                    >
                                        {isAdmin && <>
                                            <ContextMenuItem
                                                icon={<ProxmoxLogo />}
                                                label={t("servers.contextMenu.pve")}
                                                onClick={createPVEServer}
                                            />
                                            <ContextMenuItem
                                                icon={mdiLanConnect}
                                                label={t("servers.contextMenu.netbox")}
                                                onClick={createNetboxIntegration}
                                            />
                                        </>}
                                        {!isOrgFolder && (
                                            <ContextMenuItem
                                                icon={mdiFileDocumentOutline}
                                                label={t("servers.contextMenu.sshConfig")}
                                                onClick={openSSHConfigImport}
                                            />
                                        )}
                                    </ContextMenuItem>
                                )}
                            </>
                        )}

                        {contextClickedType === "folder-object" && !isOrgFolder && (
                            <>
                                <ContextMenuItem
                                    icon={mdiFolderPlus}
                                    label={t("servers.contextMenu.createFolder")}
                                    onClick={createFolder}
                                />
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiFormTextbox}
                                    label={t("servers.contextMenu.renameFolder")}
                                    onClick={() => setRenameStateId(contextClickedId)}
                                />
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiFolderRemove}
                                    label={t("servers.contextMenu.deleteFolder")}
                                    onClick={deleteFolder}
                                    danger
                                />
                            </>
                        )}

                        {(contextClickedType === null || isOrgFolder) && (
                            <ContextMenuItem
                                icon={mdiFolderPlus}
                                label={t("servers.contextMenu.createFolder")}
                                onClick={createFolder}
                            />
                        )}

                        {contextClickedType === "server-object" && hibernatedSessionsForServer.length > 0 && <>
                            <ResumeSessionItem sessions={hibernatedSessionsForServer} formatDate={formatSessionDate} onResume={resumeSession} />
                            <ContextMenuSeparator />
                        </>}

                        {contextClickedType === "server-object" && server?.type === "server" && (
                            <>
                                {(server.identities?.length > 0 || server.protocol === "telnet") && (
                                    <IdentityMenuItem icon={mdiConnection} label={t("servers.contextMenu.connect")}
                                        identityIds={server.protocol === "telnet" ? [] : server.identities} onSelect={connect} />
                                )}
                                {server.identities?.length > 0 && server.protocol === "ssh" && (
                                    <IdentityMenuItem icon={mdiFolderOpen} label={t("servers.contextMenu.openSFTP")}
                                        identityIds={server.identities} onSelect={connectSFTP} />
                                )}
                                {server?.identities?.length > 0 && server?.protocol === "ssh" && scripts.length > 0 && (
                                    <ContextMenuItem
                                        icon={mdiScript}
                                        label={t("servers.contextMenu.runScript")}
                                        onClick={openScriptsMenu}
                                    />
                                )}

                                {server?.type === "server" && (server?.protocol === "ssh" || server?.protocol === "telnet" || server?.protocol === "rdp" || server?.protocol === "vnc") && (
                                    <ContextMenuItem
                                        icon={mdiCursorDefaultClick}
                                        label={t("servers.contextMenu.quickConnect")}
                                        onClick={() => openDirectConnect(server)}
                                    />
                                )}

                                {server?.wakeOnLanEnabled && server?.macAddress && (
                                    <ContextMenuItem
                                        icon={mdiPowerPlug}
                                        label={t("servers.contextMenu.wakeOnLan")}
                                        onClick={wakeServer}
                                    />
                                )}

                                <ContextMenuSeparator />

                                <ContextMenuItem
                                    icon={mdiPencil}
                                    label={t("servers.contextMenu.editServer")}
                                    onClick={editServer}
                                />
                                {server?.integrationId && isAdmin && (
                                    <ContextMenuItem
                                        icon={mdiCog}
                                        label={t("servers.contextMenu.editIntegration")}
                                        onClick={editLinkedIntegration}
                                    />
                                )}

                                <ContextMenuItem
                                    icon={mdiContentCopy}
                                    label={t("servers.contextMenu.duplicateServer")}
                                    onClick={duplicateServer}
                                />

                                <ContextMenuItem
                                    icon={mdiTag}
                                    label={t("servers.tags.title")}
                                >
                                    <TagsSubmenu entryId={contextClickedId} entryTags={server?.tags || []} />
                                </ContextMenuItem>

                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiServerMinus}
                                    label={t("servers.contextMenu.deleteServer")}
                                    onClick={deleteServer}
                                    danger
                                />
                            </>
                        )}

                        {contextClickedType === "server-object" && server?.type?.startsWith("pve-") && (
                            <>
                                {!pveDown && (
                                    <>
                                        <ContextMenuItem
                                            icon={mdiConnection}
                                            label={t("servers.contextMenu.connect")}
                                            onClick={() => connectToServer(server.id)}
                                        />
                                        <ContextMenuSeparator />
                                    </>
                                )}
                                <ContextMenuItem
                                    icon={mdiPencil}
                                    label={t("servers.contextMenu.editServer")}
                                    onClick={editServer}
                                />
                                {isAdmin && <ContextMenuItem
                                    icon={mdiCog}
                                    label={t("servers.contextMenu.editIntegration")}
                                    onClick={editPVEServer}
                                />}
                                <ContextMenuItem
                                    icon={mdiTag}
                                    label={t("servers.tags.title")}
                                >
                                    <TagsSubmenu entryId={contextClickedId} entryTags={server?.tags || []} />
                                </ContextMenuItem>
                                {!pveDown && server.type !== "pve-shell" && (
                                    <>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                            icon={mdiPower}
                                            label={t("servers.contextMenu.shutdown")}
                                            onClick={() => postPVEAction("shutdown")}
                                        />
                                        <ContextMenuItem
                                            icon={mdiStop}
                                            label={t("servers.contextMenu.stop")}
                                            onClick={() => postPVEAction("stop")}
                                        />
                                    </>
                                )}
                                {!pveUp && (
                                    <>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                            icon={mdiPower}
                                            label={t("servers.contextMenu.start")}
                                            onClick={() => postPVEAction("start")}
                                        />
                                    </>
                                )}
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiServerMinus}
                                    label={t("servers.contextMenu.deleteServer")}
                                    onClick={deleteServer}
                                    danger
                                />
                            </>
                        )}
                    </ContextMenu>
                    <ScriptsMenu
                        visible={scriptsMenuOpen}
                        onClose={closeScriptsMenu}
                        scripts={scripts}
                        server={scriptsMenuServer}
                        serverOrganizationId={scriptsMenuServer ? getServerOrganizationId(scriptsMenuServer.id) : null}
                        onRunScript={runScript}
                        getIdentityName={getIdentityName}
                    />
                </div>
            )}
            {!isMobile && !isCollapsed && <div className={`resizer${isResizing ? " is-resizing" : ""}`} onPointerDown={startResizing} />}
        </div>
        </>
    );
};
