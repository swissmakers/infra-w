import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiContentCopy, mdiCheck, mdiLoading, mdiCalculator } from "@mdi/js";
import Button from "@/common/components/Button/index.js";
import { formatBytes } from "@/common/utils/formatUtils.js";
import { formatDate, formatNumber } from "@/common/utils/formatUtils.js";

export const GeneralTab = ({
    fullPath,
    isFolder,
    stats,
    loadingStats,
    folderSize,
    loadingFolderSize,
    item,
    copied,
    onCopy,
    onCalculateFolderSize,
}) => {
    const { t } = useTranslation();

    const formatTimestamp = (timestamp) => timestamp ? formatDate(timestamp * 1000) : "-";

    return (
        <div className="properties-content">
            <div className="property-section">
                <div className="property-row">
                    <span className="label">{t("servers.fileManager.properties.path")}</span>
                    <span className="value path-value">
                        <code>{fullPath}</code>
                        <Button icon={copied === "path" ? mdiCheck : mdiContentCopy} onClick={() => onCopy(fullPath, "path")} type="primary" />
                    </span>
                </div>
            </div>

            <div className="property-section">
                <div className="property-row">
                    <span className="label">{t("servers.fileManager.properties.size")}</span>
                    <span className="value">
                        {loadingStats ? (
                            <Icon path={mdiLoading} className="spinning" />
                        ) : isFolder ? (
                            folderSize !== null ? (
                                <span className="size-display">
                                    {formatBytes(folderSize)}
                                    <span className="size-bytes">({t("servers.fileManager.properties.byteCount", { value: formatNumber(folderSize) })})</span>
                                </span>
                            ) : (
                                <Button
                                    icon={loadingFolderSize ? mdiLoading : mdiCalculator}
                                    text={t("servers.fileManager.properties.calculateSize")}
                                    onClick={onCalculateFolderSize}
                                    disabled={loadingFolderSize}
                                    type="secondary"
                                />
                            )
                        ) : (
                            <span className="size-display">
                                {stats?.size !== undefined ? formatBytes(stats.size) : item?.size !== undefined ? formatBytes(item.size) : "-"}
                                {(stats?.size !== undefined || item?.size !== undefined) && (
                                    <span className="size-bytes">({t("servers.fileManager.properties.byteCount", { value: formatNumber(stats?.size ?? item?.size) })})</span>
                                )}
                            </span>
                        )}
                    </span>
                </div>
            </div>

            <div className="property-section">
                <div className="property-row">
                    <span className="label">{t("servers.fileManager.properties.owner")}</span>
                    <span className="value">{loadingStats ? <Icon path={mdiLoading} className="spinning" /> : stats?.owner || "-"}</span>
                </div>
                <div className="property-row">
                    <span className="label">{t("servers.fileManager.properties.group")}</span>
                    <span className="value">{loadingStats ? <Icon path={mdiLoading} className="spinning" /> : stats?.group || "-"}</span>
                </div>
            </div>

            <div className="property-section">
                <div className="property-row">
                    <span className="label">{t("servers.fileManager.properties.modified")}</span>
                    <span className="value">{loadingStats ? <Icon path={mdiLoading} className="spinning" /> : formatTimestamp(stats?.mtime || item?.last_modified)}</span>
                </div>
                <div className="property-row">
                    <span className="label">{t("servers.fileManager.properties.accessed")}</span>
                    <span className="value">{loadingStats ? <Icon path={mdiLoading} className="spinning" /> : formatTimestamp(stats?.atime)}</span>
                </div>
            </div>
        </div>
    );
};
