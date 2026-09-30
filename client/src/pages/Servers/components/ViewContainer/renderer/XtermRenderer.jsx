import { useEffect, useEffectEvent, useRef, useState, useContext } from "react";
import { Terminal as Xterm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenu } from "@/common/components/ContextMenu";
import SnippetsMenu from "./components/SnippetsMenu";
import { createProgressParser } from "../utils/progressParser";
import { mdiContentCopy, mdiContentPaste, mdiCodeBrackets, mdiSelectAll, mdiDelete, mdiKeyboard, mdiKey } from "@mdi/js";
import { useTranslation } from "react-i18next";
import ConnectionLoader from "./components/ConnectionLoader";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";
import { postRequest } from "@/common/utils/RequestUtil.js";
import { copyText } from "@/common/utils/clipboard.js";
import { isConnectionFailureReported } from "@/common/utils/connectionFailures.js";
import "@xterm/xterm/css/xterm.css";
import "./styles/xterm.sass";
import { UserContext, IdentityContext, useKeymaps, usePreferences, useToast } from "@/common/contexts";
import { matchesKeybind } from "@/common/utils/keybinds.js";

const CONNECTION_FAILED_CODES = [4005, 4007, 4014];

const XtermRenderer = ({ session, disconnectFromServer, registerTerminalRef, broadcastMode, terminalRefs, updateProgress, layoutMode, onBroadcastToggle, onFullscreenToggle, isShared = false }) => {
    const ref = useRef(null);
    const termRef = useRef(null);
    const wsRef = useRef(null);
    const broadcastModeRef = useRef(broadcastMode);
    const progressParserRef = useRef(null);
    const terminalBufferRef = useRef([]);
    const layoutModeRef = useRef(layoutMode);
    const onBroadcastToggleRef = useRef(onBroadcastToggle);
    const onFullscreenToggleRef = useRef(onFullscreenToggle);
    const connectionLoaderRef = useRef(null);

    const userContext = useContext(UserContext);
    const sessionToken = userContext?.sessionToken;
    const { getCurrentTheme, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme } = usePreferences();
    const { getParsedKeybind } = useKeymaps();
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const contextMenu = useContextMenu();
    const { identities } = useContext(IdentityContext);
    const [showSnippetsMenu, setShowSnippetsMenu] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);

    useEffect(() => {
        broadcastModeRef.current = broadcastMode;
    }, [broadcastMode]);

    useEffect(() => {
        layoutModeRef.current = layoutMode;
    }, [layoutMode]);

    useEffect(() => {
        onBroadcastToggleRef.current = onBroadcastToggle;
    }, [onBroadcastToggle]);

    useEffect(() => {
        onFullscreenToggleRef.current = onFullscreenToggle;
    }, [onFullscreenToggle]);

    useEffect(() => {
        if (updateProgress) {
            progressParserRef.current = createProgressParser();

            return () => {
                if (progressParserRef.current) {
                    progressParserRef.current.destroy();
                    updateProgress(session.id, 0);
                }
            };
        }
    }, [session.id, updateProgress]);

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setHasSelection(!!termRef.current?.getSelection());
        contextMenu.open(e, { x: e.clientX, y: e.clientY });
    };

    const handleCopy = () => {
        const selection = termRef.current?.getSelection();
        if (selection) copyText(selection).catch(() => {});
        contextMenu.close();
        termRef.current?.focus();
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) termRef.current?.paste(text);
        } catch (err) {
            console.error('Failed to paste:', err);
        }
        contextMenu.close();
        termRef.current?.focus();
    };

    const handlePasteIdentity = async () => {
        try {
            await postRequest(`connections/${session.id}/paste-password`);
        } catch (err) {
            console.error('Failed to paste identity password via API:', err);
        }
        contextMenu.close();
        termRef.current?.focus();
    };

    const handleSelectAll = () => {
        termRef.current?.selectAll();
        contextMenu.close();
        termRef.current?.focus();
    };

    const handleClearTerminal = () => {
        termRef.current?.clear();
        contextMenu.close();
        termRef.current?.focus();
    };

    const handleInsertSnippet = () => {
        contextMenu.close();
        setShowSnippetsMenu(true);
    };

    const handleSnippetSelect = (command) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(command + '\r');
        }
        setShowSnippetsMenu(false);
        termRef.current?.focus();
    };

    const handleSendCtrlC = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send('\x03');
        }
        contextMenu.close();
        termRef.current?.focus();
    };

    const createTerminal = useEffectEvent(({ selectedFont, fontSize, cursorStyle, cursorBlink }) => {
        let isCleaningUp = false;
        const container = ref.current;

        const term = new Xterm({
            cursorBlink: cursorBlink,
            cursorStyle: cursorStyle,
            fontSize: fontSize,
            fontFamily: selectedFont,
            theme: getCurrentTheme(),
        });

        termRef.current = term;

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(container);

        const handleResize = () => {
            if (!ref.current?.clientWidth || !ref.current?.clientHeight) return;
            fitAddon.fit();
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(`\x01${term.cols},${term.rows}`);
            }
        };

        window.addEventListener("resize", handleResize);

        const handleNativePaste = (e) => {
            const text = e.clipboardData?.getData('text');
            if (text) {
                e.preventDefault();
                term.paste(text);
            }
        };
        container?.addEventListener('paste', handleNativePaste);

        let ws;

        const wsParams = isShared 
            ? { shareId: session.shareId || session.id.split('/').pop() }
            : { sessionToken, sessionId: session.id };

        const wsUrl = getWebSocketUrl("/api/ws/term", wsParams);

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        if (registerTerminalRef) {
            registerTerminalRef(session.id, { term, ws });
        }

        let interval = setInterval(() => {
            if (ws.readyState === ws.OPEN) handleResize();
        }, 300);

        ws.onopen = () => {
            ws.send(`\x01${term.cols},${term.rows}`);
        }

        ws.onclose = (event) => {
            clearInterval(interval);
            if (!isCleaningUp) {
                // the state stream has usually reported the failure already
                if (CONNECTION_FAILED_CODES.includes(event.code) && !isConnectionFailureReported(session.id)) sendToast("Error", t("servers.messages.connectionFailed"));
                disconnectFromServer(session.id);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (!isCleaningUp) {
                disconnectFromServer(session.id);
            }
        };

        ws.onmessage = (event) => {
            const data = event.data;

            connectionLoaderRef.current?.hide();

            term.write(data);
            terminalBufferRef.current.push(data);
            if (terminalBufferRef.current.length > 50) terminalBufferRef.current.shift();

            if (progressParserRef.current && updateProgress) {
                const progress = progressParserRef.current.parseData(data);
                if (progress !== null) {
                    updateProgress(session.id, progress);
                } else if (!progressParserRef.current.isTrackingProgress()) {
                    const currentProgress = progressParserRef.current.getProgress();
                    if (currentProgress === 0) {
                        updateProgress(session.id, 0);
                    }
                }
            }
        };

        term.onData((data) => {
            ws.send(data);

            if (broadcastModeRef.current && terminalRefs?.current) {
                Object.entries(terminalRefs.current).forEach(([sessionId, refs]) => {
                    if (sessionId !== session.id && refs.ws && refs.ws.readyState === WebSocket.OPEN) {
                        refs.ws.send(data);
                    }
                });
            }
        });

        term.attachCustomKeyEventHandler((event) => {
            if (event.type === "keydown") {
                const copyKeybind = getParsedKeybind("copy");
                if (copyKeybind && matchesKeybind(event, copyKeybind)) {
                    const selection = term.getSelection();
                    if (selection) {
                        event.preventDefault();
                        event.stopPropagation();
                        copyText(selection).catch(() => {});
                        return false;
                    }
                }

                const snippetsKeybind = getParsedKeybind("snippets");
                if (snippetsKeybind && matchesKeybind(event, snippetsKeybind)) {
                    event.preventDefault();
                    event.stopPropagation();
                    window.dispatchEvent(new CustomEvent('terminal-snippets-shortcut'));
                    return false;
                }

                const keyboardShortcutsKeybind = getParsedKeybind("keyboard-shortcuts");
                if (keyboardShortcutsKeybind && matchesKeybind(event, keyboardShortcutsKeybind)) {
                    event.preventDefault();
                    event.stopPropagation();
                    window.dispatchEvent(new CustomEvent('terminal-keyboard-shortcuts-shortcut'));
                    return false;
                }

                const currentLayoutMode = layoutModeRef.current;
                const currentOnBroadcastToggle = onBroadcastToggleRef.current;
                if (currentLayoutMode !== "single" && currentOnBroadcastToggle) {
                    const broadcastKeybind = getParsedKeybind("broadcast");
                    if (broadcastKeybind && matchesKeybind(event, broadcastKeybind)) {
                        event.preventDefault();
                        event.stopPropagation();
                        currentOnBroadcastToggle();
                        return false;
                    }
                }

                const currentOnFullscreenToggle = onFullscreenToggleRef.current;
                if (currentOnFullscreenToggle) {
                    const fullscreenKeybind = getParsedKeybind("fullscreen");
                    if (fullscreenKeybind && matchesKeybind(event, fullscreenKeybind)) {
                        event.preventDefault();
                        event.stopPropagation();
                        currentOnFullscreenToggle();
                        return false;
                    }
                }
            }
            return true;
        });

        return () => {
            isCleaningUp = true;
            if (registerTerminalRef) {
                registerTerminalRef(session.id, null);
            }
            window.removeEventListener("resize", handleResize);
            container?.removeEventListener('paste', handleNativePaste);
            if (ws) {
                ws.onclose = null;
                ws.onerror = null;
                ws.close();
            }
            term.dispose();
            clearInterval(interval);
            termRef.current = null;
            wsRef.current = null;
        };
    });

    useEffect(() => {
        if (!sessionToken && !isShared) return;
        // selectedTheme is read inside createTerminal but still has to recreate the terminal
        return createTerminal({ selectedFont, fontSize, cursorStyle, cursorBlink });
    }, [sessionToken, selectedFont, fontSize, cursorStyle, cursorBlink, selectedTheme, isShared]);

    return (
        <div className="xterm-container" onContextMenu={!isShared ? handleContextMenu : undefined}>
            <ConnectionLoader onReady={(loader) => { connectionLoaderRef.current = loader; }} />
            <div ref={ref} className="xterm-wrapper" />
            {!isShared && (
                <ContextMenu
                    isOpen={contextMenu.isOpen}
                    position={contextMenu.position}
                    onClose={contextMenu.close}
                    trigger={contextMenu.triggerRef}
                >
                    <ContextMenuItem
                        icon={mdiContentCopy}
                        label={t('servers.fileManager.contextMenu.copy')}
                        onClick={handleCopy}
                        disabled={!hasSelection}
                    />
                    <ContextMenuItem
                        icon={mdiContentPaste}
                        label={t('servers.fileManager.contextMenu.paste')}
                        onClick={handlePaste}
                    />
                    <ContextMenuItem
                        icon={mdiSelectAll}
                        label={t('servers.fileManager.contextMenu.selectAll')}
                        onClick={handleSelectAll}
                    />
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        icon={mdiCodeBrackets}
                        label={t('servers.fileManager.contextMenu.insertSnippet')}
                        onClick={handleInsertSnippet}
                    />
                    {(identities && session.identity && identities.find(i => i.id === session.identity) && ['password','both','password-only'].includes(identities.find(i => i.id === session.identity).type)) && (
                        <ContextMenuItem
                            icon={mdiKey}
                            label={t('servers.contextMenu.pasteIdentityPassword')}
                            onClick={handlePasteIdentity}
                        />
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        icon={mdiKeyboard}
                        label={t('servers.fileManager.contextMenu.sendCtrlC')}
                        onClick={handleSendCtrlC}
                    />
                    <ContextMenuItem
                        icon={mdiDelete}
                        label={t('servers.fileManager.contextMenu.clearTerminal')}
                        onClick={handleClearTerminal}
                    />
                </ContextMenu>
            )}
            {!isShared && (
                <SnippetsMenu
                    visible={showSnippetsMenu}
                    onSelect={handleSnippetSelect}
                    onClose={() => setShowSnippetsMenu(false)}
                    activeSession={session}
                />
            )}
        </div>
    );
};

export default XtermRenderer;
