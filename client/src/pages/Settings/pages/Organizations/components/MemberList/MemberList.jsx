import { useState } from "react";
import { mdiAccountArrowDownOutline, mdiAccountArrowUpOutline, mdiAccountRemoveOutline, mdiCrownOutline } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { deleteRequest, patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { useToast } from "@/common/contexts";

const ROLE_RANK = { member: 1, manager: 2, owner: 3 };

export const MemberList = ({ members, organizationId, myRole, refreshMembers, refreshOrganizations }) => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const [pending, setPending] = useState(null);
    const isOwner = myRole === "owner";
    const text = (key, values) => t(`settings.organizations.${key}`, values);

    const run = (request, successKey, failureKey, after = refreshMembers) => request()
        .then(() => {
            sendToast("Success", text(successKey));
            return after();
        })
        .catch(error => showError(error, text(failureKey)));

    const actionsFor = (member) => {
        const actions = [];
        const active = member.status === "active";
        if (isOwner && active && member.role !== "owner") {
            const promote = member.role === "member";
            actions.push(<Button key="role" icon={promote ? mdiAccountArrowUpOutline : mdiAccountArrowDownOutline}
                title={text(promote ? "makeManager" : "makeMember")} aria-label={text(promote ? "makeManagerFor" : "makeMemberFor", { name: member.name })}
                onClick={() => run(() => patchRequest(`organizations/${organizationId}/members/${member.accountId}`, { role: promote ? "manager" : "member" }),
                    "roleChanged", "roleChangeFailed")} />);
            actions.push(<Button key="transfer" icon={mdiCrownOutline} title={text("transferOwnership")}
                aria-label={text("transferOwnershipTo", { name: member.name })}
                onClick={() => setPending({ text: text("transferConfirm", { name: member.name }),
                    run: () => run(() => postRequest(`organizations/${organizationId}/transfer`, { accountId: member.accountId }),
                        "ownershipTransferred", "transferFailed", () => Promise.all([refreshMembers(), refreshOrganizations()])) })} />);
        }
        if (ROLE_RANK[myRole] >= ROLE_RANK.manager && ROLE_RANK[member.role] < ROLE_RANK[myRole]) {
            actions.push(<Button key="remove" icon={mdiAccountRemoveOutline} title={text("removeMember")}
                aria-label={text("removeMemberFor", { name: member.name })}
                onClick={() => setPending({ text: text("removeMemberConfirm", { name: member.name }),
                    run: () => run(() => deleteRequest(`organizations/${organizationId}/members/${member.accountId}`), "memberRemoved", "memberRemoveFailed") })} />);
        }
        return actions;
    };

    return (
        <div className="member-list">
            {members.map((member) => (
                <div key={member.accountId} className="org-row">
                    <span className="org-row-text">
                        <strong className="org-row-title">
                            {member.name}
                            <span className="settings-status">{t(`settings.organizations.roles.${member.role}`, { defaultValue: member.role })}</span>
                            {member.status === "pending" && <span className="settings-status warning">{t("settings.organizations.invitationPending")}</span>}
                        </strong>
                        <span className="org-row-meta">{member.username}</span>
                    </span>
                    {actionsFor(member)}
                </div>
            ))}
            <ActionConfirmDialog open={pending !== null} setOpen={open => !open && setPending(null)} onConfirm={() => pending?.run()} text={pending?.text} />
        </div>
    );
};
