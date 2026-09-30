import { useState, useEffect, useCallback } from "react";
import QuickAction from "@/common/components/QuickAction";
import { useKeymaps } from "@/common/contexts";
import { matchesKeybind } from "@/common/utils/keybinds.js";

export const QuickActionProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { getParsedKeybind } = useKeymaps();
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);

    useEffect(() => {
        const handleKeyDown = event => {
            const keybind = getParsedKeybind("quick-action");
            if (keybind && matchesKeybind(event, keybind)) {
                event.preventDefault();
                event.stopPropagation();
                toggle();
            }
        };
        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [toggle, getParsedKeybind]);

    return (
        <>{children}<QuickAction isOpen={isOpen} onClose={close} /></>
    );
};
