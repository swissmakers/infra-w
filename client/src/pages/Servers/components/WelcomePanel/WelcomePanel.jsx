import "./styles.sass";
import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatRelative } from "@/common/utils/formatUtils.js";
import Icon from "@mdi/react";
import { mdiArrowTopRight, mdiPlay, mdiPlus, mdiLanConnect, mdiShieldCheckOutline, mdiConnection,
    mdiFolderOpen, mdiCursorDefaultClick, mdiServerNetwork, mdiRefresh, mdiFormatListBulleted } from "@mdi/js";
import { getRequest } from "@/common/utils/RequestUtil";
import { flattenEntries } from "@/common/utils/inventory.js";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { IdentityMenuItem } from "@/pages/Servers/components/EntryMenuItems/EntryMenuItems.jsx";
import Button from "@/common/components/Button";
import PageHeader from "@/common/components/PageHeader";
import { UserContext, ServerContext } from "@/common/contexts";

const protocolOf = entry => entry.protocol || entry.config?.protocol || (entry.type?.startsWith("pve-") ? "pve" : "other");
const addressOf = entry => entry.ip || entry.config?.ip || "";
const statusOf = entry => entry.managedDisabled ? "disabled" : ["online", "offline"].includes(entry.status) ? entry.status : "unknown";

export const WelcomePanel = ({ connectToServer, hibernatedSessions = [], resumeSession,
    openSFTP, openDirectConnect, onAddServer, onAddNetbox }) => {
    const { user } = useContext(UserContext);
    const { servers, getServerById } = useContext(ServerContext);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [recentConnections, setRecentConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recentError, setRecentError] = useState(false);
    const [reload, setReload] = useState(0);
    const [now, setNow] = useState(Date.now);
    const [contextItem, setContextItem] = useState(null);
    const contextMenu = useContextMenu();
    const inventory = useMemo(() => flattenEntries(servers), [servers]);
    const countBy = key => inventory.reduce((counts, entry) => ({ ...counts, [key(entry)]: (counts[key(entry)] || 0) + 1 }), {});
    const statusCounts = countBy(statusOf);
    const protocolCounts = countBy(protocolOf);
    const contextServer = contextItem ? getServerById(contextItem) : null;
    const isAdmin = user?.role === "admin";

    useEffect(() => {
        let cancelled = false;
        getRequest("/entries/recent?limit=8").then(data => {
            if (!cancelled) { setRecentConnections(Array.isArray(data) ? data : []); setRecentError(false); }
        }).catch(() => { if (!cancelled) setRecentError(true); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [reload]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    const connect = (entry, identityId = entry.identities?.[0]) => {
        const paused = hibernatedSessions.find(session => session.server?.id === entry.id);
        if (paused) resumeSession(paused.id);
        else connectToServer(entry.id, identityId ? { id: identityId } : null);
    };
    const openContext = (event, entryId) => {
        event.preventDefault();
        setContextItem(entryId);
        contextMenu.open(event, { x: event.clientX, y: event.clientY });
    };

    const hostRow = (entry, meta, onClick, key) => {
        const protocol = protocolOf(entry);
        const status = statusOf(entry);
        return <button key={key} type="button" className="host-row" onClick={onClick}
            onContextMenu={event => openContext(event, entry.id)} disabled={entry.managedDisabled}
            aria-label={t("workspace.connectHost", { name: entry.name, protocol: protocol.toUpperCase() })}>
            <span className="host-protocol">{protocol.toUpperCase()}</span>
            <span className="host-details"><strong>{entry.name}</strong>
                <span><code>{addressOf(entry) || t("workspace.noAddress")}</code>
                    {entry.osName && <span className="host-os">{entry.osName}</span>}
                    {entry._path?.length > 0 && <span className="host-group">{entry._path.at(-1).name}</span>}
                </span>
            </span>
            <span className="host-meta">{meta}</span>
            <span className={`host-state ${status}`}><i />{t(`workspace.${status}`)}</span>
            <Icon path={mdiArrowTopRight} size={0.8} className="host-connect" />
        </button>;
    };

    const recentRows = recentConnections.map((item, index) => {
        const entry = inventory.find(host => host.id === item.entryId);
        return entry ? hostRow(entry, formatRelative(item.timestamp, now), () => connect(entry), `${item.entryId}-${index}`) : null;
    }).filter(Boolean);

    return <div className="welcome-panel page-document">
        <PageHeader title={t("workspace.title")} subtitle={t("workspace.subtitle")}>
            <Button icon={mdiPlus} text={t("workspace.addServer")} onClick={onAddServer} />
        </PageHeader>

        <div className="overview-grid">
            <div className="overview-main">
                {hibernatedSessions.length > 0 && <section className="overview-section">
                    <h2>{t("workspace.resumeSessions")} <span>{hibernatedSessions.length}</span></h2>
                    <div className="host-rows">
                        {hibernatedSessions.map(session => hostRow({ ...session.server, _path: [] },
                            <><Icon path={mdiPlay} size={0.6} />{t("workspace.suspended")}</>,
                            () => resumeSession(session.id), session.id))}
                    </div>
                </section>}

                <section className="overview-section">
                    <h2>{t("welcome.recentConnections")}</h2>
                    {servers !== null && inventory.length === 0 ? <div className="overview-empty">
                        <Icon path={mdiServerNetwork} size={1.5} />
                        <h3>{t("workspace.noHosts")}</h3>
                        <p>{t("workspace.addHostsHint")}</p>
                        <div className="overview-empty-actions">
                            <Button icon={mdiPlus} text={t("workspace.addServer")} onClick={onAddServer} />
                            {isAdmin && <Button type="secondary" icon={mdiLanConnect} text={t("workspace.connectNetbox")} onClick={onAddNetbox} />}
                        </div>
                    </div> : loading ? <p className="overview-note" role="status">{t("workspace.loadingHistory")}</p>
                        : recentError ? <div className="overview-note" role="alert"><p>{t("workspace.historyError")}</p>
                            <Button type="secondary" icon={mdiRefresh} text={t("workspace.retry")} onClick={() => { setLoading(true); setReload(value => value + 1); }} /></div>
                        : recentRows.length ? <div className="host-rows">{recentRows}</div>
                        : <p className="overview-note">{t("workspace.noHistory")}</p>}
                    {inventory.length > 0 && <div className="overview-footnote">
                        <Icon path={mdiConnection} size={0.75} /><span>{t("workspace.connectHint")}</span>
                        <button type="button" className="browse-inventory" onClick={() => window.dispatchEvent(new CustomEvent("toggleServerList"))}>
                            <Icon path={mdiFormatListBulleted} size={0.75} />{t("workspace.inventory")}
                        </button>
                    </div>}
                </section>
            </div>

            <aside className="overview-aside">
                <section className="overview-section">
                    <h2>{t("workspace.inventory")} <span>{inventory.length}</span></h2>
                    <dl className="inventory-summary">
                        {["online", "offline", "unknown", "disabled"].filter(status => statusCounts[status]).map(status =>
                            <div key={status} className={`host-state ${status}`}><dt><i />{t(`workspace.${status}`)}</dt><dd>{statusCounts[status]}</dd></div>)}
                        {Object.entries(protocolCounts).sort(([, a], [, b]) => b - a).map(([protocol, count]) =>
                            <div key={protocol} className="protocol-count"><dt>{protocol.toUpperCase()}</dt><dd>{count}</dd></div>)}
                    </dl>
                    {isAdmin && <div className="overview-links">
                        <button type="button" onClick={onAddNetbox}><Icon path={mdiLanConnect} size={0.75} />{t("workspace.connectNetbox")}</button>
                        <button type="button" onClick={() => navigate("/settings/integrations")}>
                            {t("workspace.manageIntegrations")}<Icon path={mdiArrowTopRight} size={0.7} /></button>
                    </div>}
                </section>
                <section className="overview-section recording-note">
                    <h2><Icon path={mdiShieldCheckOutline} size={0.8} />{t("workspace.sessionPolicy")}</h2>
                    <p>{t("workspace.recordingPolicy")}</p>
                    {isAdmin && <div className="overview-links"><button type="button" onClick={() => navigate("/audit")}>
                        {t("workspace.viewAudit")}<Icon path={mdiArrowTopRight} size={0.7} /></button></div>}
                </section>
            </aside>
        </div>

        <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={contextMenu.close} trigger={contextMenu.triggerRef}>
            {contextServer && <>
                <IdentityMenuItem icon={mdiConnection} label={t("servers.contextMenu.connect")} identityIds={contextServer.identities}
                    onSelect={identityId => connect(contextServer, identityId)} />
                {protocolOf(contextServer) === "ssh" && openSFTP && <IdentityMenuItem icon={mdiFolderOpen} label={t("servers.contextMenu.openSFTP")}
                    identityIds={contextServer.identities} onSelect={identityId => openSFTP(contextServer.id, identityId ? { id: identityId } : null)} />}
                {openDirectConnect && <ContextMenuItem icon={mdiCursorDefaultClick} label={t("servers.contextMenu.quickConnect")}
                    onClick={() => openDirectConnect(contextServer)} />}
            </>}
        </ContextMenu>
    </div>;
};
