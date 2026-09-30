import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import Input from "@/common/components/IconInput";
import { mdiAccountCircleOutline, mdiKeyOutline } from "@mdi/js";
import { useState } from "react";
import Button from "@/common/components/Button";
import { putRequest } from "@/common/utils/RequestUtil.js";
import { useTranslation } from "react-i18next";

export const CreateUserDialog = ({open, onClose, loadUsers}) => {
    const { t } = useTranslation();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");

    const submit = async (event) => {
        event.preventDefault();

        try {
            await putRequest("users", { firstName, lastName, username, password });

            loadUsers();

            onClose();
        } catch (error) {
            setError(error.message || t("settings.userDialog.errorOccurred"));
        }
    }

    const onEnter = async (event) => {
        if (event.key === "Enter") {
            await submit(event);
        }
    }

    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (!open) {
            setFirstName("");
            setLastName("");
            setUsername("");
            setPassword("");
            setError("");
        }
    }

    const edit = (setValue) => (value) => {
        setError("");
        setValue(value);
    };

    const isDirty = firstName !== '' || lastName !== '' || username !== '' || password !== '';

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty}>
            <div className="user-creation-dialog" onKeyDown={onEnter}>
                <h2>{t("settings.userDialog.title")}</h2>
                {error && <div className="error">{error}</div>}
                <div className="register-name-row">
                    <div className="form-group">
                        <label htmlFor="firstName">{t("settings.userDialog.firstName")}</label>
                        <Input type="text" id="firstName" required icon={mdiAccountCircleOutline}
                               placeholder={t("settings.userDialog.firstNamePlaceholder")} autoComplete="given-name"
                               value={firstName} setValue={edit(setFirstName)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="lastName">{t("settings.userDialog.lastName")}</label>
                        <Input type="text" id="lastName" required icon={mdiAccountCircleOutline}
                               placeholder={t("settings.userDialog.lastNamePlaceholder")} autoComplete="family-name"
                               value={lastName} setValue={edit(setLastName)} />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="username">{t("settings.userDialog.username")}</label>
                    <Input type="text" id="username" required icon={mdiAccountCircleOutline}
                           placeholder={t("settings.userDialog.usernamePlaceholder")} autoComplete="username"
                           value={username} setValue={edit(setUsername)} />
                </div>

                <div className="form-group">
                    <label htmlFor="password">{t("settings.userDialog.password")}</label>
                    <Input type="password" id="password" required icon={mdiKeyOutline}
                           placeholder={t("settings.userDialog.passwordPlaceholder")} autoComplete="new-password"
                           aria-describedby="password-hint" value={password} setValue={edit(setPassword)} />
                    <p className="form-hint" id="password-hint">{t("common.hints.password", { count: 12 })}</p>
                </div>

                <div className="btn-area">
                    <Button text={t("settings.userDialog.create")} onClick={submit} />
                </div>
            </div>
        </DialogProvider>
    )
};