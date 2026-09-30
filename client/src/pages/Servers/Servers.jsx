import "./styles.sass";
import { findOrganizationForServer, getOrganizationId } from "@/common/utils/inventory.js";
import { upsertSession } from "@/common/utils/sessionState.js";
import ServerList from "@/pages/Servers/components/ServerList";
import { useContext, useEffect, useEffectEvent, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import WelcomePanel from "@/pages/Servers/components/WelcomePanel";
import ServerDialog from "@/pages/Servers/components/ServerDialog";
import ViewContainer from "@/pages/Servers/components/ViewContainer";
import IntegrationDialog from "@/pages/Servers/components/IntegrationDialog";
import SSHConfigImportDialog from "@/pages/Servers/components/SSHConfigImportDialog";
import ConnectionReasonDialog from "@/pages/Servers/components/ConnectionReasonDialog";
import DirectConnectDialog from "@/pages/Servers/components/DirectConnectDialog";
import FileManagerWindow from "@/pages/Servers/components/FileManagerWindow";
import FileEditorWindow from "@/common/components/FileEditorWindow";
import FilePreviewWindow from "@/common/components/FilePreviewWindow";
import { useLocation, useNavigate } from "react-router-dom";
import { getTabId, getBrowserId } from "@/common/utils/ConnectionUtil.js";
import { postRequest, deleteRequest } from "@/common/utils/RequestUtil";
import { useToast, useActiveSessions, ServerContext, StateStreamContext } from "@/common/contexts";
import { STATE_TYPES } from "@/common/hooks/useStateStream.js";
import { LAYERS } from "@/common/utils/layers.js";
import { useTranslation } from "react-i18next";

// the slot is rendered by the root layout and may mount after this page
const subscribeToLeftPaneSlot = () => () => {};
const getLeftPaneSlot = () => document.getElementById("left-pane-slot");

export const Servers = ({ hidden }) => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();

    const [serverDialogOpen, setServerDialogOpen] = useState(false);
    const [serverDialogProtocol, setServerDialogProtocol] = useState(null);
    const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false);
    const [integrationDialogType, setIntegrationDialogType] = useState("proxmox");
    const [sshConfigImportDialogOpen, setSSHConfigImportDialogOpen] = useState(false);
    const [connectionReasonDialogOpen, setConnectionReasonDialogOpen] = useState(false);
    const [directConnectDialogOpen, setDirectConnectDialogOpen] = useState(false);
    const [directConnectServer, setDirectConnectServer] = useState(null);
    const [pendingConnection, setPendingConnection] = useState(null);
    const [floatingWindows, setFloatingWindows] = useState([]);
    const [windowOrder, setWindowOrder] = useState([]);
    const stackedWindowIds = [
        ...windowOrder.filter(id => floatingWindows.some(floatingWindow => floatingWindow.id === id)),
        ...floatingWindows.filter(floatingWindow => !windowOrder.includes(floatingWindow.id)).map(floatingWindow => floatingWindow.id),
    ];
    const raiseWindow = id => {
        if (stackedWindowIds.at(-1) !== id) setWindowOrder([...stackedWindowIds.filter(other => other !== id), id]);
    };
    const [mobileServerListOpen, setMobileServerListOpen] = useState(false);
    const leftPaneSlot = useSyncExternalStore(subscribeToLeftPaneSlot, getLeftPaneSlot);

    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [currentOrganizationId, setCurrentOrganizationId] = useState(null);
    const [editServerId, setEditServerId] = useState(null);
    const { activeSessions, setActiveSessions, activeSessionId, setActiveSessionId, poppedOutSessions } = useActiveSessions();
    const { getServerById, servers } = useContext(ServerContext);
    const { registerHandler } = useContext(StateStreamContext);
    const location = useLocation();
    const navigate = useNavigate();

    const [hibernatedSessions, setHibernatedSessions] = useState([]);
    const closingSessionsRef = useRef(new Set());

    const visibleSessions = activeSessions.filter(s => !poppedOutSessions.includes(s.id));

    useEffect(() => {
        const handleToggle = () => setMobileServerListOpen(prev => !prev);
        window.addEventListener('toggleServerList', handleToggle);
        return () => window.removeEventListener('toggleServerList', handleToggle);
    }, []);

    const handleConnectionsUpdate = useCallback((sessions) => {
        if (!servers) return;
        const mappedSessions = sessions.map(session => {
            const server = getServerById(session.entryId);
            if (!server) return null;
            return {
                id: session.sessionId,
                server,
                identity: session.configuration.identityId,
                isHibernated: session.isHibernated,
                lastActivity: session.lastActivity,
                type: session.configuration.type || undefined,
                organizationId: session.organizationId,
                organizationName: session.organizationName,
                scriptId: session.configuration.scriptId || undefined,
                shareId: session.shareId || null,
                shareWritable: session.shareWritable || false,
            };
        }).filter(Boolean);

        const closingSessions = closingSessionsRef.current;
        const activeMapped = mappedSessions.filter(s => !s.isHibernated && !closingSessions.has(s.id));
        const hibernatedMapped = mappedSessions.filter(s => s.isHibernated);

        const serverSessionIds = new Set(sessions.map(s => s.sessionId));
        closingSessions.forEach(id => {
            if (!serverSessionIds.has(id)) {
                closingSessions.delete(id);
            }
        });

        const newActiveIds = new Set(activeMapped.map(s => s.id));

        setActiveSessions(prev => {
            const prevMap = new Map(prev.map(s => [s.id, s]));
            return activeMapped.map(newSession => {
                const existing = prevMap.get(newSession.id);
                return existing ? { ...newSession, scriptId: existing.scriptId || newSession.scriptId, scriptName: existing.scriptName } : newSession;
            });
        });
        setHibernatedSessions(hibernatedMapped);

        setActiveSessionId(prev => {
            if (!prev || !newActiveIds.has(prev)) {
                return activeMapped.at(-1)?.id || null;
            }
            return prev;
        });
    }, [servers, getServerById, setActiveSessions, setActiveSessionId]);

    useEffect(() => {
        if (servers) return registerHandler(STATE_TYPES.CONNECTIONS, handleConnectionsUpdate);
    }, [servers, registerHandler, handleConnectionsUpdate]);

    const checkConnectionReasonRequired = (serverId, servers) => {
        if (!servers || !serverId) return false;

        return findOrganizationForServer(parseInt(serverId), servers)?.requireConnectionReason || false;
    };

    const connectToServer = async (serverId, identity, overrideRenderer) => {
        const server = getServerById(serverId);
        if (!server) {
            sendToast("Error", t("servers.messages.serverUnavailable"));
            return;
        }

        const hibernated = hibernatedSessions.find(s => s.server.id === server.id && s.identity === identity?.id);
        if (hibernated) {
            resumeConnection(hibernated.id);
            return;
        }

        const isPveEntry = server?.type?.startsWith("pve-");
        const hasIdentities = server?.identities && server.identities.length > 0;
        if (server && !isPveEntry && !hasIdentities) {
            openDirectConnect(server);
            return;
        }

        requestConnection({ ...server, renderer: overrideRenderer || server.renderer }, identity);
    };

    const openSFTP = async (server, identity) => requestConnection(getServerById(server), identity, { type: "sftp" });

    const performConnection = async (server, identity, { connectionReason = null, type = null, directIdentity = null, scriptId = null, startPath = null } = {}) => {
        try {
            const payload = {
                entryId: server.id,
                identityId: identity?.id,
                connectionReason,
                type,
                tabId: getTabId(),
                browserId: getBrowserId(),
            };

            if (directIdentity) payload.directIdentity = directIdentity;
            if (scriptId) payload.scriptId = scriptId;
            if (startPath) payload.startPath = startPath;
            const session = await postRequest("/connections", payload);

            const organization = findOrganizationForServer(server.id, servers);
            const organizationId = getOrganizationId(organization);

            const sessionData = {
                server,
                identity: identity?.id,
                id: session.sessionId,
                type: type || undefined,
                organizationId: organizationId,
                organizationName: organization?.name || null,
                scriptId: scriptId || undefined,
            };

            setActiveSessions(prevSessions => upsertSession(prevSessions, sessionData));
            setActiveSessionId(session.sessionId);
        } catch (error) {
            showError(error, t("servers.messages.connectionFailed"));
        }
    };

    const requestConnection = (server, identity, options = {}) => {
        if (checkConnectionReasonRequired(server.id, servers)) {
            setPendingConnection({ server, identity, options });
            setConnectionReasonDialogOpen(true);
            return;
        }
        performConnection(server, identity, options);
    };

    const closeWindow = id => setFloatingWindows(prev => prev.filter(floatingWindow => floatingWindow.id !== id));
    const fileManagerId = sessionId => `file-manager-${sessionId}`;

    const openFileManagerFromTab = (sessionId) => {
        const session = activeSessions.find(s => s.id === sessionId);
        if (!session?.server || session.type === "sftp" || session.server.protocol !== "ssh") return;
        const id = fileManagerId(sessionId);
        if (floatingWindows.some(floatingWindow => floatingWindow.id === id)) return raiseWindow(id);
        setFloatingWindows(prev => [...prev, { id, type: "fileManager", session: { ...session, type: "sftp", reuseTerminalSession: true } }]);
    };

    const runScript = async (serverId, identityId, scriptId) => {
        const server = getServerById(serverId);
        if (!server) {
            console.error("Server not found");
            return;
        }

        requestConnection(server, { id: identityId }, { scriptId });
    };

    const resumeConnection = async (sessionId) => {
        try {
            await postRequest(`/connections/${sessionId}/resume`, {
                tabId: getTabId(),
                browserId: getBrowserId(),
            });
            setActiveSessionId(sessionId);
        } catch (error) {
            sendToast("Error", error.message || "Failed to resume session");
        }
    };

    const handleConnectionReasonProvided = (reason) => {
        if (pendingConnection) {
            performConnection(pendingConnection.server, pendingConnection.identity, { ...pendingConnection.options, connectionReason: reason });
            setPendingConnection(null);
        }
        setConnectionReasonDialogOpen(false);
    };

    const handleConnectionReasonCanceled = () => {
        setPendingConnection(null);
        setConnectionReasonDialogOpen(false);
    };

    const disconnectFromServer = useCallback((sessionId) => {
        setActiveSessions(prev => {
            const newSessions = prev.filter(session => session.id !== sessionId);
            setActiveSessionId(currentActiveId => {
                if (newSessions.length === 0) return null;
                if (sessionId === currentActiveId) return newSessions.at(-1)?.id || null;
                return currentActiveId;
            });
            return newSessions;
        });
    }, [setActiveSessions, setActiveSessionId]);

    const closeSession = async (sessionId) => {
        closingSessionsRef.current.add(sessionId);
        try {
            await deleteRequest(`/connections/${sessionId}`);
            disconnectFromServer(sessionId);
        } catch (error) {
            closingSessionsRef.current.delete(sessionId);
            sendToast("Error", error.message || "Failed to close session. Try again.");
        }
    };

    const hibernateSession = async (sessionId) => {
        try {
            await postRequest(`/connections/${sessionId}/hibernate`);

            if (sessionId === activeSessionId) {
                const otherSessions = activeSessions.filter(s => s.id !== sessionId);
                setActiveSessionId(otherSessions.at(-1)?.id || null);
            }
        } catch (error) {
            sendToast("Error", error.message || "Failed to suspend session");
        }
    };

    const duplicateSession = async (sessionId) => {
        try {
            const result = await postRequest(`/connections/${sessionId}/duplicate`, {
                tabId: getTabId(),
                browserId: getBrowserId(),
            });

            if (result?.sessionId) {
                const originalSession = activeSessions.find(s => s.id === sessionId);
                if (originalSession) {
                    const sessionData = {
                        ...originalSession,
                        id: result.sessionId,
                        shareId: null,
                        shareWritable: false,
                    };
                    setActiveSessions(prevSessions => upsertSession(prevSessions, sessionData));
                    setActiveSessionId(result.sessionId);
                }
            }
        } catch (error) {
            sendToast("Error", error.message || "Failed to duplicate session");
        }
    };

    const openTerminalFromFileManager = (sessionId, path) => {
        const session = activeSessions.find(s => s.id === sessionId);
        if (!session?.server) return;
        closeWindow(fileManagerId(sessionId));
        requestConnection(session.server, session.identity ? { id: session.identity } : null, { startPath: path });
    };

    const closeDialog = () => {
        setServerDialogOpen(false);
        setServerDialogProtocol(null);
        setCurrentFolderId(null);
        setEditServerId(null);
    };

    const closePVEDialog = () => {
        setIntegrationDialogOpen(false);
        setIntegrationDialogType("proxmox");
        setCurrentFolderId(null);
        setEditServerId(null);
    };

    const closeSSHConfigImportDialog = () => {
        setSSHConfigImportDialogOpen(false);
        setCurrentFolderId(null);
    };

    const openDirectConnect = (server) => {
        setDirectConnectServer(server);
        setDirectConnectDialogOpen(true);
    };

    const closeDirectConnectDialog = () => {
        setDirectConnectDialogOpen(false);
        setDirectConnectServer(null);
    };

    const handleDirectConnect = ({ directIdentity = null, identityId = null } = {}) => {
        if (!directConnectServer) return;

        requestConnection(directConnectServer, identityId ? { id: identityId } : null, { directIdentity });
    };

    const getAutoConnectTarget = (params) => {
        const server = getServerById(params.get("connectId"));
        const isPveEntry = server?.type?.startsWith("pve-");
        const hasIdentities = server?.identities && server.identities.length > 0;
        if (!server || !(isPveEntry || hasIdentities)) return null;

        const identityId = Number(params.get("identityId"));
        const scriptId = Number(params.get("scriptId"));
        return {
            server,
            identity: isPveEntry ? null : { id: server.identities.includes(identityId) ? identityId : server.identities[0] },
            options: scriptId && !isPveEntry ? { scriptId } : {},
            requiresReason: checkConnectionReasonRequired(server.id, servers),
        };
    };

    const autoConnect = servers ? new URLSearchParams(location.search) : null;
    const autoConnectKey = autoConnect?.get("connectId") ? autoConnect.toString() : null;
    const [handledAutoConnectKey, setHandledAutoConnectKey] = useState(null);
    if (autoConnectKey !== handledAutoConnectKey) {
        setHandledAutoConnectKey(autoConnectKey);
        const target = autoConnectKey ? getAutoConnectTarget(autoConnect) : null;
        if (target?.requiresReason) {
            setPendingConnection({ server: target.server, identity: target.identity, options: target.options });
            setConnectionReasonDialogOpen(true);
        }
    }

    const connectFromUrl = useEffectEvent((key) => {
        const target = getAutoConnectTarget(new URLSearchParams(key));
        if (target && !target.requiresReason) performConnection(target.server, target.identity, target.options);
    });

    useEffect(() => {
        if (!autoConnectKey) return;
        navigate("/servers", { replace: true });
        connectFromUrl(autoConnectKey);
    }, [autoConnectKey, navigate]);

    return (
        <div className="server-page">
            <ServerDialog open={serverDialogOpen} onClose={closeDialog} currentFolderId={currentFolderId}
                          currentOrganizationId={currentOrganizationId} editServerId={editServerId}
                          initialProtocol={serverDialogProtocol} />
            <IntegrationDialog open={integrationDialogOpen} onClose={closePVEDialog}
                           currentFolderId={currentFolderId}
                           currentOrganizationId={currentOrganizationId}
                           initialType={integrationDialogType}
                           editServerId={editServerId} />
            <SSHConfigImportDialog open={sshConfigImportDialogOpen} onClose={closeSSHConfigImportDialog}
                                   currentFolderId={currentFolderId} />
            <DirectConnectDialog
                open={directConnectDialogOpen}
                onClose={closeDirectConnectDialog}
                server={directConnectServer}
                onConnect={handleDirectConnect}
            />
            <ConnectionReasonDialog
                isOpen={connectionReasonDialogOpen}
                onClose={handleConnectionReasonCanceled}
                onConnect={handleConnectionReasonProvided}
                serverName={pendingConnection?.server?.name}
            />
            {leftPaneSlot && createPortal(
                <ServerList setServerDialogOpen={(protocol = null) => {
                    setServerDialogProtocol(protocol);
                    setServerDialogOpen(true);
                }}
                            connectToServer={connectToServer}
                            setIntegrationDialogOpen={(type = "proxmox") => {
                                setIntegrationDialogType(type);
                                setIntegrationDialogOpen(true);
                            }}
                            setSSHConfigImportDialogOpen={() => setSSHConfigImportDialogOpen(true)}
                            setCurrentFolderId={setCurrentFolderId} setCurrentOrganizationId={setCurrentOrganizationId}
                            setEditServerId={setEditServerId} openSFTP={openSFTP}
                            hibernatedSessions={hibernatedSessions} resumeSession={resumeConnection}
                            openDirectConnect={openDirectConnect} runScript={runScript}
                            mobileOpen={mobileServerListOpen} setMobileOpen={setMobileServerListOpen} />,
                leftPaneSlot
            )}
            {visibleSessions.length === 0 && 
                <WelcomePanel 
                    connectToServer={connectToServer} 
                    hibernatedSessions={hibernatedSessions} 
                    resumeSession={resumeConnection}
                    openSFTP={openSFTP}
                    openDirectConnect={openDirectConnect}
                    onAddServer={() => {
                        setCurrentFolderId(null); setCurrentOrganizationId(null); setEditServerId(null);
                        setServerDialogProtocol(null); setServerDialogOpen(true);
                    }}
                    onAddNetbox={() => {
                        setCurrentFolderId(null); setCurrentOrganizationId(null); setEditServerId(null);
                        setIntegrationDialogType("netbox"); setIntegrationDialogOpen(true);
                    }}
                />
            }
            {visibleSessions.length > 0 &&
                <ViewContainer activeSessions={visibleSessions} disconnectFromServer={disconnectFromServer}
                               closeSession={closeSession}
                               activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId}
                               hibernateSession={hibernateSession} duplicateSession={duplicateSession}
                               setOpenFileEditors={setFloatingWindows}
                               openFileManagerFromTab={openFileManagerFromTab}
                               openTerminalFromFileManager={openTerminalFromFileManager} />}
            {/* portal to <body> because open dialogs make the app root inert */}
            {createPortal(<div data-floating-windows hidden={hidden}>
                {floatingWindows.map((floatingWindow, index) => {
                    const { id, type, session, file } = floatingWindow;
                    const windowProps = {
                        session, cascade: index,
                        zIndex: LAYERS.window + stackedWindowIds.indexOf(id),
                        onActivate: () => raiseWindow(id),
                        onClose: () => closeWindow(id),
                    };
                    if (type === "fileManager") return <FileManagerWindow key={id} {...windowProps} setOpenFileEditors={setFloatingWindows}
                        onOpenTerminal={path => openTerminalFromFileManager(session.id, path)} />;
                    return type === "preview"
                        ? <FilePreviewWindow key={id} file={file} {...windowProps} />
                        : <FileEditorWindow key={id} file={file} {...windowProps} />;
                })}
            </div>, document.body)}
        </div>
    );
};
