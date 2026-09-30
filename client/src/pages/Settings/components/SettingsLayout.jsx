import Icon from "@mdi/react";

export const SettingsSection = ({ title, description, badge, actions, children }) => (
    <section className="settings-section">
        {(title || actions) && <header className="settings-section-header">
            {(title || description) && <div>
                {title && <h2>{title}{badge}</h2>}
                {description && <p>{description}</p>}
            </div>}
            {actions && <div className="settings-section-actions">{actions}</div>}
        </header>}
        {children && <div className="settings-section-body">{children}</div>}
    </section>
);

export const SettingsRow = ({ title, description, htmlFor, children }) => (
    <div className="settings-row">
        <div className="settings-row-text">
            <label htmlFor={htmlFor}>{title}</label>
            {description && <p>{description}</p>}
        </div>
        <div className="settings-row-control">{children}</div>
    </div>
);

export const SettingsListItem = ({ icon, title, badge, meta, actions, muted = false }) => (
    <div className={`settings-list-item${muted ? " muted" : ""}`}>
        {icon && <Icon path={icon} size={0.8} aria-hidden="true" />}
        <div className="settings-list-item-text">
            <strong>{title}{badge}</strong>
            {[meta].flat().filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
        </div>
        {actions && <div className="settings-list-item-actions">{actions}</div>}
    </div>
);
