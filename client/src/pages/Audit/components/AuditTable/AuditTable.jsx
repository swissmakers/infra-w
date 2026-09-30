import { useState, useMemo, useCallback } from "react";
import Icon from "@mdi/react";
import { mdiChevronRight, mdiInformationOutline, mdiPlayCircleOutline } from "@mdi/js";
import PaginatedTable from "@/common/components/PaginatedTable";
import RecordingPlayer from "../RecordingPlayer";
import { useTranslation } from "react-i18next";
import "./styles.sass";
import { formatDay, formatDuration, formatTime } from "@/common/utils/formatUtils.js";

const isSensitive = action => /delete|upload|download|credentials_access/.test(action);

export const AuditTable = ({ logs, loading, pagination, onPageChange }) => {
    const { t } = useTranslation();
    const [expandedRow, setExpandedRow] = useState(null);
    const [playingRecording, setPlayingRecording] = useState(null);

    const renderDetails = useCallback((details) => {
        if (!details) return null;
        const visibleEntries = Object.entries(details).filter(([key, value]) =>
            key !== "connectionReason" && value !== null && value !== undefined && String(value) !== "null");
        if (!visibleEntries.length) return null;

        return (
            <div className="audit-details">
                {visibleEntries.map(([key, value]) => (
                    <div key={key} className="detail-item">
                        <span className="detail-key">
                            {t(`audit.detailKeys.${key}`, { defaultValue: key.replace(/([A-Z])/g, " $1").toLowerCase() })}:
                        </span>
                        <span className="detail-value">
                            {key === "sessionDuration" 
                                ? formatDuration(Number(value))
                                : String(value)
                            }
                        </span>
                    </div>
                ))}
            </div>
        );
    }, [t]);

    const handleRowClick = useCallback((logId) => {
        setExpandedRow(prev => prev === logId ? null : logId);
    }, []);

    const handlePlayRecording = useCallback((e, log) => {
        e.stopPropagation();
        setPlayingRecording({
            auditLogId: log.id,
            recordingType: log.details?.recordingType || "guac",
        });
    }, []);

    const handleCloseRecording = useCallback(() => {
        setPlayingRecording(null);
    }, []);

    const columns = useMemo(() => ["timestamp", "action", "actor", "resource", "organization", "details"]
        .map(key => ({ key, label: t(`audit.table.headers.${key}`), className: key })), [t]);

    const renderRow = useCallback((log) => {
        const isExpanded = expandedRow === log.id;
        const actor = log.actorFirstName && log.actorLastName ? `${log.actorFirstName} ${log.actorLastName}`
            : log.actorUsername ? (log.actorAuthProviderType === "ldap" && log.actorAuthProviderName
                ? `${log.actorUsername}@${log.actorAuthProviderName}` : log.actorUsername)
            : t("audit.table.badges.user", { id: log.accountId });

        return (
            <div key={log.id} className={`audit-row${isExpanded ? " expanded" : ""}`}>
                <div className="row-main" onClick={() => handleRowClick(log.id)}>
                    <div className="cell timestamp" data-label={t("audit.table.headers.timestamp")}>
                        <span>{formatDay(log.timestamp)}</span><small>{formatTime(log.timestamp)}</small>
                    </div>
                    <div className="cell action" data-label={t("audit.table.headers.action")}>
                        <span className={isSensitive(log.action) ? "sensitive" : undefined}>{t(`audit.actions.${log.action}`, { defaultValue: log.action })}</span>
                        {log.category && <small>{t(`audit.categories.${log.category}`)}</small>}
                    </div>
                    <div className="cell actor" data-label={t("audit.table.headers.actor")}>
                        <span>{actor}</span>{log.ipAddress && <small>{log.ipAddress}</small>}
                    </div>
                    <div className="cell resource" data-label={t("audit.table.headers.resource")}>
                        <span>{log.resourceName || log.resource || "—"}</span>
                    </div>
                    <div className="cell organization" data-label={t("audit.table.headers.organization")}>
                        {log.organizationId
                            ? <span>{log.organizationName || t("audit.table.badges.organization", { id: log.organizationId })}</span>
                            : <small>{t("audit.table.badges.personal")}</small>}
                    </div>
                    <div className="cell details">
                        {log.details?.hasRecording && <button type="button" className="play-recording-btn"
                            aria-label={t("audit.table.replayRecording")} title={t("audit.table.replayRecording")}
                            onClick={(e) => handlePlayRecording(e, log)}>
                            <Icon path={mdiPlayCircleOutline} size={0.8} />
                        </button>}
                        <button type="button" className="expand-btn" aria-expanded={isExpanded} aria-label={t("audit.table.headers.details")}
                            onClick={event => { event.stopPropagation(); handleRowClick(log.id); }}>
                            <Icon path={mdiChevronRight} size={0.8} className="expand-icon" />
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="row-expanded">
                        {log.details?.connectionReason?.trim() && <div><h4>{t("audit.table.expandedDetails.connectionReason")}</h4><p>{log.details.connectionReason}</p></div>}
                        {log.userAgent && <div><h4>{t("audit.table.expandedDetails.userAgent")}</h4><p>{log.userAgent}</p></div>}
                        {log.details && <div><h4>{t("audit.table.expandedDetails.additionalDetails")}</h4>{renderDetails(log.details)}</div>}
                    </div>
                )}
            </div>
        );
    }, [expandedRow, handleRowClick, handlePlayRecording, renderDetails, t]);

    return (
        <>
            <PaginatedTable
                data={logs}
                columns={columns}
                pagination={pagination}
                onPageChange={onPageChange}
                renderRow={renderRow}
                getRowKey={(log) => log.id}
                loading={loading}
                emptyState={{
                    icon: mdiInformationOutline,
                    title: t('audit.table.noLogs.title'),
                    subtitle: t('audit.table.noLogs.subtitle'),
                }}
                className="audit-table-wrapper"
                columnTemplate="minmax(120px, .8fr) minmax(140px, 1.1fr) minmax(140px, 1fr) minmax(120px, 1fr) minmax(110px, .8fr) 64px"
            />

            {playingRecording && (
                <RecordingPlayer
                    auditLogId={playingRecording.auditLogId}
                    recordingType={playingRecording.recordingType}
                    onClose={handleCloseRecording}
                />
            )}
        </>
    );
};