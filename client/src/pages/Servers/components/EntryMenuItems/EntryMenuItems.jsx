import { useTranslation } from "react-i18next";
import { mdiAccountCircle, mdiPlay } from "@mdi/js";
import { ContextMenuItem } from "@/common/components/ContextMenu";
import { useIdentityName } from "@/common/hooks/useIdentityName.js";

export const IdentityMenuItem = ({ icon, label, identityIds, onSelect, onClose }) => {
    const getIdentityName = useIdentityName();
    if (!(identityIds?.length > 1)) return <ContextMenuItem icon={icon} label={label} onClick={() => onSelect(identityIds?.[0])} onClose={onClose} />;
    return <ContextMenuItem icon={icon} label={label} onClose={onClose}>
        {identityIds.map(id => <ContextMenuItem key={id} icon={mdiAccountCircle} label={getIdentityName(id)} onClick={() => onSelect(id)} />)}
    </ContextMenuItem>;
};

export const ResumeSessionItem = ({ sessions, formatDate, onResume, onClose }) => {
    const { t } = useTranslation();
    const label = t("servers.contextMenu.resumeSession");
    if (sessions.length === 1) return <ContextMenuItem icon={mdiPlay} label={label} onClick={() => onResume(sessions[0].id)} onClose={onClose} />;
    return <ContextMenuItem icon={mdiPlay} label={label} onClose={onClose}>
        {[...sessions].sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)).map(session =>
            <ContextMenuItem key={session.id} icon={mdiPlay} label={formatDate(session)} onClick={() => onResume(session.id)} />)}
    </ContextMenuItem>;
};
