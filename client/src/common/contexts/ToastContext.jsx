import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import "@/common/styles/toast.sass";
import Icon from "@mdi/react";
import { mdiAlert, mdiAlertCircle, mdiCheckCircle, mdiClose, mdiInformation } from "@mdi/js";
import { ToastContext } from "@/common/contexts";

const TOAST_TYPES = {
    Success: { icon: mdiCheckCircle, label: "common.success" },
    Error: { icon: mdiAlertCircle, label: "common.error" },
    Warning: { icon: mdiAlert, label: "common.warning" },
    Info: { icon: mdiInformation, label: "common.info" },
};

export const ToastProvider = ({ children }) => {
    const { t } = useTranslation();
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts((prev) => {
            const toast = document.getElementById(id);
            if (toast) {
                toast.classList.add("toast-exit");

                setTimeout(() => {
                    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
                }, 300);

                return prev;
            }
            return prev.filter((toast) => toast.id !== id);
        });
    }, []);

    const sendToast = useCallback((title, description, icon = null, duration = 5000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const defaultIcon = (TOAST_TYPES[title] || TOAST_TYPES.Info).icon;

        setToasts((prev) => [...prev, { id, title, description, icon: icon || defaultIcon, duration }]);

        if (duration !== Infinity) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    }, [removeToast]);

    const showError = useCallback((error, fallback = t("common.errors.generalError")) =>
        sendToast("Error", error?.message || fallback), [sendToast, t]);

    return (
        <ToastContext.Provider value={{ sendToast, removeToast, showError }}>
            {children}
            {/* in <body> because open dialogs make the app root inert */}
            {createPortal(<div className="toast-container" role="region" aria-label={t("common.notifications")}>
                {toasts.map((toast) => (
                    <div key={toast.id} id={toast.id} className="toast" data-type={toast.title}
                        role={toast.title === "Error" ? "alert" : "status"}>
                        <div className="toast-icon">
                            <Icon path={toast.icon} />
                        </div>
                        <div className="toast-content">
                            {toast.title && <div className="toast-title">{TOAST_TYPES[toast.title] ? t(TOAST_TYPES[toast.title].label) : toast.title}</div>}
                            {toast.description && <div className="toast-description">{toast.description}</div>}
                        </div>
                        <button type="button" className="toast-close" aria-label={t("common.actions.close")} onClick={() => removeToast(toast.id)}>
                            <Icon path={mdiClose} />
                        </button>
                    </div>
                ))}
            </div>, document.body)}
        </ToastContext.Provider>
    );
};
