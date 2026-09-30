import { useTranslation } from "react-i18next";
import { mdiApi } from "@mdi/js";
import { SettingsListItem } from "@/pages/Settings/components/SettingsLayout.jsx";
import { formatDate } from "@/common/utils/formatUtils.js";

const raw = { interpolation: { escapeValue: false } };

export const ApiTokenListItem = ({ token, owner, actions }) => {
    const { t } = useTranslation();
    const expired = new Date(token.expiresAt) <= new Date();
    return <SettingsListItem icon={mdiApi} title={owner ? `${owner} · ${token.name}` : token.name} muted={expired}
        badge={<span className={`settings-status ${expired ? "error" : token.scope === "write" ? "warning" : ""}`}>
            {t(expired ? "settings.apiTokens.expired" : `settings.apiTokens.scopes.${token.scope}`)}</span>}
        meta={[
            t("settings.apiTokens.details", { prefix: token.prefix, created: formatDate(token.createdAt), expires: formatDate(token.expiresAt), ...raw }),
            token.lastUsedAt ? t("settings.apiTokens.lastUsed", { date: formatDate(token.lastUsedAt), ...raw }) : t("settings.apiTokens.neverUsed"),
        ]}
        actions={actions} />;
};
