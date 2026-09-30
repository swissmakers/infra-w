import { useContext, useEffect, useState, useCallback } from "react";
import { getRequest } from "@/common/utils/RequestUtil.js";
import { UserContext, StateStreamContext, SnippetContext } from "@/common/contexts";
import { STATE_TYPES } from "@/common/hooks/useStateStream.js";

export const SnippetProvider = ({ children }) => {
    const [allSnippets, setAllSnippets] = useState([]);
    const { user, sessionToken } = useContext(UserContext);
    const { registerHandler } = useContext(StateStreamContext);
    const [prevSessionToken, setPrevSessionToken] = useState(sessionToken);

    if (sessionToken !== prevSessionToken) {
        setPrevSessionToken(sessionToken);
        if (!sessionToken) setAllSnippets([]);
    }

    useEffect(() => {
        if (user) return registerHandler(STATE_TYPES.SNIPPETS, setAllSnippets);
    }, [user, registerHandler]);

    const loadAllSnippets = useCallback(async () => {
        try {
            setAllSnippets(await getRequest("/snippets/all"));
        } catch {}
    }, []);

    return <SnippetContext.Provider value={{ allSnippets, loadAllSnippets }}>{children}</SnippetContext.Provider>;
};
