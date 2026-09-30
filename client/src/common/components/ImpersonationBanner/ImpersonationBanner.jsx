import { useContext } from "react";
import Icon from "@mdi/react";
import { mdiAccountSwitchOutline } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Button from "@/common/components/Button";
import { UserContext } from "@/common/contexts";
import "./styles.sass";

export const ImpersonationBanner = () => {
    const { user, logout } = useContext(UserContext);
    const { t } = useTranslation();

    if (!user?.impersonator) return null;

    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
    return (
        <div className="impersonation-banner" role="status">
            <Icon path={mdiAccountSwitchOutline} className="banner-icon" />
            <span>{t("common.impersonation.banner", { user: name, admin: user.impersonator.name })}</span>
            <Button type="secondary" text={t("common.impersonation.return")} onClick={logout} />
        </div>
    );
};
