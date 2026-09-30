import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import { mdiAlertCircleOutline, mdiClose, mdiContentCopy } from "@mdi/js";
import Icon from "@mdi/react";
import "./MessageBoxDialog.sass";
import { useTranslation } from "react-i18next";
import { useCopyToClipboard } from "@/common/hooks/useCopyToClipboard.js";

const MessageBoxDialog = ({ open, onClose, messageData }) => {
    const { t } = useTranslation();
    const copyToClipboard = useCopyToClipboard();

    if (!messageData) return null;

    const renderMessage = (message) => {
        const processedMessage = message.replace(/\\n/g, "\n");
        return processedMessage.split("\n").map((line, index, array) => (
            <span key={index}>
                {line}
                {index < array.length - 1 && <br />}
            </span>
        ));
    };

    const copyMessage = () => {
        const fullText = `${messageData.title}\n${"=".repeat(messageData.title.length)}\n\n${messageData.message}`;
        copyToClipboard(fullText);
    };

    return (
        <DialogProvider open={open} onClose={onClose} maxWidth="500px">
            <div className="msgbox-dialog">
                <div className="dialog-title">
                    <Icon path={mdiAlertCircleOutline} />
                    <h2>{messageData.title}</h2>
                </div>

                <div className="msgbox-content">
                    <div className="message-text">
                        {renderMessage(messageData.message)}
                    </div>
                </div>

                <div className="dialog-actions">
                    <Button onClick={copyMessage} text={t("servers.scriptDialogs.copyMessage")} icon={mdiContentCopy} type="secondary" />
                    <Button onClick={onClose} text={t("common.actions.close")} icon={mdiClose} />
                </div>
            </div>
        </DialogProvider>
    );
};

export default MessageBoxDialog;
