import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiKeyOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import "./styles.sass";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/common/contexts";

const MIN_LENGTH = 12;

export const PasswordChange = ({ open, onClose, accountId }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [currentPassword, setCurrentPassword] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        setCurrentPassword("");
        setPassword("");
        setConfirmPassword("");
        setError("");
    }

    const edit = setValue => value => {
        setError("");
        setValue(value);
    };

    const changePassword = async () => {
        if (password.length < MIN_LENGTH) return setError(t("settings.passwordChange.tooShort", { count: MIN_LENGTH }));
        if (password !== confirmPassword) return setError(t("settings.passwordChange.mismatch"));

        try {
            if (accountId) {
                await patchRequest(`users/${accountId}/password`, { password });
                sendToast("Success", t("settings.passwordChange.resetSuccess"));
            } else {
                await patchRequest("accounts/password", { currentPassword, password });
                sendToast("Success", t("settings.passwordChange.success"));
            }
            onClose();
        } catch (requestError) {
            setError(requestError.message || t("common.errors.generalError"));
        }
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="password-change" onKeyDown={e => e.key === "Enter" && changePassword()}>
                <h2>{t("settings.passwordChange.title")}</h2>
                <p>{t(accountId ? "settings.passwordChange.resetDescription" : "settings.passwordChange.description")}</p>
                {error && <div className="error" role="alert">{error}</div>}
                {!accountId && <div className="form-group">
                    <label htmlFor="current-password">{t("settings.passwordChange.currentPassword")}</label>
                    <IconInput icon={mdiKeyOutline} type="password" id="current-password" autoComplete="current-password"
                        value={currentPassword} setValue={edit(setCurrentPassword)} />
                </div>}
                <div className="form-group">
                    <label htmlFor="new-password">{t("settings.passwordChange.newPassword")}</label>
                    <IconInput icon={mdiKeyOutline} type="password" id="new-password" autoComplete="new-password"
                        aria-describedby="new-password-hint" value={password} setValue={edit(setPassword)} />
                    <p className="form-hint" id="new-password-hint">{t("common.hints.password", { count: MIN_LENGTH })}</p>
                </div>
                <div className="form-group">
                    <label htmlFor="confirm-password">{t("settings.passwordChange.confirmPassword")}</label>
                    <IconInput icon={mdiKeyOutline} type="password" id="confirm-password" autoComplete="new-password"
                        value={confirmPassword} setValue={edit(setConfirmPassword)} />
                </div>
                <Button text={t("settings.passwordChange.changePasswordButton")} onClick={changePassword} />
            </div>
        </DialogProvider>
    );
};
