import { useRef } from "react";
import Icon from "@mdi/react";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";
import "./styles.sass";

const noop = () => {};
const toggleFullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();

export const StandaloneSession = ({ session, onDisconnect, isShared = false }) => {
    const terminalRefs = useRef({});
    const renderer = session.type || session.server?.renderer;
    return (
        <div className="standalone-session">
            {renderer === "guac" && <GuacamoleRenderer session={session} disconnectFromServer={onDisconnect} registerGuacamoleRef={noop}
                onFullscreenToggle={toggleFullscreen} isShared={isShared} />}
            {renderer === "terminal" && <XtermRenderer session={session} disconnectFromServer={onDisconnect} registerTerminalRef={noop}
                broadcastMode={false} terminalRefs={terminalRefs} updateProgress={noop} layoutMode="single" onBroadcastToggle={noop}
                onFullscreenToggle={toggleFullscreen} isShared={isShared} />}
        </div>
    );
};

export const StandaloneMessage = ({ icon, title, text, children }) => (
    <div className="standalone-message" role="alert">
        {icon && <Icon path={icon} />}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {children}
    </div>
);
