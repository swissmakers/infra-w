import { useContext, useEffect, useState, useCallback } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { UserContext, StateStreamContext, ScriptContext } from "@/common/contexts";
import { STATE_TYPES } from "@/common/hooks/useStateStream.js";

export const ScriptProvider = ({ children }) => {
    const [allScripts, setAllScripts] = useState([]);
    const { user, sessionToken } = useContext(UserContext);
    const { registerHandler } = useContext(StateStreamContext);
    const [prevSessionToken, setPrevSessionToken] = useState(sessionToken);

    if (sessionToken !== prevSessionToken) {
        setPrevSessionToken(sessionToken);
        if (!sessionToken) setAllScripts([]);
    }

    useEffect(() => {
        if (user) return registerHandler(STATE_TYPES.SCRIPTS, setAllScripts);
    }, [user, registerHandler]);

    const loadAllScripts = useCallback(async () => {
        try {
            setAllScripts(await getRequest("/scripts/all"));
        } catch {}
    }, []);

    return <ScriptContext.Provider value={{ allScripts, loadAllScripts }}>{children}</ScriptContext.Provider>;
};
