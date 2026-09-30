import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import Icon from "@mdi/react";
import { mdiDownload, mdiTrashCan, mdiLoading, mdiFileDocument, mdiVideo } from "@mdi/js";
import { getRequest, deleteRequest, downloadFile } from "@/common/utils/RequestUtil.js";
import { formatBytes, formatDate } from "@/common/utils/formatUtils.js";
import "./styles.sass";
import { useToast } from "@/common/contexts";

export const FileBrowserDialog = ({ open, onClose, type, onFilesChanged }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [listing, setListing] = useState({ open: false, type: null });

    if (listing.open !== open || listing.type !== type) {
        setListing({ open, type });
        if (open) {
            setHasChanges(false);
            setLoading(true);
        }
    }

    useEffect(() => {
        if (!open) return;
        const loadFiles = async () => {
            try {
                const data = await getRequest(`backup/files/${type}`);
                setFiles(data);
            } catch {
                sendToast("Error", t("settings.backup.errors.loadFailed"));
            } finally {
                setLoading(false);
            }
        };
        loadFiles();
    }, [open, type, sendToast, t]);

    const handleDownload = (filename) => {
        downloadFile(`backup/export/${type}/${encodeURIComponent(filename)}`);
    };

    const [pendingDelete, setPendingDelete] = useState(null);

    const handleDelete = async (filename) => {
        setDeleting(filename);
        try {
            await deleteRequest(`backup/files/${type}/${encodeURIComponent(filename)}`);
            setFiles(prev => prev.filter(f => f.name !== filename));
            setHasChanges(true);
        } catch {
            sendToast("Error", t("settings.backup.errors.deleteFailed"));
        } finally {
            setDeleting(null);
        }
    };

    const handleClose = () => {
        if (hasChanges) onFilesChanged?.();
        onClose();
    };

    const icon = type === "recordings" ? mdiVideo : mdiFileDocument;
    const title = type === "recordings" ? t("settings.backup.storage.recordings") : t("settings.backup.storage.logs");

    return (
        <DialogProvider open={open} onClose={handleClose}>
            <div className="file-browser-dialog">
                <h2>{title}</h2>
                <div className="fb-list">
                    {loading ? <p className="fb-note" role="status">{t("settings.backup.loading")}</p>
                        : files.length === 0 ? <p className="fb-note">{t("settings.backup.noFiles")}</p>
                        : files.map(file => <div key={file.name} className="fb-item">
                            <Icon path={icon} size={0.75} />
                            <div className="fb-details">
                                <span className="fb-name">{file.name}</span>
                                <span className="fb-meta">{formatBytes(file.size)} · {formatDate(file.modified)}</span>
                            </div>
                            <Button icon={mdiDownload} onClick={() => handleDownload(file.name)}
                                title={t("common.actions.download")} aria-label={t("common.actions.download")} />
                            <Button icon={deleting === file.name ? mdiLoading : mdiTrashCan} onClick={() => setPendingDelete(file.name)}
                                disabled={deleting === file.name} title={t("common.actions.delete")} aria-label={t("common.actions.delete")} />
                        </div>)}
                </div>
                <div className="fb-dialog-actions">
                    <Button text={t("common.actions.close")} onClick={handleClose} type="secondary" />
                </div>
            </div>
            <ActionConfirmDialog open={pendingDelete !== null} setOpen={isOpen => !isOpen && setPendingDelete(null)}
                onConfirm={() => handleDelete(pendingDelete)} text={t("settings.backup.confirmDeleteFile", { name: pendingDelete })} />
        </DialogProvider>
    );
};
