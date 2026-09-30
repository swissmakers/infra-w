import { useState } from "react";
import { mdiScript, mdiAccountCircle } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import CommandPicker from "@/common/components/CommandPicker";
import { commandsForHost } from "@/common/utils/osUtils.js";

export const ScriptsMenu = ({ visible, onClose, scripts = [], server, serverOrganizationId = null, onRunScript, getIdentityName }) => {
    const { t } = useTranslation();
    const [selectedScript, setSelectedScript] = useState(null);
    const [wasVisible, setWasVisible] = useState(visible);

    if (visible !== wasVisible) {
        setWasVisible(visible);
        if (visible) setSelectedScript(null);
    }

    const available = commandsForHost(scripts, serverOrganizationId, server?.osName, server?.type?.startsWith("pve-"));
    const run = (script, identityId) => {
        onRunScript(server.id, identityId, script.id);
        onClose();
    };

    if (selectedScript) return <CommandPicker visible={visible} onClose={onClose} onBack={() => setSelectedScript(null)} resetKey="identity"
        showSearch={false} items={server?.identities || []} getSearchText={id => getIdentityName(id)}
        header={<>
            <div className="command-picker__title"><Icon path={mdiAccountCircle} /><span>{t("scripts.menu.selectIdentity")}</span></div>
            <div className="command-picker__context">
                <button type="button" className="command-picker__back" onClick={() => setSelectedScript(null)}>← {t("common.actions.back")}</button>
                <span>{selectedScript.name}</span>
            </div>
        </>}
        renderItem={identityId => <div className="command-picker__item--row">
            <Icon path={mdiAccountCircle} className="command-picker__item-icon" />
            <span className="command-picker__item-name">{getIdentityName(identityId)}</span>
        </div>}
        onPick={identityId => run(selectedScript, identityId)} />;

    return <CommandPicker visible={visible} onClose={onClose} resetKey="script" items={available}
        placeholder={t("scripts.menu.searchPlaceholder")} getSearchText={script => `${script.name} ${script.description || ""}`}
        header={<>
            <div className="command-picker__title"><Icon path={mdiScript} /><span>{t("servers.contextMenu.runScript")}</span></div>
            <div className="command-picker__context">{server?.name}</div>
        </>}
        renderItem={script => <>
            <h4 className="command-picker__item-name">{script.name}</h4>
            {script.description && <p className="command-picker__item-description">{script.description}</p>}
        </>}
        onPick={script => server?.identities?.length === 1 ? run(script, server.identities[0]) : setSelectedScript(script)}
        emptyText={t("scripts.menu.noScripts")} noMatchText={t("scripts.menu.noMatch")} />;
};
