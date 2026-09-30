import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DialogProvider } from "@/common/components/Dialog";
import UserSearch from "@/common/components/UserSearch";
import Button from "@/common/components/Button";
import { postRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";
import { useToast } from "@/common/contexts";

export const InviteMemberDialog = ({ open, onClose, organization, refreshMembers }) => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const [username, setUsername] = useState("");

    const handleInvite = async (e) => {
        e.preventDefault();

        if (!username.trim()) {
            sendToast("Error", t("settings.organizations.inviteDialog.usernameRequired"));
            return;
        }

        try {
            await postRequest(`organizations/${organization.id}/invite`, {
                username: username.trim(),
            });

            sendToast("Success", t("settings.organizations.inviteDialog.sent"));
            refreshMembers();

            onClose();
        } catch (error) {
            showError(error, t("settings.organizations.inviteDialog.failed"));
        }
    };

    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setUsername("");
    }

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="invite-member-dialog">
                <h2>{t("settings.organizations.inviteDialog.title")}</h2>
                <p className="subtitle">{t("settings.organizations.inviteDialog.subtitle", { name: organization.name })}</p>

                <form onSubmit={handleInvite}>
                    <div className="form-group">
                        <label htmlFor="invite-username">{t("settings.organizations.inviteDialog.username")}</label>
                        <UserSearch 
                            id="invite-username"
                            value={username}
                            onChange={setUsername}
                            onSelect={(user) => setUsername(user.username)}
                            placeholder={t("settings.organizations.inviteDialog.placeholder")}
                            required
                        />
                    </div>

                    <div className="dialog-actions">
                        <Button text={t("common.actions.cancel")} onClick={onClose} type="secondary" />
                        <Button text={t("settings.organizations.inviteDialog.send")} buttonType="submit" />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};