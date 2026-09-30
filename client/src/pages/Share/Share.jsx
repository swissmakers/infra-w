import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { mdiLinkOff, mdiAlertCircle } from "@mdi/js";
import { StandaloneSession, StandaloneMessage } from "@/common/components/StandaloneSession";
import Loading from "@/common/components/Loading";
import { request } from "@/common/utils/RequestUtil";

export const Share = () => {
    const { t } = useTranslation();
    const { shareId } = useParams();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [disconnected, setDisconnected] = useState(false);

    const handleDisconnect = () => {
        setDisconnected(true);
        setTimeout(() => window.close(), 100);
    };

    useEffect(() => {
        if (!shareId) return;
        request(`share/${shareId}`, "GET")
            .then(data => {
                setSession({ ...data, shareId });
                if (data.server?.name) document.title = t("share.windowTitle", { name: data.server.name });
            })
            .catch(err => setError(err.message || t("share.errors.failedToJoin")))
            .finally(() => setLoading(false));
    }, [shareId, t]);

    if (loading) return <Loading />;
    if (error) return <StandaloneMessage icon={mdiAlertCircle} title={t("share.errors.unableToConnect")} text={error} />;
    if (disconnected) return <StandaloneMessage icon={mdiLinkOff} title={t("share.sessionEnded.title")} text={t("share.sessionEnded.description")} />;
    if (!session) return null;

    return <StandaloneSession session={session} onDisconnect={handleDisconnect} isShared />;
};
