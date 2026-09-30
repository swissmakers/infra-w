import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@mdi/react";
import { mdiMagnify } from "@mdi/js";
import { usePresence } from "@/common/hooks/usePresence.js";
import "./styles.sass";

export const CommandPicker = ({ visible, onClose, onBack, resetKey, header, placeholder, items, getSearchText, renderItem,
                                  onPick, emptyText, noMatchText, showSearch = true }) => {
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isPositioned, setIsPositioned] = useState(false);
    const [step, setStep] = useState({ visible, resetKey });
    const isVisible = usePresence(visible);
    const searchRef = useRef(null);
    const menuRef = useRef(null);
    const itemRefs = useRef([]);
    const headerId = useId();

    if (step.visible !== visible || step.resetKey !== resetKey) {
        setStep({ visible, resetKey });
        setSearch("");
        setHighlightedIndex(-1);
        if (!visible) setIsPositioned(false);
    }

    const query = search.trim().toLowerCase();
    const filtered = query ? items.filter(item => getSearchText(item).toLowerCase().includes(query)) : items;

    useEffect(() => {
        if (!visible) return;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setIsPositioned(true);
            (searchRef.current || menuRef.current)?.focus();
        }));
    }, [visible, resetKey]);

    const highlight = useCallback(index => {
        setHighlightedIndex(index);
        itemRefs.current[index]?.focus();
        itemRefs.current[index]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, []);

    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                (onBack || onClose)();
            } else if (event.key === "Backspace" && onBack && !search) {
                event.preventDefault();
                onBack();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                if (!filtered.length) return;
                event.preventDefault();
                const delta = event.key === "ArrowDown" ? 1 : -1;
                highlight(highlightedIndex === -1 ? (delta > 0 ? 0 : filtered.length - 1)
                    : (highlightedIndex + delta + filtered.length) % filtered.length);
            } else if (event.key === "Enter" && filtered[highlightedIndex]) {
                event.preventDefault();
                onPick(filtered[highlightedIndex]);
            }
        };
        const handleClickOutside = event => menuRef.current && !menuRef.current.contains(event.target) && onClose();

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [visible, filtered, highlightedIndex, search, onBack, onClose, onPick, highlight]);

    if (!isVisible) return null;

    return createPortal(
        <div className="command-picker-overlay">
            <div ref={menuRef} className={`command-picker ${visible && isPositioned ? "open" : "closed"}`} role="dialog" aria-modal="true"
                aria-labelledby={header ? headerId : undefined} tabIndex={-1}>
                {header && <div className="command-picker__header" id={headerId}>{header}</div>}
                {showSearch && <div className="command-picker__search">
                    <Icon path={mdiMagnify} />
                    <input ref={searchRef} type="text" placeholder={placeholder} aria-label={placeholder} value={search}
                        onChange={event => { setSearch(event.target.value); setHighlightedIndex(-1); }} />
                </div>}
                <div className="command-picker__content">
                    {filtered.length === 0
                        ? <p className="command-picker__no-results">{items.length === 0 ? emptyText : noMatchText}</p>
                        : <div className="command-picker__list" role="listbox" aria-labelledby={header ? headerId : undefined}>
                            {filtered.map((item, index) => (
                                <div key={item.id ?? item} ref={element => (itemRefs.current[index] = element)} role="option"
                                    aria-selected={highlightedIndex === index} tabIndex={-1}
                                    className={`command-picker__item${highlightedIndex === index ? " highlighted" : ""}`}
                                    onClick={() => onPick(item)} onMouseEnter={() => setHighlightedIndex(index)}>
                                    {renderItem(item)}
                                </div>
                            ))}
                        </div>}
                </div>
            </div>
        </div>,
        document.body,
    );
};
