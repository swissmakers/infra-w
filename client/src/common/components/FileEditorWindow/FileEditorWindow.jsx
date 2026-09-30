import { useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadRequest, sftpUrl, uploadFile } from "@/common/utils/RequestUtil.js";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import Button from "@/common/components/Button";
import FloatingWindow from "@/common/components/FloatingWindow";
import Editor from "@monaco-editor/react";
import { mdiContentSave, mdiTextBox } from "@mdi/js";
import "./styles.sass";
import "@/common/monaco/setup.js";
import { usePreferences, useToast } from "@/common/contexts";

const normalizeFilename = (filename) => filename?.toLowerCase() || "";

const getMonacoLanguage = (filename) => {
    const name = normalizeFilename(filename);
    if (!name) return "plaintext";

    const basename = name.split("/").pop() || "";

    const exactNameMap = {
        "dockerfile": "dockerfile",
        "makefile": "makefile",
        ".env": "ini",
    };

    if (exactNameMap[basename]) return exactNameMap[basename];

    const extension = basename.includes(".") ? basename.split(".").pop() : "";

    const extensionMap = {
        js: "javascript",
        mjs: "javascript",
        cjs: "javascript",
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
        json: "json",
        html: "html",
        htm: "html",
        css: "css",
        scss: "scss",
        sass: "scss",
        less: "less",
        md: "markdown",
        markdown: "markdown",
        yml: "yaml",
        yaml: "yaml",
        xml: "xml",
        sh: "shell",
        bash: "shell",
        zsh: "shell",
        py: "python",
        go: "go",
        java: "java",
        c: "c",
        h: "c",
        cpp: "cpp",
        cc: "cpp",
        cxx: "cpp",
        hpp: "cpp",
        hxx: "cpp",
        cs: "csharp",
        php: "php",
        rb: "ruby",
        rs: "rust",
        swift: "swift",
        kt: "kotlin",
        kts: "kotlin",
        sql: "sql",
        gql: "graphql",
        graphql: "graphql",
        toml: "toml",
        ini: "ini",
        conf: "ini",
        env: "ini",
        txt: "plaintext",
    };

    return extensionMap[extension] || "plaintext";
};

export const FileEditorWindow = ({ file, session, onClose, zIndex, cascade, onActivate }) => {
    const { t } = useTranslation();
    const { theme } = usePreferences();
    const { sendToast, showError } = useToast();
    const [fileContent, setFileContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [fileContentChanged, setFileContentChanged] = useState(false);
    const [unsavedChangesDialog, setUnsavedChangesDialog] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileUrl = (action = "") => sftpUrl(session.id, { action, path: file });

    // once per window, a token refresh must not replace unsaved edits
    const loadFile = useEffectEvent(() => downloadRequest(fileUrl()));
    // close rather than offer an empty buffer for saving over the remote file
    const handleLoadFailure = useEffectEvent(() => {
        sendToast("Error", t("servers.fileManager.fileEditor.loadFailed"));
        onClose();
    });

    useEffect(() => {
        let current = true;
        loadFile().then(blob => blob.text()).then(text => {
            if (!current) return;
            setFileContent(text);
            setIsLoading(false);
        }).catch(() => {
            if (current) handleLoadFailure();
        });
        return () => { current = false; };
    }, []);

    const saveFile = async () => {
        setSaving(true);
        try {
            await uploadFile(fileUrl("/upload"), new Blob([fileContent], { type: "application/octet-stream" }));
            setFileContentChanged(false);
            sendToast("Success", t("servers.fileManager.fileEditor.saveSuccess"));
        } catch (err) {
            showError(err, t("servers.fileManager.fileEditor.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const closeFile = () => fileContentChanged ? setUnsavedChangesDialog(true) : onClose();

    const updateContent = (value) => {
        setFileContentChanged(true);
        setFileContent(value);
    };

    return (
        <FloatingWindow className="file-editor-window" icon={mdiTextBox} title={file.split("/").pop()}
            zIndex={zIndex} cascade={cascade} onActivate={onActivate} onClose={closeFile}
            status={fileContentChanged && <span className="modified-indicator">{t("servers.fileManager.fileEditor.unsaved")}</span>}
            actions={<Button icon={mdiContentSave} onClick={saveFile} disabled={!fileContentChanged} busy={saving}
                title={t("common.save")} aria-label={t("common.save")} />}>
            <ActionConfirmDialog text={t("servers.fileManager.fileEditor.unsavedChanges")} onConfirm={onClose}
                open={unsavedChangesDialog} setOpen={setUnsavedChangesDialog} zIndex={zIndex + 100} />
            {isLoading ? (
                <div className="file-editor-loading" role="status">{t("servers.fileManager.fileEditor.loading")}</div>
            ) : (
                <Editor
                    value={fileContent}
                    onChange={updateContent}
                    language={getMonacoLanguage(file)}
                    theme={theme === "dark" || theme === "oled" ? "vs-dark" : "vs-light"}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        wordWrap: "off",
                        tabSize: 4,
                        insertSpaces: true,
                    }}
                />
            )}
        </FloatingWindow>
    );
};
