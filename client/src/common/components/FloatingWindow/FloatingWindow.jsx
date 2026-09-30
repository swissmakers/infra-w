import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiClose, mdiResizeBottomRight, mdiWindowMaximize, mdiWindowRestore } from "@mdi/js";
import Button from "@/common/components/Button";
import { useWindowControls } from "@/common/hooks/useWindowControls.js";
import "./styles.sass";

export const FloatingWindow = ({ className, icon, title, status, actions, initialSize, zIndex, cascade, onActivate, onClose, children }) => {
    const { t } = useTranslation();
    const {
        isMaximized, toggleMaximize, handleMovePointerDown, handleResizePointerDown, handleHeaderDoubleClick,
        getWindowStyle, getWindowClasses,
    } = useWindowControls(cascade, initialSize);

    return (
        <section className={getWindowClasses(`floating-window ${className}`)} style={getWindowStyle(zIndex)}
            role="dialog" aria-label={title} onPointerDownCapture={onActivate} onFocus={onActivate}>
            <header className="floating-window-header" onPointerDown={handleMovePointerDown} onDoubleClick={handleHeaderDoubleClick}>
                <Icon path={icon} aria-hidden="true" />
                <h2>{title}</h2>
                {status}
                <div className="floating-window-actions">
                    {actions}
                    <Button icon={isMaximized ? mdiWindowRestore : mdiWindowMaximize} onClick={toggleMaximize}
                        title={isMaximized ? t("common.restore") : t("common.maximize")}
                        aria-label={isMaximized ? t("common.restore") : t("common.maximize")} />
                    <Button icon={mdiClose} onClick={onClose} title={t("common.close")} aria-label={t("common.close")} />
                </div>
            </header>
            <div className="floating-window-body">{children}</div>
            {!isMaximized && (
                <div className="floating-window-resize" onPointerDown={handleResizePointerDown} aria-hidden="true">
                    <Icon path={mdiResizeBottomRight} />
                </div>
            )}
        </section>
    );
};

export default FloatingWindow;
