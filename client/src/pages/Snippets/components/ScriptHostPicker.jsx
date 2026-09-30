import { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiAccountCircle, mdiPlay, mdiServer } from "@mdi/js";
import CommandPicker from "@/common/components/CommandPicker";
import { ServerContext } from "@/common/contexts";
import { flattenEntries, getOrganizationId } from "@/common/utils/inventory.js";
import { commandsForHost } from "@/common/utils/osUtils.js";
import { useIdentityName } from "@/common/hooks/useIdentityName.js";

export const ScriptHostPicker = ({ script, onClose }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { servers } = useContext(ServerContext);
    const getIdentityName = useIdentityName();
    const [host, setHost] = useState(null);
    const [shownScript, setShownScript] = useState(script);

    if (script !== shownScript) {
        setShownScript(script);
        setHost(null);
    }

    const hosts = useMemo(() => script ? flattenEntries(servers).filter(entry => entry.type === "server" && entry.protocol === "ssh"
        && entry.identities?.length > 0
        && commandsForHost([script], getOrganizationId(entry._path.find(group => group.type === "organization")), entry.osName, false).length > 0)
        : [], [servers, script]);

    const run = (entry, identityId) => {
        onClose();
        navigate(`/servers?${new URLSearchParams({ connectId: entry.id, identityId, scriptId: script.id })}`);
    };

    if (host) return <CommandPicker visible onClose={onClose} onBack={() => setHost(null)} resetKey="identity" showSearch={false}
        items={host.identities} getSearchText={getIdentityName}
        header={<>
            <div className="command-picker__title"><Icon path={mdiAccountCircle} /><span>{t("scripts.menu.selectIdentity")}</span></div>
            <div className="command-picker__context">
                <button type="button" className="command-picker__back" onClick={() => setHost(null)}>← {t("common.actions.back")}</button>
                <span>{host.name}</span>
            </div>
        </>}
        renderItem={identityId => <div className="command-picker__item--row">
            <Icon path={mdiAccountCircle} className="command-picker__item-icon" />
            <span className="command-picker__item-name">{getIdentityName(identityId)}</span>
        </div>}
        onPick={identityId => run(host, identityId)} />;

    return <CommandPicker visible={Boolean(script)} onClose={onClose} resetKey="host" items={hosts}
        placeholder={t("scripts.run.searchPlaceholder")} getSearchText={entry => `${entry.name} ${entry.ip || ""} ${entry.osName || ""}`}
        header={<>
            <div className="command-picker__title"><Icon path={mdiPlay} /><span>{t("scripts.run.title")}</span></div>
            <div className="command-picker__context">{script?.name}</div>
        </>}
        renderItem={entry => <div className="command-picker__item--row">
            <Icon path={mdiServer} className="command-picker__item-icon" />
            <div>
                <h4 className="command-picker__item-name">{entry.name}</h4>
                <p className="command-picker__item-description">{[entry.ip, entry.osName].filter(Boolean).join(" · ")}</p>
            </div>
        </div>}
        onPick={entry => entry.identities.length === 1 ? run(entry, entry.identities[0]) : setHost(entry)}
        emptyText={t("scripts.run.noHosts")} noMatchText={t("scripts.menu.noMatch")} />;
};
