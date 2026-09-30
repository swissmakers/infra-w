import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { getRequest } from "@/common/utils/RequestUtil";
import { StandaloneSession, StandaloneMessage } from "@/common/components/StandaloneSession";
import { mdiAlertCircle } from "@mdi/js";
import Loading from "@/common/components/Loading";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";
import { UserContext } from "@/common/contexts";
import { createPopoutChannel } from "@/common/utils/popoutChannel.js";

const channel = createPopoutChannel();

export const Popout = () => {
    const { sessionId } = useParams();
    const { user } = useContext(UserContext);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { t } = useTranslation();

    useEffect(() => {
        if (!sessionId || !user) return;
        getRequest(`/connections/${sessionId}`)
            .then(data => { setSession(data); if (data.server?.name) document.title = `${data.server.name} - INFRA-W`; })
            .catch(requestError => setError(requestError.message))
            .finally(() => setLoading(false));
    }, [sessionId, user]);

    useEffect(() => {
        const cleanup = () => channel?.postMessage({ type: "popout_closed", sessionId });
        window.addEventListener("beforeunload", cleanup);
        return () => window.removeEventListener("beforeunload", cleanup);
    }, [sessionId]);

    useEffect(() => {
        if (!channel) return;
        const handler = ({ data }) => data.type === "force_close" && window.close();
        channel.addEventListener("message", handler);
        return () => channel.removeEventListener("message", handler);
    }, []);

    if (loading) return <Loading />;
    if (!session) return (
        <StandaloneMessage icon={mdiAlertCircle} title={t("common.errorPage.errorTitle")} text={error || t("common.errorPage.errorText")}>
            <Button text={t("common.close")} onClick={() => window.close()} />
        </StandaloneMessage>
    );

    return <StandaloneSession session={session} onDisconnect={() => window.close()} />;
};
