import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket, ReadyState } from "@/common/hooks/useWebSocket.js";
import { getWebSocketUrl, getTabId, getBrowserId } from "@/common/utils/ConnectionUtil.js";
import { endLocalSession } from "@/common/utils/sessionToken.js";

export const STATE_TYPES = { ENTRIES: "ENTRIES", IDENTITIES: "IDENTITIES", SNIPPETS: "SNIPPETS", SCRIPTS: "SCRIPTS", CONNECTIONS: "CONNECTIONS", LOGOUT: "LOGOUT" };
export const EVENT_TYPES = { CONNECTION_FAILED: "CONNECTION_FAILED", CONNECTION_PROMPT: "CONNECTION_PROMPT", CONNECTION_PROMPT_DONE: "CONNECTION_PROMPT_DONE" };

export const useStateStream = (sessionToken, handlers = {}) => {
    const handlersRef = useRef(handlers);
    const [connectionError, setConnectionError] = useState(false);
    const hasConnectedRef = useRef(false);
    const invalidatedRef = useRef(false);
    const [prevSessionToken, setPrevSessionToken] = useState(sessionToken);

    if (sessionToken !== prevSessionToken) {
        setPrevSessionToken(sessionToken);
        if (!sessionToken) setConnectionError(false);
    }

    useEffect(() => { handlersRef.current = handlers; }, [handlers]);

    const wsUrl = sessionToken ? getWebSocketUrl("/api/ws/state", { sessionToken, tabId: getTabId(), browserId: getBrowserId() }) : null;

    const onOpen = useCallback(() => {
        hasConnectedRef.current = true;
        setConnectionError(false);
    }, []);

    const onClose = useCallback((e) => {
        if (e.code === 4010) {
            invalidatedRef.current = true;
            endLocalSession();
            return;
        }
        setConnectionError(true);
    }, []);

    const onError = useCallback(() => {
        setConnectionError(true);
    }, []);

    const { lastMessage, readyState } = useWebSocket(wsUrl, {
        shouldReconnect: (e) => !invalidatedRef.current && e.code !== 4010,
        reconnectAttempts: Infinity,
        reconnectInterval: 3000,
        retryOnError: true,
        onOpen,
        onClose,
        onError,
    }, !!sessionToken);

    useEffect(() => {
        if (!sessionToken || hasConnectedRef.current || readyState !== ReadyState.CONNECTING) return;
        const timeout = setTimeout(() => { setConnectionError(true); }, 5000);
        return () => clearTimeout(timeout);
    }, [sessionToken, readyState]);

    useEffect(() => {
        if (!sessionToken) {
            hasConnectedRef.current = false;
            invalidatedRef.current = false;
        }
    }, [sessionToken]);

    useEffect(() => {
        if (!lastMessage?.data) return;
        try {
            const { type, data } = JSON.parse(lastMessage.data);
            if (type && handlersRef.current[type]) handlersRef.current[type](data);
        } catch {}
    }, [lastMessage]);

    return { isConnected: readyState === ReadyState.OPEN, connectionError };
};
