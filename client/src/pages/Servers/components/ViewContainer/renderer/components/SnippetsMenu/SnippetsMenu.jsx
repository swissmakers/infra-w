import { useContext } from "react";
import { mdiLinux } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import CommandPicker from "@/common/components/CommandPicker";
import { parseOsFilter, commandsForHost } from "@/common/utils/osUtils.js";
import { useSnippets, ServerContext } from "@/common/contexts";

const SnippetItem = ({ snippet }) => {
    const osFilter = parseOsFilter(snippet.osFilter);
    return <>
        <div className="command-picker__item-header">
            <h4 className="command-picker__item-name">{snippet.name}</h4>
            {osFilter.length > 0 && <span className="command-picker__os-badge" title={osFilter.join(", ")}>
                <Icon path={mdiLinux} size={0.5} />{osFilter.length === 1 ? osFilter[0] : `${osFilter.length} OS`}
            </span>}
        </div>
        {snippet.description && <p className="command-picker__item-description">{snippet.description}</p>}
        <pre className="command-picker__item-command">{snippet.command}</pre>
    </>;
};

export const SnippetsMenu = ({ onSelect, onClose, visible, activeSession }) => {
    const { t } = useTranslation();
    const { allSnippets } = useSnippets();
    const { getServerById } = useContext(ServerContext);
    // the session's copy of the server predates OS detection
    const osName = getServerById(activeSession?.server?.id)?.osName || null;
    const snippets = commandsForHost(allSnippets, activeSession?.organizationId || null, osName, activeSession?.server?.type?.startsWith("pve-"));

    return <CommandPicker visible={visible} onClose={onClose} items={snippets} placeholder={t("servers.snippetsMenu.search")}
        getSearchText={snippet => `${snippet.name} ${snippet.command} ${snippet.description || ""}`}
        renderItem={snippet => <SnippetItem snippet={snippet} />}
        onPick={snippet => { onSelect(snippet.command); onClose(); }}
        emptyText={t("servers.snippetsMenu.empty")} noMatchText={t("servers.snippetsMenu.noMatch")} />;
};
