import "./styles.sass";
import Icon from "@mdi/react";

export const TabSwitcher = ({ tabs, activeTab, onTabChange }) => {
    const move = (event, index) => {
        const next = { ArrowRight: index + 1, ArrowLeft: index - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        const tab = tabs[(next + tabs.length) % tabs.length];
        onTabChange(tab.key);
        event.currentTarget.parentElement.children[(next + tabs.length) % tabs.length]?.focus();
    };

    return (
        <div className="tab-switcher" role="tablist">
            {tabs.map((tab, index) => (
                <button type="button" role="tab" key={tab.key} aria-selected={activeTab === tab.key}
                    tabIndex={activeTab === tab.key ? 0 : -1} className={`tab-switcher-tab${activeTab === tab.key ? " active" : ""}`}
                    onClick={() => onTabChange(tab.key)} onKeyDown={event => move(event, index)}>
                    {tab.icon && <Icon path={tab.icon} />}
                    <span>{tab.label}</span>
                </button>
            ))}
        </div>
    );
};
