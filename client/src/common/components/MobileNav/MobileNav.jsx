import "./styles.sass";
import { mdiAccountCogOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { getSidebarNavigation } from "@/common/utils/navigation.js";
import { UserContext } from "@/common/contexts";

export const MobileNav = () => {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user } = useContext(UserContext);
    const navigation = [...getSidebarNavigation(t, user?.role === "admin"),
        { title: t("common.sidebar.settings"), key: "settings", path: "/settings", icon: mdiAccountCogOutline }];

    const handleClick = (item) => {
        if (pathname.startsWith(item.path) && item.toggleEvent) window.dispatchEvent(new CustomEvent(item.toggleEvent));
        else navigate(item.path);
    };

    return (
        <nav className="mobile-nav">
            <div className="mobile-nav-scroll">
                {navigation.map((item) => (
                    <button type="button" key={item.key} onClick={() => handleClick(item)} className={`mobile-nav-item${pathname.startsWith(item.path) ? " active" : ""}`}>
                        <Icon path={item.icon} /><span>{item.title}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default MobileNav;
