import { useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiDockLeft, mdiWeatherNight, mdiWhiteBalanceSunny, mdiChevronDown, mdiLogout, mdiAccountOutline } from "@mdi/js";
import InfraWLogo from "@/common/components/InfraWLogo";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { getSidebarNavigation } from "@/common/utils/navigation.js";
import "./styles.sass";
import { StateStreamContext, UserContext, usePreferences } from "@/common/contexts";

export default function WorkspaceHeader({ onToggleNavigation, navigationCollapsed }) {
    const { t } = useTranslation();
    const { isConnected } = useContext(StateStreamContext);
    const { user, logout } = useContext(UserContext);
    const { theme, toggleTheme } = usePreferences();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false);
    const menu = useRef(null);
    const accountButton = useRef(null);
    useEffect(() => {
        const outside = event => { if (!menu.current?.contains(event.target)) setMenuOpen(false); };
        const escape = event => { if (event.key === "Escape") { setMenuOpen(false); accountButton.current?.focus(); } };
        if (!menuOpen) return;
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape);
        return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
    }, [menuOpen]);
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || t("common.sidebar.account");
    return <>
        <header className="workspace-header">
            <Link className="workspace-brand" to="/servers" aria-label="INFRA-W - Infrastructure Workspace">
                <span className="brand-mark"><InfraWLogo size={42} /></span>
                <span className="brand-type">INFRA-W<span>Infrastructure Workspace</span></span>
                <span className="brand-version">{import.meta.env.APP_VERSION}</span>
            </Link>
            <nav className="workspace-global-nav" aria-label={t("workspace.navigation")}>
                {getSidebarNavigation(t, user?.role === "admin").map(item => <NavLink key={item.key} to={item.path}>{item.title}</NavLink>)}
                <NavLink to="/settings">{t("common.sidebar.settings")}</NavLink>
            </nav>
            <div className="workspace-header-tools">
                {pathname === "/servers" && <button type="button" className="workspace-navigation-toggle" onClick={onToggleNavigation}
                    aria-label={t("workspace.toggleNavigation")} aria-expanded={!navigationCollapsed}><Icon path={mdiDockLeft} size={0.9} /></button>}
                <span className={`stream-state ${isConnected ? "connected" : "pending"}`} role="status"><i />{t(isConnected ? "workspace.liveInventory" : "workspace.reconnecting")}</span>
                <button type="button" onClick={toggleTheme} aria-label={t("workspace.toggleTheme")}><Icon path={theme === "light" ? mdiWeatherNight : mdiWhiteBalanceSunny} size={0.95} /></button>
                <div className="header-account" ref={menu}>
                    <button type="button" className="header-account-button" ref={accountButton} aria-label={t("common.sidebar.account")}
                        aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><Icon path={mdiAccountOutline} size={0.95} /><span>{name}</span><Icon path={mdiChevronDown} size={0.75} /></button>
                    {menuOpen && <div className="header-account-menu">
                        <span className="account-menu-name">{name}</span>
                        <button onClick={() => { navigate("/settings/account"); setMenuOpen(false); }}>{t("settings.pages.account")}</button>
                        <button onClick={() => { navigate("/settings/preferences"); setMenuOpen(false); }}>{t("settings.pages.preferences")}</button>
                        <button onClick={() => { setConfirmLogout(true); setMenuOpen(false); }}><Icon path={mdiLogout} size={0.9} />{t("common.sidebar.logout")}</button>
                    </div>}
                </div>
            </div>
        </header>
        <ActionConfirmDialog open={confirmLogout} setOpen={setConfirmLogout} onConfirm={logout} text={t("common.sidebar.logoutConfirmText", { username: user?.username })} />
    </>;
}
