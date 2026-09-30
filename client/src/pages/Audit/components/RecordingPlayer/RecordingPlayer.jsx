import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiPlay, mdiPause, mdiRewind, mdiFastForward, mdiLoading, mdiAlertCircleOutline, mdiFullscreen, mdiFullscreenExit } from "@mdi/js";
import Guacamole from "guacamole-common-js";
import * as AsciinemaPlayer from "asciinema-player";
import "asciinema-player/dist/bundle/asciinema-player.css";
import { DialogProvider } from "@/common/components/Dialog/Dialog.jsx";
import { getRawRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";

const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
};

const RecordingPlayerContent = ({ auditLogId, recordingType }) => {
    const { t } = useTranslation();
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const playerContentRef = useRef(null);
    const [state, setState] = useState({ loading: true, error: null, playing: false, duration: 0, position: 0, fullscreen: false });

    const updateState = (changes) => setState(prevState => ({ ...prevState, ...changes }));

    const handleFullscreen = useCallback(() => {
        if (!playerContentRef.current) return;
        if (!document.fullscreenElement) {
            playerContentRef.current.requestFullscreen().then(() => updateState({ fullscreen: true })).catch(() => {});
        } else {
            document.exitFullscreen().then(() => updateState({ fullscreen: false })).catch(() => {});
        }
    }, []);

    const handlePlayPause = useCallback(async () => {
        const player = playerRef.current;
        if (!player) return;
        if (state.playing) {
            await player.pause?.();
        } else {
            await player.play?.();
        }
    }, [state.playing]);

    const handleSeek = useCallback(async (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const percentage = (event.clientX - rect.left) / event.currentTarget.offsetWidth;
        const newPosition = percentage * state.duration;
        const player = playerRef.current;
        if (!player) return;
        if (recordingType === "guac") {
            player.seek(newPosition, () => updateState({ position: newPosition }));
        } else {
            await player.seek(newPosition / 1000);
            updateState({ position: newPosition });
        }
    }, [state.duration, recordingType]);

    const handleSkip = useCallback(async (delta) => {
        const newPosition = Math.max(0, Math.min(state.duration, state.position + delta));
        const player = playerRef.current;
        if (!player) return;
        if (recordingType === "guac") {
            player.seek(newPosition, () => updateState({ position: newPosition }));
        } else {
            await player.seek(newPosition / 1000);
            updateState({ position: newPosition });
        }
    }, [state.position, state.duration, recordingType]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.replaceChildren();
        let cancelled = false;
        let cleanup = null;
        let readyTimeout;
        const updatePlayerState = changes => {
            if (!cancelled) updateState(changes);
        };
        updatePlayerState({ loading: true, error: null, playing: false, duration: 0, position: 0 });

        (async () => {
            try {
                const response = await getRawRequest(`audit/${auditLogId}/recording`);
                if (cancelled) return;

                if (recordingType === "guac") {
                    const data = await response.blob();
                    if (cancelled) return;
                    const recording = new Guacamole.SessionRecording(data);
                    playerRef.current = recording;
                    const display = recording.getDisplay();
                    const displayElement = display.getElement();
                    container.appendChild(displayElement);

                    const scaleDisplay = () => {
                        const displayWidth = display.getWidth();
                        const displayHeight = display.getHeight();
                        const containerWidth = container.clientWidth;
                        const containerHeight = container.clientHeight;
                        if (displayWidth && displayHeight && containerWidth && containerHeight) {
                            const scaleFactor = Math.min(containerWidth / displayWidth, containerHeight / displayHeight);
                            const offsetX = (containerWidth - displayWidth * scaleFactor) / 2;
                            const offsetY = (containerHeight - displayHeight * scaleFactor) / 2;
                            Object.assign(displayElement.style, {
                                position: "absolute", transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleFactor})`,
                                transformOrigin: "0 0", imageRendering: "crisp-edges"
                            });
                        }
                    };

                    recording.onload = () => { updatePlayerState({ duration: recording.getDuration(), loading: false }); recording.seek(0, () => { if (!cancelled) readyTimeout = setTimeout(scaleDisplay, 50); }); };
                    recording.onprogress = (duration) => updatePlayerState({ duration });
                    recording.onseek = (position) => { updatePlayerState({ position }); scaleDisplay(); };
                    recording.onplay = () => updatePlayerState({ playing: true });
                    recording.onpause = () => updatePlayerState({ playing: false });
                    recording.onerror = (error) => updatePlayerState({ error: error?.message || true });
                    window.addEventListener("resize", scaleDisplay);
                    cleanup = { clear: () => window.removeEventListener("resize", scaleDisplay) };
                } else {
                    const data = await response.text();
                    if (cancelled) return;

                    const terminalPlayer = AsciinemaPlayer.create(
                        { data },
                        container,
                        { fit: false, autoPlay: false, preload: true, idleTimeLimit: 2, theme: "monokai", terminalFontFamily: "'Fira Code', monospace" }
                    );
                    playerRef.current = terminalPlayer;

                    const scaleTerminal = () => {
                        const wrapper = container?.querySelector(".ap-wrapper");
                        const terminal = container?.querySelector(".ap-term");
                        if (!wrapper || !terminal || !container) return;

                        wrapper.style.position = "absolute";
                        wrapper.style.transformOrigin = "0 0";
                        wrapper.style.left = "0";
                        wrapper.style.top = "0";

                        // layout sizes ignore the scale transform, even while it transitions
                        const containerWidth = container.clientWidth;
                        const containerHeight = container.clientHeight;
                        const terminalWidth = terminal.offsetWidth;
                        const terminalHeight = terminal.offsetHeight;

                        if (terminalWidth > 0 && terminalHeight > 0 && containerWidth > 0 && containerHeight > 0) {
                            const scaleFactor = Math.min(containerWidth / terminalWidth, containerHeight / terminalHeight);
                            const offsetX = (containerWidth - terminalWidth * scaleFactor) / 2;
                            const offsetY = (containerHeight - terminalHeight * scaleFactor) / 2;
                            wrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scaleFactor})`;
                        }
                    };

                    let resizeObserver = null;
                    const setupResizeObserver = () => {
                        const terminal = container?.querySelector(".ap-term");
                        if (terminal && !resizeObserver) {
                            resizeObserver = new ResizeObserver(scaleTerminal);
                            resizeObserver.observe(terminal);
                        }
                    };

                    const scaleInterval = setInterval(scaleTerminal, 200);

                    terminalPlayer.addEventListener("metadata", (meta) => { if (meta?.duration) updatePlayerState({ duration: meta.duration * 1000 }); });
                    terminalPlayer.addEventListener("playing", () => updatePlayerState({ playing: true }));
                    terminalPlayer.addEventListener("pause", () => updatePlayerState({ playing: false }));
                    terminalPlayer.addEventListener("ended", () => updatePlayerState({ playing: false }));
                    terminalPlayer.addEventListener("ready", () => { updatePlayerState({ loading: false }); readyTimeout = setTimeout(() => { scaleTerminal(); setupResizeObserver(); }, 50); });

                    window.addEventListener("resize", scaleTerminal);
                    const positionInterval = setInterval(async () => {
                        try {
                            const player = playerRef.current;
                            if (!player) return;
                            const [currentTime, dur] = await Promise.all([player.getCurrentTime(), player.getDuration()]);
                            if (cancelled) return;
                            const position = (currentTime || 0) * 1000;
                            const duration = (dur || 0) * 1000;
                            setState(prev => ({
                                ...prev,
                                duration: duration > 0 ? duration : prev.duration,
                                position: duration > 0 ? Math.min(position, duration) : position,
                            }));
                        } catch {}
                    }, 250);
                    cleanup = { clear: () => { window.removeEventListener("resize", scaleTerminal); clearInterval(positionInterval); clearInterval(scaleInterval); resizeObserver?.disconnect(); } };
                }
            } catch (error) {
                updatePlayerState({ error: error.message || true, loading: false });
            }
        })();

        return () => {
            cancelled = true;
            clearTimeout(readyTimeout);
            cleanup?.clear();
            const player = playerRef.current;
            if (recordingType === "guac" && player) {
                for (const event of ["onload", "onprogress", "onseek", "onplay", "onpause", "onerror"]) player[event] = null;
            }
            player?.pause?.();
            playerRef.current?.dispose?.();
            playerRef.current = null;
        };
    }, [auditLogId, recordingType]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.target.closest?.("button, input, textarea, select, [contenteditable='true']")) return;
            if (event.key === " ") { event.preventDefault(); handlePlayPause(); }
            else if (event.key === "ArrowLeft") handleSkip(-5000);
            else if (event.key === "ArrowRight") handleSkip(5000);
            else if (event.key === "f" || event.key === "F") handleFullscreen();
        };
        const handleFullscreenChange = () => updateState({ fullscreen: !!document.fullscreenElement });
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, [handlePlayPause, handleSkip, handleFullscreen]);

    return (
        <div className={`recording-player-content ${state.fullscreen ? "fullscreen" : ""}`} ref={playerContentRef}>
            <h2>{t("audit.player.title")}</h2>
            <div className="recording-display-area">
                {state.loading && <div className="loading-state"><Icon path={mdiLoading} spin size={2} /><span>{t("audit.player.loading")}</span></div>}
                {state.error && <div className="error-state"><Icon path={mdiAlertCircleOutline} size={2} /><span>{state.error === true ? t("audit.player.failed") : state.error}</span></div>}
                <div className={`display-container ${recordingType}`} ref={containerRef} style={{ display: state.loading || state.error ? "none" : "block" }} />
            </div>
            {!state.loading && !state.error && (
                <div className="recording-controls">
                    <div className="controls-left">
                        <button className="control-btn" aria-label={t("audit.player.back")} onClick={() => handleSkip(-10000)}><Icon path={mdiRewind} size={0.9} /></button>
                        <button className="control-btn play-btn" aria-label={t(state.playing ? "audit.player.pause" : "audit.player.play")} onClick={handlePlayPause}><Icon path={state.playing ? mdiPause : mdiPlay} size={1.2} /></button>
                        <button className="control-btn" aria-label={t("audit.player.forward")} onClick={() => handleSkip(10000)}><Icon path={mdiFastForward} size={0.9} /></button>
                    </div>
                    <div className="controls-center">
                        <span className="time-display">{formatTime(state.position)}</span>
                        <div className="progress-bar" onClick={handleSeek}>
                            <div className="progress-fill" style={{ width: `${state.duration > 0 ? (state.position / state.duration) * 100 : 0}%` }} />
                        </div>
                        <span className="time-display">{formatTime(state.duration)}</span>
                    </div>
                    <div className="controls-right">
                        <button className="control-btn" aria-label={t(state.fullscreen ? "audit.player.exitFullscreen" : "audit.player.enterFullscreen")} onClick={handleFullscreen}>
                            <Icon path={state.fullscreen ? mdiFullscreenExit : mdiFullscreen} size={0.9} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const RecordingPlayer = ({ auditLogId, recordingType, onClose }) => (
    <DialogProvider open={true} onClose={onClose}>
        <RecordingPlayerContent auditLogId={auditLogId} recordingType={recordingType} />
    </DialogProvider>
);
