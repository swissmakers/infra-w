import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import { mdiInformationOutline, mdiClose, mdiContentCopy, mdiFileDocumentOutline, mdiOpenInNew } from "@mdi/js";
import Icon from "@mdi/react";
import "./SummaryDialog.sass";
import { useTranslation } from "react-i18next";
import { useCopyToClipboard } from "@/common/hooks/useCopyToClipboard.js";

const SummaryDialog = ({ open, onClose, summaryData }) => {
    const { t } = useTranslation();
    const copyToClipboard = useCopyToClipboard();

    if (!summaryData) return null;

    const parseDataToKeyValue = (data) => {
        const pairs = [];
        for (let i = 0; i < data.length; i += 2) {
            if (data[i] && data[i + 1]) pairs.push({ key: data[i], value: data[i + 1] });
        }
        return pairs;
    };

    const keyValuePairs = parseDataToKeyValue(summaryData.data || []);

    // script output must not produce javascript: or other non-web links
    const isWebUrl = (text) => {
        try {
            return ["http:", "https:"].includes(new URL(text).protocol);
        } catch {
            return false;
        }
    };

    const copyAllSummary = () => {
        const summaryText = keyValuePairs
            .map(pair => `${pair.key}: ${pair.value}`)
            .join("\n");
        const fullText = `${summaryData.title}\n${"=".repeat(summaryData.title.length)}\n\n${summaryText}`;
        copyToClipboard(fullText);
    };

    return (
        <DialogProvider open={open} onClose={onClose} maxWidth="500px">
            <div className="summary-dialog">
                <div className="dialog-title">
                    <Icon path={mdiInformationOutline} />
                    <h2>{summaryData.title}</h2>
                </div>

                <div className="summary-content">
                    {keyValuePairs.length > 0 ? (
                        <div className="summary-table">
                            {keyValuePairs.map((pair, index) => (
                                <div key={index} className="summary-row">
                                    <div className="summary-key">{pair.key}</div>
                                    <div className={`summary-value ${isWebUrl(pair.value) ? "is-link" : ""}`}>
                                        {isWebUrl(pair.value) ? (
                                            <a className="url-link" href={pair.value} target="_blank" rel="noopener noreferrer">
                                                {pair.value}
                                            </a>
                                        ) : pair.value}
                                    </div>
                                    <div className="action-buttons">
                                        {isWebUrl(pair.value) && (
                                            <a className="open-button" href={pair.value} target="_blank" rel="noopener noreferrer"
                                               title={t("servers.scriptDialogs.openInNewTab")} aria-label={t("servers.scriptDialogs.openInNewTab")}>
                                                <Icon path={mdiOpenInNew} />
                                            </a>
                                        )}
                                        <button className="copy-button"
                                                onClick={() => copyToClipboard(pair.value)}
                                                title={t("servers.scriptDialogs.copyValue", { name: pair.key })}>
                                            <Icon path={mdiContentCopy} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-data">
                            <p>{t("servers.scriptDialogs.noSummary")}</p>
                        </div>
                    )}
                </div>

                <div className="dialog-actions">
                    {keyValuePairs.length > 0 && (
                        <Button onClick={copyAllSummary} text={t("servers.scriptDialogs.copyAll")} icon={mdiFileDocumentOutline}
                                type="secondary" />
                    )}
                    <Button onClick={onClose} text={t("common.actions.close")} icon={mdiClose} />
                </div>
            </div>
        </DialogProvider>
    );
};

export default SummaryDialog;
