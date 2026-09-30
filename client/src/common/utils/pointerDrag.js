export const startPointerDrag = (onMove, onEnd) => {
    const stop = (event) => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", stop);
        document.removeEventListener("pointercancel", stop);
        onEnd?.(event);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", stop);
    document.addEventListener("pointercancel", stop);
};
