import { useContext, useCallback, useMemo, useRef, useEffect } from "react";
import { useStateStream, STATE_TYPES, EVENT_TYPES } from "@/common/hooks/useStateStream.js";
import { UserContext, StateStreamContext } from "@/common/contexts";
import { endLocalSession } from "@/common/utils/sessionToken.js";

const stateTypes = Object.values(STATE_TYPES).filter(t => t !== "LOGOUT");
const eventTypes = Object.values(EVENT_TYPES);

export const StateStreamProvider = ({ children }) => {
    const { sessionToken } = useContext(UserContext);
    const handlersRef = useRef(Object.fromEntries([...stateTypes, ...eventTypes].map(t => [t, new Set()])));
    const stateBufferRef = useRef(Object.fromEntries(stateTypes.map(t => [t, null])));

    const stateHandlers = useMemo(() => ({
        ...Object.fromEntries(stateTypes.map(t => [t, (data) => {
            stateBufferRef.current[t] = data;
            handlersRef.current[t].forEach(h => h(data));
        }])),
        ...Object.fromEntries(eventTypes.map(t => [t, (data) => handlersRef.current[t].forEach(h => h(data))])),
        [STATE_TYPES.LOGOUT]: endLocalSession
    }), []);

    const { isConnected, connectionError } = useStateStream(sessionToken, stateHandlers);

    useEffect(() => {
        if (!sessionToken) stateBufferRef.current = Object.fromEntries(stateTypes.map(t => [t, null]));
    }, [sessionToken]);

    const registerHandler = useCallback((stateType, handler) => {
        if (!handlersRef.current[stateType]) return () => {};
        handlersRef.current[stateType].add(handler);
        if (stateBufferRef.current[stateType] != null) handler(stateBufferRef.current[stateType]);
        return () => handlersRef.current[stateType].delete(handler);
    }, []);

    const contextValue = useMemo(() => ({ isConnected, connectionError, registerHandler }), [isConnected, connectionError, registerHandler]);

    return <StateStreamContext.Provider value={contextValue}>{children}</StateStreamContext.Provider>;
};
