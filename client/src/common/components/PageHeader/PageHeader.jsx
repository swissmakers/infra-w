import "./styles.sass";

const PageHeader = ({ eyebrow, title, subtitle, children }) => (
    <header className="page-header">
        <div className="page-header-text">
            {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
            <h1>{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {children && <div className="page-header-actions">{children}</div>}
    </header>
);

export default PageHeader;
