import { useCallback, useContext, useEffect, useState } from "react";
import { deleteRequest, getRequest } from "@/common/utils/RequestUtil.js";
import { mdiLogoutVariant } from "@mdi/js";
import { useTranslation } from "react-i18next";
import Button from "@/common/components/Button";
import { SettingsSection } from "@/pages/Settings/components/SettingsLayout.jsx";
import { DeviceListItem } from "@/pages/Settings/components/DeviceListItem.jsx";
import { UserContext, useToast } from "@/common/contexts";

export const Sessions = () => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const [sessions, setSessions] = useState([]);
    const { logout: logoutMyself } = useContext(UserContext);

    const loadSessions = useCallback(() => getRequest("sessions/list").then(setSessions).catch(showError), [showError]);

    const revoke = sessionId => deleteRequest(`sessions/${sessionId}`).then(loadSessions).catch(showError);
    const revokeOthers = () => deleteRequest("sessions/others").then(({ count }) => {
        sendToast("Success", t("settings.sessions.othersSignedOut", { count }));
        return loadSessions();
    }).catch(showError);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    return (
        <SettingsSection actions={sessions.length > 1 &&
            <Button type="secondary" icon={mdiLogoutVariant} text={t("settings.sessions.signOutOthers")} onClick={revokeOthers} />}>
            {sessions.map(session => <DeviceListItem key={session.id} session={session}
                badge={session.current && <span className="settings-status positive">{t("settings.sessions.currentSession")}</span>}
                actions={<Button type="secondary" text={t(session.current ? "settings.sessions.logout" : "settings.sessions.revoke")}
                    onClick={() => session.current ? logoutMyself() : revoke(session.id)} />} />)}
        </SettingsSection>
    );
};
