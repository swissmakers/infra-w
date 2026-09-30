import { sftpUrl, triggerDownload } from "@/common/utils/RequestUtil.js";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiFileDownload, mdiFileOutline, mdiFilePdfBox, mdiImage, mdiMusic, mdiVideo } from "@mdi/js";
import Button from "@/common/components/Button";
import FloatingWindow from "@/common/components/FloatingWindow";
import { getPreviewType } from "@/common/utils/filePreview.js";
import { ImagePreview } from "./ImagePreview.jsx";
import "./styles.sass";

const PREVIEW_ICONS = { image: mdiImage, video: mdiVideo, audio: mdiMusic, pdf: mdiFilePdfBox };

export const FilePreviewWindow = ({ file, session, onClose, zIndex, cascade, onActivate }) => {
    const { t } = useTranslation();

    const fileName = file.split("/").pop();
    const fileUrl = sftpUrl(session.id, { path: file, preview: true });
    const fileType = getPreviewType(file) || "unknown";

    const downloadFile = () => triggerDownload(fileUrl, fileName);

    const renderPreview = () => {
        switch (fileType) {
            case "video":
                return <video controls src={fileUrl}>{t("servers.fileManager.filePreview.videoNotSupported")}</video>;
            case "audio":
                return (
                    <>
                        <Icon path={mdiMusic} size={3} aria-hidden="true" />
                        <audio controls src={fileUrl}>{t("servers.fileManager.filePreview.audioNotSupported")}</audio>
                    </>
                );
            case "pdf":
                return <iframe src={fileUrl} title={fileName} />;
            default:
                return (
                    <>
                        <Icon path={mdiFileOutline} size={3} aria-hidden="true" />
                        <h3>{t("servers.fileManager.filePreview.cannotPreview")}</h3>
                    </>
                );
        }
    };

    return (
        <FloatingWindow className="file-preview-window" icon={PREVIEW_ICONS[fileType] || mdiFileOutline} title={fileName}
            zIndex={zIndex} cascade={cascade} onActivate={onActivate} onClose={onClose}
            actions={<Button icon={mdiFileDownload} onClick={downloadFile} title={t("common.download")} aria-label={t("common.download")} />}>
            {fileType === "image" ? <ImagePreview src={fileUrl} alt={fileName} />
                : <div className={`preview-content ${fileType}-preview`}>{renderPreview()}</div>}
        </FloatingWindow>
    );
};
