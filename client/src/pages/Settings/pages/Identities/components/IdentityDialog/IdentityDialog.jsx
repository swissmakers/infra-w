import { DialogProvider } from "@/common/components/Dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import {
    mdiAccountCircleOutline,
    mdiFileUploadOutline,
    mdiLockOutline,
} from "@mdi/js";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import "./styles.sass";
import { useToast } from "@/common/contexts";

export const IdentityDialog = ({ open, onClose, identity, organizationId }) => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const isEditing = !!identity;

    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [authType, setAuthType] = useState("password");
    const [password, setPassword] = useState("");
    const [sshKey, setSshKey] = useState(null);
    const [passphrase, setPassphrase] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const normalizeAuthType = (value) => (value === "ssh" ? "ssh" : "password");

    const [initialValues, setInitialValues] = useState({ name: '', username: '', authType: 'password', password: '', sshKey: null, passphrase: '' });
    const [formSource, setFormSource] = useState({ open: false, identity: null });

    const resetForm = () => {
        setName("");
        setUsername("");
        setAuthType("password");
        setPassword("");
        setSshKey(null);
        setPassphrase("");
        setInitialValues({ name: '', username: '', authType: 'password', password: '', sshKey: null, passphrase: '' });
    };

    if (formSource.open !== open || formSource.identity !== identity) {
        setFormSource({ open, identity });
        if (open) {
            if (isEditing) {
                setName(identity.name || "");
                setUsername(identity.username || "");
                setAuthType(normalizeAuthType(identity.type || "password"));
                setPassword("********");
                setSshKey(identity.sshKey || null);
                setPassphrase("********");
                setInitialValues({
                    name: identity.name || '',
                    username: identity.username || '',
                    authType: normalizeAuthType(identity.type || 'password'),
                    password: '********',
                    sshKey: identity.sshKey || null,
                    passphrase: '********'
                });
            } else {
                resetForm();
            }
        }
    }

    const readFile = (event) => event.target.files[0]?.text().then(setSshKey);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            sendToast("Error", t('settings.identities.dialog.messages.nameRequired'));
            return;
        }

        if (!username.trim()) {
            sendToast("Error", t("servers.directConnect.messages.usernameRequired"));
            return;
        }

        if (authType === "password" && !password && !isEditing) {
            sendToast("Error", t('settings.identities.dialog.messages.passwordRequired'));
            return;
        }

        if (authType === "ssh" && !sshKey && !isEditing) {
            sendToast("Error", t('settings.identities.dialog.messages.sshKeyRequired'));
            return;
        }

        setIsLoading(true);

        try {
            const identityData = {
                name: name.trim(),
                username: username.trim() || undefined,
                type: authType,
                ...(authType === "password"
                        ? { password: password === "********" ? undefined : password }
                        : {
                            sshKey: sshKey || undefined,
                            ...(passphrase && passphrase !== "********" ? { passphrase } : {}),
                        }
                ),
            };

            if (isEditing) {
                await patchRequest(`identities/${identity.id}`, identityData);
                sendToast("Success", t('settings.identities.dialog.messages.updateSuccess'));
            } else {
                if (organizationId) {
                    identityData.organizationId = organizationId;
                }
                await putRequest("identities", identityData);
                sendToast("Success", t('settings.identities.dialog.messages.createSuccess'));
            }

            onClose();
        } catch (error) {
            showError(error, t(`settings.identities.dialog.messages.${isEditing ? 'updateFailed' : 'createFailed'}`));
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = (event) => {
        if (event) event.preventDefault();
        onClose();
    };

    const isDirty = name !== initialValues.name || 
                     username !== initialValues.username || 
                     authType !== initialValues.authType ||
                     password !== initialValues.password || 
                     sshKey !== initialValues.sshKey || 
                     passphrase !== initialValues.passphrase;

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty}>
            <div className="identity-dialog">
                <h2>{isEditing ? t('settings.identities.dialog.editTitle') : t('settings.identities.dialog.createTitle')}</h2>

                <form onSubmit={handleSubmit}>
                    <div className="dialog-content">
                        <div className="form-group">
                            <label htmlFor="name">{t('settings.identities.dialog.fields.name')}</label>
                            <IconInput icon={mdiAccountCircleOutline} value={name} setValue={setName}
                                       placeholder={t('settings.identities.dialog.fields.namePlaceholder')} id="name" required />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="username">{t('settings.identities.dialog.fields.username')}</label>
                                <IconInput icon={mdiAccountCircleOutline} value={username} setValue={setUsername}
                                           placeholder={t('settings.identities.dialog.fields.usernamePlaceholder')} id="username" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="authType">{t('settings.identities.dialog.fields.authType')}</label>
                                <SelectBox selected={authType} setSelected={setAuthType}
                                           options={[
                                               { label: t('settings.identities.dialog.authTypes.password'), value: "password" },
                                               { label: t('settings.identities.dialog.authTypes.ssh'), value: "ssh" },
                                           ]} />
                            </div>
                        </div>

                        {authType === "password" && (
                            <div className="form-group">
                                <label htmlFor="password">{t('settings.identities.dialog.fields.password')}</label>
                                <IconInput icon={mdiLockOutline} type="password" value={password} setValue={setPassword}
                                           placeholder={isEditing ? t('settings.identities.dialog.fields.passwordPlaceholderEdit') : t('settings.identities.dialog.fields.passwordPlaceholder')}
                                           id="password" name="password" required={!isEditing && authType === "password"} autoComplete="new-password" />
                            </div>
                        )}

                        {authType === "ssh" && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="sshKey">{t('settings.identities.dialog.fields.sshKey')}</label>
                                    <IconInput icon={mdiFileUploadOutline} type="file" onChange={readFile} id="sshKey"
                                               required={!isEditing} />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="passphrase">{t('settings.identities.dialog.fields.passphrase')}</label>
                                    <IconInput icon={mdiLockOutline} type="password" value={passphrase}
                                               setValue={setPassphrase}
                                               placeholder={isEditing ? t('settings.identities.dialog.fields.passphrasePlaceholderEdit') : t('settings.identities.dialog.fields.passphrasePlaceholder')}
                                               id="passphrase" name="passphrase" autoComplete="new-password" />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="dialog-actions">
                        <Button text={t('settings.identities.dialog.actions.cancel')} onClick={handleClose} type="secondary" buttonType="button" />
                        <Button text={isEditing ? t('settings.identities.dialog.actions.update') : t('settings.identities.dialog.actions.create')} buttonType="submit"
                                disabled={isLoading} />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};
