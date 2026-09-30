import { DialogProvider } from "@/common/components/Dialog";
import InfraWLogo from "@/common/components/InfraWLogo";
import "./styles.sass";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import { mdiAccountCircleOutline, mdiKeyOutline, mdiFingerprint } from "@mdi/js";
import { useContext, useEffect, useEffectEvent, useState } from "react";
import { getRequest, request } from "@/common/utils/RequestUtil.js";
import { useTranslation } from "react-i18next";
import { startAuthentication } from "@simplewebauthn/browser";
import { getProviderIcon } from "@/common/utils/iconUtils";
import { UserContext, useToast } from "@/common/contexts";

export const LoginDialog = ({ open }) => {
    const { t } = useTranslation();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [code, setCode] = useState("");
    const [providers, setProviders] = useState([]);
    const [internalAuthEnabled, setInternalAuthEnabled] = useState(true);
    const [passkeyLoading, setPasskeyLoading] = useState(false);

    const { sendToast, showError } = useToast();

    const [totpRequired, setTotpRequired] = useState(false);

    const { updateSessionToken, firstTimeSetup } = useContext(UserContext);

    const isInternalAuthEnabled = () => {
        if (firstTimeSetup) return true;
        return internalAuthEnabled;
    };

    const handleOIDCLogin = async (event, providerId) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        try {
            const response = await request("auth/oidc/login/" + providerId, "POST");
            if (response.url) {
                window.location.href = response.url;
            }
        } catch (error) {
            showError(error, t('common.errors.ssoLoginFailed'));
        }
    };

    const loadProviders = useEffectEvent(() => getRequest("auth/providers")
        .then((providers) => {
            const internalProvider = providers.find(p => p.isInternal);
            const externalProviders = providers.filter(p => !p.isInternal && p.enabled);

            const internalAuthEnabled = internalProvider ? Boolean(internalProvider.enabled) : false;
            setInternalAuthEnabled(internalAuthEnabled);
            setProviders(externalProviders);

            if (!firstTimeSetup && externalProviders.length === 1 && !internalAuthEnabled) {
                setTimeout(() => {
                    handleOIDCLogin(null, externalProviders[0].id);
                }, 300);
            }
        })
        .catch((error) => {
            sendToast("Error", t('common.errors.loadingAuthProviders', { error: error }));
        }));

    useEffect(() => {
        if (open) {
            loadProviders();
        }
    }, [open]);

    const createAccountFirst = async () => {
        try {
            await request("accounts/register", "POST", { username, password, firstName, lastName });
            return true;
        } catch (error) {
            showError(error, t('common.errors.generalError'));
            return false;
        }
    };

    const submit = async (event) => {
        event.preventDefault();

        if (!isInternalAuthEnabled()) {
            sendToast("Error", t('common.errors.internalAuthDisabled'));
            return;
        }

        if (firstTimeSetup && !await createAccountFirst()) return;

        try {
            const { token } = await request("auth/login", "POST", {
                username,
                password,
                code: totpRequired ? code : undefined,
            });
            updateSessionToken(token);
        } catch (error) {
            if (error.code === 202) return setTotpRequired(true);
            const messages = { 201: "invalidCredentials", 203: "invalidTwoFactor", 205: "accountLocked", 403: "internalAuthDisabled" };
            sendToast("Error", messages[error.code] ? t(`common.errors.${messages[error.code]}`) : error.message || t('common.errors.generalError'));
        }
    };

    const handlePasskeyLogin = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        setPasskeyLoading(true);

        const origin = window.location.origin;

        try {
            const options = await request("auth/passkey/options", "POST", { origin });
            const credential = await startAuthentication({ optionsJSON: options });
            const result = await request("auth/passkey/verify", "POST", { response: credential, origin });
            updateSessionToken(result.token);
        } catch (error) {
            if (error.name === "NotAllowedError") sendToast("Error", t('common.errors.passkeyCancelled'));
            else if (error.code === 205) sendToast("Error", t('common.errors.accountLocked'));
            else showError(error, t('common.errors.passkeyLoginFailed'));
        } finally {
            setPasskeyLoading(false);
        }
    };

    return (
        <DialogProvider disableClosing open={open}>
            <div className="login-dialog">
                <div className="login-logo">
                    <InfraWLogo size={48} />
                    <h1>{firstTimeSetup ? t('common.loginDialog.registrationTitle') : t('common.loginDialog.title')}</h1>
                </div>
                <p className="login-description">{t("workspace.loginSubtitle")}</p>
                <form className="login-form" onSubmit={submit}>
                    {firstTimeSetup ? (
                        <div className="register-name-row">
                            <div className="form-group">
                                <label htmlFor="firstName">{t('common.labels.firstName')}</label>
                                <Input type="text" id="firstName" required icon={mdiAccountCircleOutline}
                                       placeholder={t('common.placeholders.firstName')} autoComplete="given-name"
                                       value={firstName} setValue={setFirstName} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="lastName">{t('common.labels.lastName')}</label>
                                <Input type="text" id="lastName" required icon={mdiAccountCircleOutline}
                                       placeholder={t('common.placeholders.lastName')} autoComplete="family-name"
                                       value={lastName} setValue={setLastName} />
                            </div>
                        </div>
                    ) : null}

                    {(!totpRequired && isInternalAuthEnabled()) ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="username">{t('common.labels.username')}</label>
                                <Input type="text" id="username" required icon={mdiAccountCircleOutline}
                                       placeholder={t('common.placeholders.username')} autoComplete="username"
                                       value={username} setValue={setUsername} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">{t('common.labels.password')}</label>
                                <Input type="password" id="password" required icon={mdiKeyOutline}
                                       placeholder={t('common.placeholders.password')}
                                       autoComplete={firstTimeSetup ? "new-password" : "current-password"}
                                       aria-describedby={firstTimeSetup ? "password-hint" : undefined}
                                       value={password} setValue={setPassword} />
                                {firstTimeSetup && <p className="form-hint" id="password-hint">{t("common.hints.password", { count: 12 })}</p>}
                            </div>
                        </>
                    ) : null}

                    {totpRequired ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="code">{t('common.labels.twoFACode')}</label>
                                <Input type="number" id="code" required icon={mdiKeyOutline}
                                       placeholder={t('common.placeholders.code')} autoComplete="one-time-code"
                                       value={code} setValue={setCode} />
                            </div>
                        </>
                    ) : null}

                    {isInternalAuthEnabled() ? <Button buttonType="submit" text={firstTimeSetup ? t('common.actions.register') : t('common.actions.login')} /> : null}

                    {(!firstTimeSetup && !totpRequired) ? (
                        <div className="sso-options">
                            {isInternalAuthEnabled() && (
                                <div className="divider">
                                    <span>{t('common.loginDialog.ssoOrContinueWith')}</span>
                                </div>
                            )}
                            <div className="sso-buttons">
                                <Button
                                    type="secondary"
                                    icon={mdiFingerprint}
                                    text={passkeyLoading ? t('common.loginDialog.authenticating') : t('common.loginDialog.signInWithPasskey')}
                                    onClick={handlePasskeyLogin}
                                    disabled={passkeyLoading}
                                    buttonType="button"
                                />
                                {providers.map(provider => (
                                <Button
                                    key={provider.id}
                                    type="secondary"
                                    icon={getProviderIcon(provider)}
                                    text={provider.name}
                                    onClick={(e) => handleOIDCLogin(e, provider.id)}
                                    buttonType="button"
                                />
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {(!firstTimeSetup && !isInternalAuthEnabled() && providers.length === 0) ? (
                        <p>{t('common.loginDialog.noAuthMethodsAvailable')}</p>
                    ) : null}
                </form>
                <p className="login-credit">
                    {t('common.branding.by')}{' '}
                    <a href="https://swissmakers.ch" target="_blank" rel="noopener noreferrer">Swissmakers GmbH</a>
                </p>
            </div>
        </DialogProvider>
    );
};