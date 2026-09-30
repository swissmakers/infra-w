import { useContext, useMemo } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiArrowTopRight, mdiOpenInNew, mdiViewDashboardOutline } from "@mdi/js";
import { getSettingsUserPages, getSettingsAdminPages } from "@/common/utils/navigation.js";
import Account from "@/pages/Settings/pages/Account";
import Preferences from "@/pages/Settings/pages/Preferences";
import Terminal from "@/pages/Settings/pages/Terminal";
import FileManager from "@/pages/Settings/pages/FileManager";
import Keymaps from "@/pages/Settings/pages/Keymaps";
import Identities from "@/pages/Settings/pages/Identities";
import Sessions from "@/pages/Settings/pages/Sessions";
import Organizations from "@/pages/Settings/pages/Organizations";
import Users from "@/pages/Settings/pages/Users";
import Authentication from "@/pages/Settings/pages/Authentication";
import Monitoring from "@/pages/Settings/pages/Monitoring";
import Backup from "@/pages/Settings/pages/Backup";
import Integrations from "@/pages/Settings/pages/Integrations";
import HostKeys from "@/pages/Settings/pages/HostKeys";
import ApiTokens from "@/pages/Settings/pages/ApiTokens";
import Notifications from "@/pages/Settings/pages/Notifications";
import PageHeader from "@/common/components/PageHeader";
import { useServerVersion } from "@/common/hooks/useServerVersion.js";
import "./styles.sass";
import { UserContext } from "@/common/contexts";

// the settings route is lazy-loaded, so these pages stay in its chunk
const PAGES = { account: <Account />, preferences: <Preferences />, terminal: <Terminal />, fileManager: <FileManager />,
    keymaps: <Keymaps />, identities: <Identities />, sessions: <Sessions />, apiTokens: <ApiTokens />, organizations: <Organizations />, users: <Users />,
    authentication: <Authentication />, integrations: <Integrations />, monitoring: <Monitoring />, hostKeys: <HostKeys />, notifications: <Notifications />, backup: <Backup /> };

const GROUPS = [
    { key: "account", pages: ["account", "sessions", "identities", "apiTokens"] },
    { key: "preferences", pages: ["preferences", "terminal", "fileManager", "keymaps"] },
    { key: "access", pages: ["users", "organizations", "authentication"] },
    { key: "infrastructure", pages: ["integrations"] },
    { key: "system", pages: ["monitoring", "notifications", "hostKeys", "backup"] },
];

export default function Settings() {
    const { user } = useContext(UserContext);
    const { section = "overview" } = useParams();
    const { t } = useTranslation();
    const groups = useMemo(() => {
        const pages = [...getSettingsUserPages(t), ...(user?.role === "admin" ? getSettingsAdminPages(t) : [])];
        return GROUPS.map(group => ({ ...group, pages: group.pages.map(key => pages.find(page => page.key === key)).filter(Boolean) }))
            .filter(group => group.pages.length);
    }, [t, user?.role]);
    const currentGroup = groups.find(group => group.pages.some(page => page.key === section));
    const current = currentGroup?.pages.find(page => page.key === section);
    const isOverview = section === "overview";
    const version = useServerVersion();

    return <div className="settings-workspace">
        <aside className="settings-navigation">
            <nav aria-label={t("enterprise.settingsNavigation")}>
                <NavLink end to="/settings" className={isOverview ? "active" : undefined}><Icon path={mdiViewDashboardOutline} size={0.9} />{t("enterprise.overview")}</NavLink>
                {groups.map(group => <div className="settings-nav-group" key={group.key}>
                    <h2>{t(`enterprise.groups.${group.key}`)}</h2>
                    {group.pages.map(page => <NavLink key={page.key} to={`/settings/${page.key}`}>
                        <Icon path={page.icon} size={0.9} /><span>{page.title}</span>
                    </NavLink>)}
                </div>)}
            </nav>
            <div className="settings-navigation-footer">
                <span>INFRA-W{version && ` v${version}`}</span>
                <a href="https://swissmakers.ch" target="_blank" rel="noopener noreferrer">Swissmakers GmbH</a>
            </div>
        </aside>
        <main className="settings-document page-document">
            <div className="settings-page">
                <PageHeader eyebrow={currentGroup && t(`enterprise.groups.${currentGroup.key}`)}
                    title={isOverview ? t("common.sidebar.settings") : current?.title || t("enterprise.unavailablePage")}
                    subtitle={t(`enterprise.descriptions.${section}`, { defaultValue: "" })} />
                {isOverview ? <div className="administration-index">
                    {groups.map(group => <section key={group.key}>
                        <div className="administration-section-title"><h2>{t(`enterprise.groups.${group.key}`)}</h2><p>{t(`enterprise.groupDescriptions.${group.key}`)}</p></div>
                        <div className="administration-links">{group.pages.map(page => <Link to={`/settings/${page.key}`} key={page.key}>
                            <div><strong>{page.title}</strong><span>{t(`enterprise.descriptions.${page.key}`)}</span></div><Icon path={mdiArrowTopRight} size={0.8} />
                        </Link>)}</div>
                    </section>)}
                    {user?.role === "admin" && version && <section>
                        <div className="administration-section-title"><h2>{t("enterprise.about.title")}</h2><p>{t("enterprise.about.description")}</p></div>
                        <div className="administration-links">
                            <a href={`https://github.com/swissmakers/infra-w/releases/tag/v${version}`} target="_blank" rel="noopener noreferrer">
                                <div><strong>INFRA-W v{version}</strong><span>{t("enterprise.about.releaseNotes")}</span></div><Icon path={mdiOpenInNew} size={0.8} />
                            </a>
                        </div>
                    </section>}
                </div> : current ? PAGES[current.key] : <p role="alert">{t("enterprise.unavailablePageDescription")}</p>}
            </div>
        </main>
    </div>;
}
