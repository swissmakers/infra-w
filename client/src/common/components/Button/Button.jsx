import "./styles.sass";
import Icon from "@mdi/react";

export const Button = ({ onClick, text, icon, disabled, type, busy = false, buttonType = "button", className = "", ...attributes }) => (
    <button {...attributes} className={`btn ${className}${type ? ` type-${type}` : ""}${!text ? " icon-only" : ""}${busy ? " is-busy" : ""}`}
        onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} type={buttonType}>
        {icon && <Icon path={icon} aria-hidden="true" />}
        {text && <span className="button-label">{text}</span>}
    </button>
);
