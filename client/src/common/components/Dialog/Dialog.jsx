import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";
import "./styles.sass";
import { LAYERS } from "@/common/utils/layers.js";

const dialogStack = [];
const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const DialogProvider = ({ disableClosing, open, children, onClose, isDirty, zIndex = LAYERS.dialog }) => {
    const { t } = useTranslation();
    const id = useId();
    const areaRef = useRef(null);
    const dialogRef = useRef(null);
    const confirmRef = useRef(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const closeInner = useCallback(() => { setShowConfirm(false); onClose?.(); }, [onClose]);
    const tryClose = useCallback(() => {
        if (disableClosing) return;
        const dirty = typeof isDirty === "function" ? isDirty() : isDirty;
        if (dirty) setShowConfirm(true);
        else closeInner();
    }, [disableClosing, isDirty, closeInner]);

    useEffect(() => {
        if (!open) return;
        const previousFocus = document.activeElement;
        dialogStack.push(id);
        const root = document.getElementById("root");
        if (root) root.inert = true;
        const heading = dialogRef.current?.querySelector("h1, h2, h3");
        if (heading) {
            heading.id ||= `${id}-title`;
            dialogRef.current.setAttribute("aria-labelledby", heading.id);
            dialogRef.current.removeAttribute("aria-label");
        }
        if (areaRef.current) areaRef.current.style.zIndex = String(zIndex + dialogStack.length * 2);
        const focus = requestAnimationFrame(() => {
            const target = dialogRef.current?.querySelector('[autofocus], input:not([disabled]):not([type="hidden"]), textarea:not([disabled])') || dialogRef.current;
            target?.focus();
        });
        return () => {
            cancelAnimationFrame(focus);
            const position = dialogStack.lastIndexOf(id);
            if (position !== -1) dialogStack.splice(position, 1);
            if (root) root.inert = dialogStack.length > 0;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [open, id, zIndex]);

    useEffect(() => {
        if (showConfirm) confirmRef.current?.querySelector("button")?.focus();
    }, [showConfirm]);

    useEffect(() => {
        if (!open) return;
        const keyboard = event => {
            // floating file windows sit above workspace dialogs and handle their own keys
            if (dialogStack.at(-1) !== id || event.target.closest?.("[data-floating-windows]")) return;
            if (event.key === "Escape" && !disableClosing) {
                if (!showConfirm && dialogRef.current?.querySelector('[data-select-open="true"]')) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                if (showConfirm) { setShowConfirm(false); dialogRef.current?.focus(); }
                else tryClose();
            }
            if (event.key !== "Tab") return;
            const container = showConfirm ? confirmRef.current : dialogRef.current;
            const elements = [...(container?.querySelectorAll(focusableSelector) || [])].filter(element => element.getClientRects().length);
            if (!elements.length) { event.preventDefault(); container?.focus(); return; }
            const first = elements[0], last = elements.at(-1);
            if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
                event.preventDefault(); first.focus();
            }
        };
        document.addEventListener("keydown", keyboard, true);
        return () => document.removeEventListener("keydown", keyboard, true);
    }, [open, id, tryClose, showConfirm, disableClosing]);

    return <>
        {open && createPortal(<div className="dialog-area" ref={areaRef} style={{ zIndex }}
            onPointerDown={event => { if (event.target === event.currentTarget && dialogStack.at(-1) === id) tryClose(); }}>
            <div className="dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("enterprise.dialog")} tabIndex={-1}>
                {!disableClosing && <button type="button" className="dialog-close-btn" onClick={tryClose} aria-label={t("enterprise.closeDialog")}><Icon path={mdiClose} size={1} /></button>}
                {children}
            </div>
            {showConfirm && <div className="dialog-confirm-overlay">
                <div className="dialog-confirm" ref={confirmRef} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-confirm`} tabIndex={-1}>
                    <h3 id={`${id}-confirm`}>{t("common.confirmDialog.unsavedChangesTitle")}</h3>
                    <p>{t("common.confirmDialog.unsavedChangesText")}</p>
                    <div className="dialog-confirm-actions">
                        <button type="button" className="btn type-secondary" onClick={() => { setShowConfirm(false); dialogRef.current?.focus(); }}>{t("common.confirmDialog.keepEditing")}</button>
                        <button type="button" className="btn" onClick={closeInner}>{t("common.confirmDialog.closeWithoutSaving")}</button>
                    </div>
                </div>
            </div>}
        </div>, document.body)}
    </>;
};
