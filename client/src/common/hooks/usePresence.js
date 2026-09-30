import { useEffect, useState } from "react";

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// a timer, not transitionend, which does not fire when no property changes
export const usePresence = (open, exitMs = 200) => {
    const [mounted, setMounted] = useState(open);
    if (open && !mounted) setMounted(true);

    useEffect(() => {
        if (open || !mounted) return undefined;
        const timer = setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : exitMs);
        return () => clearTimeout(timer);
    }, [open, mounted, exitMs]);

    return mounted;
};
