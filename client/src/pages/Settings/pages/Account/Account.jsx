import "./styles.sass";
import { mdiAccountCircleOutline, mdiKeyVariant, mdiPencil, mdiTrashCan, mdiPlus } from "@mdi/js";
import { useContext, useEffect, useState } from "react";
import IconInput from "@/common/components/IconInput";
import Button from "@/common/components/Button";
import { patchRequest, postRequest, getRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import TwoFactorAuthentication from "@/pages/Settings/pages/Account/dialogs/TwoFactorAuthentication";
import PasswordChange from "@/pages/Settings/pages/Account/dialogs/PasswordChange";
import AddPasskeyDialog from "@/pages/Settings/pages/Account/dialogs/AddPasskeyDialog";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { startRegistration } from "@simplewebauthn/browser";
import { useTranslation } from "react-i18next";
import { SettingsSection, SettingsRow, SettingsListItem } from "@/pages/Settings/components/SettingsLayout.jsx";
import { UserContext, useToast } from "@/common/contexts";
import { formatDay } from "@/common/utils/formatUtils.js";

export const Account = () => {
    const { t } = useTranslation();
    const [twoFactorOpen, setTwoFactorOpen] = useState(false);
    const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
    const [addPasskeyOpen, setAddPasskeyOpen] = useState(false);
    const [passkeyToDelete, setPasskeyToDelete] = useState(null);
    const [passkeys, setPasskeys] = useState([]);
    const [editingPasskeyId, setEditingPasskeyId] = useState(null);
    const [editingPasskeyName, setEditingPasskeyName] = useState("");
    const { user, login } = useContext(UserContext);
    const { sendToast } = useToast();
    const [updatedField, setUpdatedField] = useState(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [nameSource, setNameSource] = useState(null);

    if (user && user !== nameSource) {
        setNameSource(user);
        setFirstName(user.firstName ?? "");
        setLastName(user.lastName ?? "");
    }

    const updateName = (config) => {
        const [field, value] = Object.entries(config)[0];
        if (value === (user[field] ?? "")) return;
        patchRequest("accounts/name", config).then(() => {
            login();
            setUpdatedField(field);
            setTimeout(() => setUpdatedField(null), 1500);
        }).catch(() => sendToast("Error", t("common.errors.generalError")));
    };

    const disable2FA = () => postRequest("accounts/totp/disable").then(() => login())
        .catch(() => sendToast("Error", t("common.errors.generalError")));

    const loadPasskeys = () => getRequest("accounts/passkeys").then(setPasskeys).catch(() => setPasskeys([]));

    const addPasskey = async (name) => {
        setAddPasskeyOpen(false);
        try {
            const origin = window.location.origin;
            const optionsRes = await postRequest("accounts/passkeys/register/options", { origin });
            const attestationResponse = await startRegistration({ optionsJSON: optionsRes });
            await postRequest("accounts/passkeys/register/verify", { response: attestationResponse, name, origin });
            loadPasskeys();
        } catch (err) {
            if (err.name !== "NotAllowedError") sendToast("Error", t("settings.account.passkeys.registerError"));
        }
    };

    const deletePasskey = async () => {
        if (!passkeyToDelete) return;
        await deleteRequest(`accounts/passkeys/${passkeyToDelete.id}`).catch(() => sendToast("Error", t("common.errors.generalError")));
        setPasskeyToDelete(null);
        loadPasskeys();
    };

    const savePasskeyName = async () => {
        if (!editingPasskeyName.trim()) return;
        await patchRequest(`accounts/passkeys/${editingPasskeyId}`, { name: editingPasskeyName })
            .catch(() => sendToast("Error", t("common.errors.generalError")));
        setEditingPasskeyId(null);
        loadPasskeys();
    };

    useEffect(() => {
        if (!user) return;
        loadPasskeys();
    }, [user]);

    return (
        <div className="account-page">
            <TwoFactorAuthentication open={twoFactorOpen} onClose={() => setTwoFactorOpen(false)} />
            <PasswordChange open={passwordChangeOpen} onClose={() => setPasswordChangeOpen(false)} />
            <AddPasskeyDialog open={addPasskeyOpen} onClose={() => setAddPasskeyOpen(false)} onSubmit={addPasskey} />
            <ActionConfirmDialog open={passkeyToDelete !== null} setOpen={open => !open && setPasskeyToDelete(null)}
                onConfirm={deletePasskey} text={t("settings.account.passkeys.confirmDelete")} />

            <SettingsSection title={t("settings.account.accountName")}>
                <div className="account-name-fields">
                    {[["firstName", firstName, setFirstName], ["lastName", lastName, setLastName]].map(([field, value, setValue]) =>
                        <div className="form-group" key={field}>
                            <label htmlFor={field}>{t(`settings.account.${field}`)}</label>
                            <IconInput icon={mdiAccountCircleOutline} placeholder={t(`settings.account.${field}`)} id={field}
                                customClass={updatedField === field ? " fd-updated" : ""} value={value} setValue={setValue}
                                onBlur={event => updateName({ [field]: event.target.value })} />
                        </div>)}
                </div>
            </SettingsSection>

            <SettingsSection title={t("settings.account.signInSecurity")}>
                {user?.authProviderType === "internal" && <SettingsRow title={t("settings.account.changePassword")}
                    description={t("settings.account.changePasswordDescription")}>
                    <Button type="secondary" text={t("settings.account.changePasswordButton")} onClick={() => setPasswordChangeOpen(true)} />
                </SettingsRow>}
                <SettingsRow title={<>{t("settings.account.twoFactor")} <span className={`settings-status ${user?.totpEnabled ? "positive" : ""}`}>
                    {t(user?.totpEnabled ? "settings.account.twoFactorActive" : "settings.account.twoFactorInactive")}</span></>}
                    description={t("settings.account.twoFactorDescription")}>
                    {user?.totpEnabled
                        ? <Button type="secondary" text={t("settings.account.disable2FA")} onClick={disable2FA} />
                        : <Button text={t("settings.account.enable2FA")} onClick={() => setTwoFactorOpen(true)} />}
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title={t("settings.account.passkeys.sectionTitle")} description={t("settings.account.passkeys.sectionDescription")}
                actions={<Button type="secondary" text={t("settings.account.passkeys.addButton")} icon={mdiPlus} onClick={() => setAddPasskeyOpen(true)} />}>
                {passkeys.length === 0 ? <p className="settings-empty">{t("settings.account.passkeys.noPasskeys")}</p>
                    : passkeys.map(passkey => <SettingsListItem key={passkey.id} icon={mdiKeyVariant}
                        title={editingPasskeyId === passkey.id
                            ? <input type="text" value={editingPasskeyName} autoFocus className="passkey-name-input"
                                aria-label={t("settings.account.passkeys.rename")}
                                onChange={event => setEditingPasskeyName(event.target.value)} onBlur={savePasskeyName}
                                onKeyDown={event => {
                                    if (event.key === "Enter") savePasskeyName();
                                    if (event.key === "Escape") setEditingPasskeyId(null);
                                }} />
                            : passkey.name}
                        meta={t("settings.account.passkeys.createdAt", {
                            date: formatDay(passkey.createdAt), interpolation: { escapeValue: false },
                        })}
                        actions={<>
                            <Button icon={mdiPencil} title={t("settings.account.passkeys.rename")} aria-label={t("settings.account.passkeys.rename")}
                                onClick={() => { setEditingPasskeyId(passkey.id); setEditingPasskeyName(passkey.name); }} />
                            <Button icon={mdiTrashCan} title={t("settings.account.passkeys.delete")} aria-label={t("settings.account.passkeys.delete")}
                                onClick={() => setPasskeyToDelete(passkey)} />
                        </>} />)}
            </SettingsSection>
        </div>
    );
};
