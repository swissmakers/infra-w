import { useState, useEffect, useCallback } from "react";
import { SessionContext } from "@/common/contexts";
import { createPopoutChannel } from "@/common/utils/popoutChannel.js";

const channel = createPopoutChannel();

export const SessionProvider = ({ children }) => {
    const [activeSessions, setActiveSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [poppedOutSessions, setPoppedOutSessions] = useState([]);

    const popOutSession = useCallback(async (id) => {
        const popup = window.open(`/popout/${id}`, `infra-w-popout-${id}`, "width=1024,height=768,menubar=no,toolbar=no,location=no,status=no");
        if (!popup) return;
        popup.focus();
        setPoppedOutSessions(p => p.includes(id) ? p : [...p, id]);
        if (id === activeSessionId) {
            const visible = activeSessions.filter(s => s.id !== id && !poppedOutSessions.includes(s.id));
            setActiveSessionId(visible.at(-1)?.id || null);
        }

    }, [activeSessionId, activeSessions, poppedOutSessions]);

    useEffect(() => {
        if (!channel) return;
        const handler = ({ data }) => {
            if (data.type !== "popout_closed") return;
            setPoppedOutSessions(p => p.filter(id => id !== data.sessionId));
            if (activeSessions.some(s => s.id === data.sessionId)) setActiveSessionId(data.sessionId);
        };
        channel.addEventListener("message", handler);
        return () => channel.removeEventListener("message", handler);
    }, [activeSessions]);

    return (
        <SessionContext.Provider value={{ activeSessions, setActiveSessions, activeSessionId, setActiveSessionId, poppedOutSessions, popOutSession }}>
            {children}
        </SessionContext.Provider>
    );
};