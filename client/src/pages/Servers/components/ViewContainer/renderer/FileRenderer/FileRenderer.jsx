import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useWebSocket } from "@/common/hooks/useWebSocket.js";
import ActionBar from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/ActionBar";
import FileList from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/components/FileList";
import "./styles.sass";
import Icon from "@mdi/react";
import { mdiCloudUpload } from "@mdi/js";
import { getWebSocketUrl } from "@/common/utils/ConnectionUtil.js";
import { uploadFile as uploadFileRequest, sftpUrl, triggerDownload } from "@/common/utils/RequestUtil.js";
import { UserContext, usePreferences, useToast } from "@/common/contexts";
import { OPERATIONS, MAX_EDIT_SIZE, isPreviewable } from "./components/FileList/utils/fileUtils";

// i18next escapes "/" in interpolations, paths must show literally
const i18nUnescapedInterpolation = { interpolation: { escapeValue: false } };

const readAllDirectoryEntries = (reader) => new Promise((resolve, reject) => {
    const out = [];
    const readBatch = () => {
        try {
            reader.readEntries((entries) => {
                if (!entries || entries.length === 0) return resolve(out);
                out.push(...entries);
                readBatch();
            }, reject);
        } catch (e) {
            reject(e);
        }
    };
    readBatch();
});

const walkFileSystemEntry = async (entry, pathPrefix) => {
    if (!entry) return [];
    if (entry.isFile) {
        const file = await new Promise((res, rej) => entry.file(res, rej));
        const rel = `${pathPrefix}${file.name}`.replace(/^\/+/, "");
        return [{ file, relativePath: rel }];
    }
    if (entry.isDirectory) {
        const reader = entry.createReader();
        const children = await readAllDirectoryEntries(reader);
        const dirPrefix = `${pathPrefix}${entry.name}/`;
        const acc = [];
        for (const child of children) {
            acc.push(...await walkFileSystemEntry(child, dirPrefix));
        }
        return acc;
    }
    return [];
};

const collectDroppedFiles = async (dataTransfer) => {
    const out = [];
    const seen = new Set();
    const add = (file, relativePath) => {
        const rp = String(relativePath || "").replace(/^\/+/, "").split("/").filter(Boolean).join("/");
        if (!rp || !file) return;
        const key = `${rp}\0${file.size}\0${file.lastModified}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ file, relativePath: rp });
    };

    // the live FileList is emptied once the handler yields, so copy it before any await
    const filesSnapshot = dataTransfer.files?.length ? Array.from(dataTransfer.files) : [];

    const items = dataTransfer.items ? [...dataTransfer.items] : [];

    for (const item of items) {
        if (item.kind !== "file") continue;
        const getAsEntry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry.bind(item) : null;
        const entry = getAsEntry ? getAsEntry() : null;
        if (entry) {
            const walked = await walkFileSystemEntry(entry, "");
            for (const w of walked) add(w.file, w.relativePath);
            continue;
        }
        const file = item.getAsFile();
        if (file) add(file, file.webkitRelativePath || file.name);
    }

    for (let i = 0; i < filesSnapshot.length; i++) {
        const file = filesSnapshot[i];
        add(file, file.webkitRelativePath || file.name);
    }

    return out;
};

export const FileRenderer = ({ session, disconnectFromServer, setOpenFileEditors, isActive, onOpenTerminal }) => {
    const { t } = useTranslation();
    const { sessionToken } = useContext(UserContext);
    const { defaultViewMode } = usePreferences();
    const { sendToast, showError } = useToast();

    const [dragging, setDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [directory, setDirectory] = useState("/");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState(["/"]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [viewMode, setViewMode] = useState(defaultViewMode);
    const [directorySuggestions, setDirectorySuggestions] = useState([]);
    const [connectionError, setConnectionError] = useState(null);
    const [isReady, setIsReady] = useState(false);

    const pathCallbacks = useRef([]);
    const dropZoneRef = useRef(null);
    const uploadQueueRef = useRef([]);
    const reconnectAttemptsRef = useRef(0);
    const fileListRef = useRef(null);
    const propertiesHandlerRef = useRef(null);
    const lastSuccessfulDirectoryRef = useRef("/");
    const pendingNavigationRef = useRef(null);
    const hasAppliedInitialPathRef = useRef(false);

    const wsUrl = getWebSocketUrl("/api/ws/sftp", { sessionToken, sessionId: session.id });

    useEffect(() => {
        hasAppliedInitialPathRef.current = false;
    }, [session.id]);

    const downloadFile = (path) => triggerDownload(sftpUrl(session.id, { path }), path.split("/").pop());

    const downloadMultipleFiles = async (paths) => {
        if (!paths?.length) return;
        const url = sftpUrl(session.id, { action: "/multi" });
        const defaultFileName = paths.length === 1 ? `${paths[0].split("/").pop()}.zip` : "files.zip";

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paths }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || t("common.requestErrors.status", { status: response.status }));
            }

            const blob = await response.blob();
            const disposition = response.headers.get("content-disposition") || "";
            const nameMatch = disposition.match(/filename="([^"]+)"/i);
            const fileName = nameMatch?.[1] || defaultFileName;

            const blobUrl = window.URL.createObjectURL(blob);
            triggerDownload(blobUrl, fileName);
            window.URL.revokeObjectURL(blobUrl);

            sendToast("Success", t("servers.fileManager.toast.downloadingItems", { count: paths.length }));
        } catch (e) {
            showError(e, t("servers.fileManager.toast.error"));
        }
    };

    const uploadFileHttp = async (file, targetDir, relativePath) => {
        const rel = (relativePath || file.name || "").split("/").filter(Boolean).join("/");
        if (!rel) {
            sendToast("Error", t("servers.fileManager.toast.uploadFailed", { message: t("servers.fileManager.toast.missingPath"), ...i18nUnescapedInterpolation }));
            return false;
        }
        const filePath = `${targetDir.replace(/\/+$/, "")}/${rel}`.replace(/\/+/g, "/");
        const label = rel.includes("/") ? rel : file.name;
        setIsUploading(true);
        setUploadProgress(0);

        try {
            const url = sftpUrl(session.id, { action: "/upload", path: filePath });
            await uploadFileRequest(url, file, {
                onProgress: setUploadProgress,
                timeout: 5 * 60 * 1000,
            });

            setIsUploading(false);
            setUploadProgress(0);
            listFiles();
            sendToast("Success", t("servers.fileManager.toast.uploaded", { name: label, ...i18nUnescapedInterpolation }));
            return true;
        } catch (err) {
            console.error("Upload error:", err);
            sendToast("Error", t("servers.fileManager.toast.uploadFailed", { message: err.message, ...i18nUnescapedInterpolation }));
            setIsUploading(false);
            setUploadProgress(0);
            return false;
        }
    };

    const processUploadQueue = async () => {
        while (uploadQueueRef.current.length > 0) {
            const { file, targetDir, relativePath } = uploadQueueRef.current[0];
            await uploadFileHttp(file, targetDir, relativePath);
            uploadQueueRef.current.shift();
        }
    };

    const queueUpload = (file, targetDir, relativePath) => {
        uploadQueueRef.current.push({
            file,
            targetDir,
            relativePath: relativePath != null ? relativePath : file.name,
        });
        if (uploadQueueRef.current.length === 1) processUploadQueue();
    };

    const uploadFile = async () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = true;
        fileInput.onchange = async () => {
            for (const file of fileInput.files) queueUpload(file, directory);
        };
        fileInput.click();
    };

    const processMessage = async (event) => {
        try {
            const data = await event.data.text();
            const operation = data.charCodeAt(0);
            let payload;
            try { payload = JSON.parse(data.slice(1)); } catch {}

            switch (operation) {
                case OPERATIONS.READY:
                    setIsReady(true);
                    setConnectionError(null);
                    reconnectAttemptsRef.current = 0;
                    if (payload?.initialPath && !hasAppliedInitialPathRef.current) {
                        hasAppliedInitialPathRef.current = true;
                        setDirectory(payload.initialPath);
                        setHistory([payload.initialPath]);
                        setHistoryIndex(0);
                        lastSuccessfulDirectoryRef.current = payload.initialPath;
                    }
                    break;
                case OPERATIONS.LIST_FILES:
                    if (payload?.files) {
                        setItems(payload.files);
                        setError(null);
                        lastSuccessfulDirectoryRef.current = directory;
                        pendingNavigationRef.current = null;
                    } else {
                        setError(t("servers.fileManager.states.loadFailed"));
                        setItems([]);
                    }
                    setLoading(false);
                    break;
                case OPERATIONS.CREATE_FILE:
                case OPERATIONS.CREATE_FOLDER:
                case OPERATIONS.DELETE_FILE:
                case OPERATIONS.DELETE_FOLDER:
                case OPERATIONS.RENAME_FILE:
                case OPERATIONS.MOVE_FILES:
                case OPERATIONS.COPY_FILES:
                case OPERATIONS.CHMOD:
                    listFiles();
                    break;
                case OPERATIONS.ERROR:
                    showError(payload, t("servers.fileManager.toast.error"));
                    if (payload?.operation === OPERATIONS.RESOLVE_PATH) pathCallbacks.current.shift();
                    if (pendingNavigationRef.current?.to === directory) {
                        const pending = pendingNavigationRef.current;
                        setDirectory(pending.from);
                        setHistory(pending.history);
                        setHistoryIndex(pending.historyIndex);
                        pendingNavigationRef.current = null;
                    }
                    setLoading(false);
                    break;
                case OPERATIONS.SEARCH_DIRECTORIES:
                    if (payload?.directories) setDirectorySuggestions(payload.directories);
                    break;
                case OPERATIONS.RESOLVE_PATH:
                    if (payload) pathCallbacks.current.shift()?.(payload);
                    break;
                case OPERATIONS.STAT:
                case OPERATIONS.CHECKSUM:
                case OPERATIONS.FOLDER_SIZE:
                    propertiesHandlerRef.current?.({ operation, payload });
                    break;
            }
        } catch (err) { console.error("Error processing SFTP message:", err); }
    };

    const handleWsError = useCallback((event) => {
        console.error("SFTP WebSocket error:", event);
        setConnectionError(t("servers.fileManager.states.connectionError"));
        setIsReady(false);
        if (reconnectAttemptsRef.current >= 3) {
            sendToast("Error", t("servers.fileManager.toast.connectionLost"));
            disconnectFromServer(session.id);
        }
    }, [disconnectFromServer, session.id, sendToast, t]);

    const handleWsClose = useCallback(() => setIsReady(false), []);
    const handleWsOpen = useCallback(() => { reconnectAttemptsRef.current = 0; setConnectionError(null); }, []);

    const { sendMessage, readyState } = useWebSocket(wsUrl, {
        onError: handleWsError,
        onMessage: processMessage,
        onClose: handleWsClose,
        onOpen: handleWsOpen,
        shouldReconnect: (e) => e.code !== 1000 && e.code < 4000 && ++reconnectAttemptsRef.current <= 3,
        reconnectAttempts: 3,
        reconnectInterval: 2000,
    });

    const sendOperation = useCallback((operation, payload = {}) => {
        if (readyState !== 1) return false;
        try {
            const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
            const message = new Uint8Array(1 + payloadBytes.length);
            message[0] = operation;
            message.set(payloadBytes, 1);
            sendMessage(message);
            return true;
        } catch { return false; }
    }, [sendMessage, readyState]);

    const createFile = (fileName) => sendOperation(OPERATIONS.CREATE_FILE, { path: `${directory}/${fileName}` });
    const createFolder = (folderName) => sendOperation(OPERATIONS.CREATE_FOLDER, { path: `${directory}/${folderName}` });
    const listFiles = useCallback(() => { setLoading(true); setError(null); sendOperation(OPERATIONS.LIST_FILES, { path: directory }); }, [directory, sendOperation]);
    const moveFiles = useCallback((sources, destination) => sendOperation(OPERATIONS.MOVE_FILES, { sources, destination }), [sendOperation]);
    const copyFiles = useCallback((sources, destination) => sendOperation(OPERATIONS.COPY_FILES, { sources, destination }), [sendOperation]);

    const changeDirectory = (newDirectory) => {
        if (newDirectory === directory) return;
        const nextHistory = historyIndex === history.length - 1
            ? [...history, newDirectory]
            : [...history.slice(0, historyIndex + 1), newDirectory];
        const nextHistoryIndex = historyIndex + 1;
        pendingNavigationRef.current = {
            from: directory,
            to: newDirectory,
            history,
            historyIndex,
        };
        setHistory(nextHistory);
        setHistoryIndex(nextHistoryIndex);
        setDirectory(newDirectory);
    };

    const goBack = () => {
        if (historyIndex > 0) {
            pendingNavigationRef.current = {
                from: directory,
                to: history[historyIndex - 1],
                history,
                historyIndex,
            };
            setHistoryIndex(historyIndex - 1);
            setDirectory(history[historyIndex - 1]);
        }
    };
    const goForward = () => {
        if (historyIndex < history.length - 1) {
            pendingNavigationRef.current = {
                from: directory,
                to: history[historyIndex + 1],
                history,
                historyIndex,
            };
            setHistoryIndex(historyIndex + 1);
            setDirectory(history[historyIndex + 1]);
        }
    };

    const handleDrag = async (e) => {
        if (e.dataTransfer.types.includes("application/x-sftp-files")) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragover") setDragging(true);
        else if (e.type === "dragleave" && !dropZoneRef.current.contains(e.relatedTarget)) setDragging(false);
        else if (e.type === "drop") {
            setDragging(false);
            (async () => {
                try {
                    const entries = await collectDroppedFiles(e.dataTransfer);
                    if (!entries.length) {
                        sendToast("Error", t("servers.fileManager.toast.error"));
                        return;
                    }
                    for (const { file, relativePath } of entries) {
                        queueUpload(file, directory, relativePath);
                    }
                } catch (err) {
                    console.error("Drop handling error:", err);
                    sendToast("Error", t("servers.fileManager.toast.uploadFailed", { message: err.message || String(err), ...i18nUnescapedInterpolation }));
                }
            })();
        }
    };

    const searchDirectories = (searchPath) => sendOperation(OPERATIONS.SEARCH_DIRECTORIES, { searchPath });
    const openPath = (path, { revealFile = false } = {}) => {
        pathCallbacks.current.push(({ path: realPath, isDirectory, size }) => {
            if (isDirectory) return changeDirectory(realPath);
            if (revealFile) changeDirectory(realPath.slice(0, realPath.lastIndexOf("/")) || "/");
            if (isPreviewable(realPath)) handleOpenPreview(realPath);
            else if (size < MAX_EDIT_SIZE) handleOpenFile(realPath);
            else downloadFile(realPath);
        });
        sendOperation(OPERATIONS.RESOLVE_PATH, { path });
    };

    const handleOpenFile = (filePath) => setOpenFileEditors(prev => [...prev, { id: `${session.id}-${filePath}-${Date.now()}`, file: filePath, session, type: 'editor' }]);
    const handleOpenPreview = (filePath) => setOpenFileEditors(prev => [...prev, { id: `${session.id}-${filePath}-${Date.now()}`, file: filePath, session, type: 'preview' }]);

    useEffect(() => { if (isReady) listFiles(); }, [directory, isReady, listFiles]);

    return (
        <div className="file-renderer" ref={dropZoneRef} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrag}>
            <div className={`drag-overlay ${dragging ? "active" : ""}`}>
                <div className="drag-item">
                    <Icon path={mdiCloudUpload} />
                    <h2>{t("servers.fileManager.states.dropToUpload")}</h2>
                </div>
            </div>
            <div className="file-manager">
                <ActionBar path={directory} updatePath={changeDirectory} openPath={path => openPath(path, { revealFile: true })} createFile={() => fileListRef.current?.startCreateFile()}
                    createFolder={() => fileListRef.current?.startCreateFolder()} uploadFile={uploadFile} goBack={goBack} goForward={goForward} historyIndex={historyIndex}
                    historyLength={history.length} viewMode={viewMode} setViewMode={setViewMode} 
                    searchDirectories={searchDirectories} directorySuggestions={directorySuggestions} 
                    setDirectorySuggestions={setDirectorySuggestions} moveFiles={moveFiles} copyFiles={copyFiles} 
                    sessionId={session.id} />
                <FileList ref={fileListRef} items={items} path={directory} updatePath={changeDirectory} sendOperation={sendOperation}
                    downloadFile={downloadFile} downloadMultipleFiles={downloadMultipleFiles} setCurrentFile={handleOpenFile} setPreviewFile={handleOpenPreview} 
                    loading={loading} viewMode={viewMode} error={error || connectionError} openPath={openPath} session={session}
                    createFile={createFile} createFolder={createFolder} moveFiles={moveFiles} copyFiles={copyFiles} isActive={isActive}
                    onOpenTerminal={onOpenTerminal} onPropertiesMessage={(handler) => { propertiesHandlerRef.current = handler; }} />
            </div>
            {isUploading && <div className="upload-progress" style={{ width: `${uploadProgress}%` }} />}
        </div>
    );
};
