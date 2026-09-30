import { useContext, useEffect, useState, useCallback } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { findEntry } from "@/common/utils/inventory.js";
import { UserContext, StateStreamContext, ServerContext } from "@/common/contexts";
import { STATE_TYPES } from "@/common/hooks/useStateStream.js";

export const ServerProvider = ({ children }) => {
    const { user, sessionToken } = useContext(UserContext);
    const { registerHandler } = useContext(StateStreamContext);
    const [servers, setServers] = useState(() => sessionToken ? null : []);
    const [prevSessionToken, setPrevSessionToken] = useState(sessionToken);

    if (sessionToken !== prevSessionToken) {
        setPrevSessionToken(sessionToken);
        if (!sessionToken) setServers([]);
    }

    useEffect(() => {
        if (user) return registerHandler(STATE_TYPES.ENTRIES, setServers);
    }, [user, registerHandler]);

    const loadServers = useCallback(async () => {
        try {
            setServers(await getRequest("/entries/list"));
        } catch {}
    }, []);

    const getServerById = serverId => findEntry(servers, serverId);

    return <ServerContext.Provider value={{ servers, loadServers, getServerById }}>{children}</ServerContext.Provider>;
};