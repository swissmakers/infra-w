import { useState, useCallback } from "react";

export const useContextMenu = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    // state, not a ref: ContextMenu reads it while rendering
    const [trigger, setTrigger] = useState(null);

    const open = useCallback((event, customPosition = null) => {
        event?.preventDefault();
        event?.stopPropagation();

        if (customPosition) {
            setPosition(customPosition);
        } else if (event) {
            if (event.currentTarget && event.currentTarget.getBoundingClientRect) {
                const rect = event.currentTarget.getBoundingClientRect();
                setPosition({
                    x: rect.left,
                    y: rect.bottom,
                });
                setTrigger(event.currentTarget);
            } else {
                setPosition({
                    x: event.pageX || event.clientX,
                    y: event.pageY || event.clientY,
                });
            }
        }

        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setTrigger(null);
    }, []);

    const toggle = useCallback((event) => {
        if (isOpen) {
            close();
        } else {
            open(event);
        }
    }, [isOpen, open, close]);

    return {
        isOpen,
        position,
        open,
        close,
        toggle,
        triggerRef: trigger,
    };
};
