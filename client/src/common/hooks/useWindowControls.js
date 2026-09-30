import { useState } from "react";
import { startPointerDrag } from "@/common/utils/pointerDrag.js";

const DEFAULT_SIZE = { width: 800, height: 600 };
const MIN_SIZE = { width: 400, height: 300 };
const CASCADE_STEP = 32;
const CASCADE_STEPS = 8;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const useWindowControls = (cascade = 0, initialSize = DEFAULT_SIZE) => {
    const [bounds, setBounds] = useState(() => {
        const width = Math.min(initialSize.width, window.innerWidth);
        const height = Math.min(initialSize.height, window.innerHeight);
        const offset = (cascade % CASCADE_STEPS) * CASCADE_STEP;
        const start = (viewport, extent) => clamp((viewport - extent) / 2 + offset, 0, viewport - extent);
        return { width, height, x: start(window.innerWidth, width), y: start(window.innerHeight, height) };
    });
    const [isMaximized, setIsMaximized] = useState(false);
    const [interaction, setInteraction] = useState(null);

    const begin = (mode) => (event) => {
        if (event.button !== 0 || isMaximized || event.target.closest("button")) return;
        const { clientX: pointerX, clientY: pointerY } = event;
        const origin = bounds;
        setInteraction(mode);
        startPointerDrag((move) => {
            const dx = move.clientX - pointerX;
            const dy = move.clientY - pointerY;
            setBounds(mode === "move"
                ? { ...origin, x: clamp(origin.x + dx, 0, window.innerWidth - origin.width), y: clamp(origin.y + dy, 0, window.innerHeight - origin.height) }
                : { ...origin, width: clamp(origin.width + dx, MIN_SIZE.width, window.innerWidth - origin.x), height: clamp(origin.height + dy, MIN_SIZE.height, window.innerHeight - origin.y) });
        }, () => setInteraction(null));
    };

    const toggleMaximize = () => setIsMaximized(!isMaximized);

    const getWindowStyle = (zIndex) => isMaximized
        ? { top: 0, left: 0, width: "100vw", height: "100vh", zIndex }
        : { top: bounds.y, left: bounds.x, width: bounds.width, height: bounds.height, zIndex };

    const getWindowClasses = (baseClass) => [baseClass, isMaximized && "maximized",
        interaction && (interaction === "move" ? "dragging" : "resizing")].filter(Boolean).join(" ");

    return {
        isMaximized,
        toggleMaximize,
        handleMovePointerDown: begin("move"),
        handleResizePointerDown: begin("resize"),
        handleHeaderDoubleClick: (event) => !event.target.closest("button") && toggleMaximize(),
        getWindowStyle,
        getWindowClasses,
    };
};
