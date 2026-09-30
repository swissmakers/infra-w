import { useTranslation } from "react-i18next";
import { mdiFolderOpen } from "@mdi/js";
import FloatingWindow from "@/common/components/FloatingWindow";
import FileRenderer from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer";

const INITIAL_SIZE = { width: 1180, height: 760 };

export const FileManagerWindow = ({ session, zIndex, cascade, onActivate, onClose, setOpenFileEditors, onOpenTerminal }) => {
    const { t } = useTranslation();
    return (
        <FloatingWindow className="file-manager-window" icon={mdiFolderOpen} initialSize={INITIAL_SIZE}
            title={`${t("servers.tabs.contextMenu.openFileManager")} - ${session.server.name}`}
            zIndex={zIndex} cascade={cascade} onActivate={onActivate} onClose={onClose}>
            <FileRenderer session={session} disconnectFromServer={onClose} setOpenFileEditors={setOpenFileEditors}
                isActive onOpenTerminal={onOpenTerminal} />
        </FloatingWindow>
    );
};

export default FileManagerWindow;
