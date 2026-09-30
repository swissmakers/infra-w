import { UAParser } from "ua-parser-js";
import { useTranslation } from "react-i18next";
import { mdiCellphone, mdiMonitor, mdiTablet } from "@mdi/js";
import { SettingsListItem } from "@/pages/Settings/components/SettingsLayout.jsx";
import { formatDate } from "@/common/utils/formatUtils.js";

const DEVICE_ICONS = { mobile: mdiCellphone, wearable: mdiCellphone, tablet: mdiTablet };
const raw = { interpolation: { escapeValue: false } };

export const DeviceListItem = ({ session, owner, badge, meta, actions }) => {
    const { t } = useTranslation();
    const agent = new UAParser(session.userAgent);
    const browser = agent.getBrowser(), os = agent.getOS();
    const device = t("settings.sessions.browserOn", { browser: browser.name, version: browser.version, os: os.name, osVersion: os.version, ...raw });
    return <SettingsListItem icon={DEVICE_ICONS[agent.getDevice().type] || mdiMonitor} title={owner ? `${owner} · ${device}` : device} badge={badge}
        meta={[
            t("settings.sessions.lastActivity", { date: formatDate(session.lastActivity), ip: session.ip, ...raw }),
            session.createdAt && t("settings.sessions.signedIn", { date: formatDate(session.createdAt), ...raw }),
            meta,
        ]}
        actions={actions} />;
};
