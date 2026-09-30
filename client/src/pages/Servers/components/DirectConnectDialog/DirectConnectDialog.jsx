import { DialogProvider } from "@/common/components/Dialog";
import { parseOrganizationId } from "@/common/utils/inventory.js";
import "./styles.sass";
import { useContext, useEffect, useState, useCallback, useMemo } from "react";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";
import {
    mdiAccountCircleOutline,
    mdiFileUploadOutline,
    mdiLockOutline,
} from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { getFieldConfig } from "@/pages/Servers/components/ServerDialog/utils/fieldConfig.js";
import { useToast, IdentityContext, UserContext } from "@/common/contexts";

export const DirectConnectDialog = ({ open, onClose, onConnect, server }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const { personalIdentities, organizationIdentities, getOrganizationIdentities, loadIdentities } = useContext(IdentityContext);
    const { user } = useContext(UserContext);

    const protocol = server?.config?.protocol;
    const fieldConfig = useMemo(() => getFieldConfig("server", protocol), [protocol]);
    const allowedAuthTypes = useMemo(() => fieldConfig.allowedAuthTypes || ["password", "ssh"], [fieldConfig]);
    const defaultAuthType = allowedAuthTypes[0] || "password";

    const [username, setUsername] = useState("");
    const [authType, setAuthType] = useState(defaultAuthType);
    const [password, setPassword] = useState("");
    const [sshKey, setSshKey] = useState(null);
    const [passphrase, setPassphrase] = useState("");
    const [mode, setMode] = useState("manual");
    const [selectedIdentityId, setSelectedIdentityId] = useState(null);

    const authOptions = [
        { label: t("servers.dialog.identities.userPassword"), value: "password" },
        { label: t("servers.dialog.identities.sshKey"), value: "ssh" },
    ].filter((option) => allowedAuthTypes.includes(option.value));

    const serverOrganizationId = parseOrganizationId(server?.organizationId);

    const savedIdentities = useMemo(() => {
        const orgIdentities = serverOrganizationId
            ? getOrganizationIdentities(serverOrganizationId)
            : organizationIdentities;

        return [...personalIdentities, ...orgIdentities]
            .filter((identity) => allowedAuthTypes.includes(identity.type));
    }, [allowedAuthTypes, getOrganizationIdentities, organizationIdentities, personalIdentities, serverOrganizationId]);

    const savedIdentityOptions = useMemo(() => (
        savedIdentities.map((identity) => ({
            label: `${identity.name}${identity.scope === "organization" ? ` (${t("servers.directConnect.organizationIdentity")})` : ` (${t("servers.directConnect.personalIdentity")})`}`,
            value: identity.id,
        }))
    ), [savedIdentities, t]);

    const selectedIdentity = useMemo(() => (
        savedIdentities.find((identity) => identity.id === selectedIdentityId) || null
    ), [savedIdentities, selectedIdentityId]);

    const preferredPersonalIdentity = useMemo(() => {
        const personalAuthIdentities = savedIdentities.filter((identity) => (
            identity.scope === "personal" && (identity.type === "ssh" || identity.type === "password")
        ));
        if (personalAuthIdentities.length === 0) return null;

        const normalizedUsername = (user?.username || "").trim().toLowerCase();
        if (normalizedUsername) {
            const usernameMatches = personalAuthIdentities.filter((identity) => (
                (identity.username || "").trim().toLowerCase() === normalizedUsername
            ));
            if (usernameMatches.length > 0) {
                return usernameMatches.find((identity) => identity.type === "ssh") || usernameMatches[0];
            }
        }

        return personalAuthIdentities.find((identity) => identity.type === "ssh") || personalAuthIdentities[0];
    }, [savedIdentities, user?.username]);

    const readFile = (event) => event.target.files[0]?.text().then(setSshKey);

    const validateFields = useCallback(() => {
        if (mode === "saved") {
            if (savedIdentities.length === 0) {
                sendToast("Error", t("servers.directConnect.messages.noIdentitiesAvailable"));
                return false;
            }
            if (!selectedIdentityId) {
                sendToast("Error", t("servers.directConnect.messages.identityRequired"));
                return false;
            }
            return true;
        }

        if (!username) {
            sendToast("Error", t("servers.directConnect.messages.usernameRequired"));
            return false;
        }

        if (authType === "password" && !password) {
            sendToast("Error", t("servers.directConnect.messages.passwordRequired"));
            return false;
        }

        if (authType === "ssh" && !sshKey) {
            sendToast("Error", t("servers.directConnect.messages.sshKeyRequired"));
            return false;
        }

        return true;
    }, [mode, savedIdentities.length, selectedIdentityId, authType, username, password, sshKey, sendToast, t]);

    const handleConnect = useCallback(() => {
        if (!validateFields()) return;

        if (mode === "saved") {
            onConnect({ identityId: selectedIdentityId });
            onClose();
            return;
        }

        const directIdentity = {
            username,
            type: authType,
            ...(authType === "password"
                ? { password }
                : { sshKey, passphrase: passphrase || undefined }
            ),
        };

        onConnect({ directIdentity });
        onClose();
    }, [validateFields, mode, selectedIdentityId, username, authType, password, sshKey, passphrase, onConnect, onClose]);

    useEffect(() => {
        if (open) loadIdentities();
    }, [open, loadIdentities]);

    const defaultUsername = user?.username || "";
    const [resetFor, setResetFor] = useState(null);
    if (open ? resetFor?.defaultAuthType !== defaultAuthType || resetFor?.defaultUsername !== defaultUsername : resetFor !== null) {
        setResetFor(open ? { defaultAuthType, defaultUsername } : null);
        if (open) {
            setUsername(defaultUsername);
            setAuthType(defaultAuthType);
            setPassword("");
            setSshKey(null);
            setPassphrase("");
            setMode("manual");
            setSelectedIdentityId(null);
        }
    }

    if (open && !selectedIdentityId && mode === "manual" && preferredPersonalIdentity) {
        setMode("saved");
        setSelectedIdentityId(preferredPersonalIdentity.id);
    }

    useEffect(() => {
        if (!open) return;

        const submitOnEnter = (event) => {
            if (event.key === "Enter") {
                handleConnect();
            }
        };

        document.addEventListener("keydown", submitOnEnter);

        return () => {
            document.removeEventListener("keydown", submitOnEnter);
        };
    }, [open, handleConnect]);

    const showUsername = mode === "manual";

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="direct-connect-dialog">
                <div className="direct-connect-header">
                    <h2>{t("servers.contextMenu.quickConnect")}</h2>
                </div>

                <div className="direct-connect-content">
                    <div className="identity-section">
                        <div className="form-group">
                            <label htmlFor="direct-identity-source">{t("servers.directConnect.identitySource")}</label>
                            <SelectBox id="direct-identity-source"
                                options={[
                                    { label: t("servers.directConnect.manual"), value: "manual" },
                                    { label: t("servers.directConnect.savedIdentity"), value: "saved" },
                                ]}
                                selected={mode}
                                setSelected={setMode}
                            />
                        </div>

                        {mode === "saved" && (
                            <div className="form-group">
                                <label htmlFor="direct-identity">{t("servers.directConnect.identitySelection")}</label>
                                <SelectBox id="direct-identity"
                                    options={savedIdentityOptions}
                                    selected={selectedIdentityId}
                                    setSelected={setSelectedIdentityId}
                                    placeholder={t("servers.directConnect.identityPlaceholder")}
                                />
                                {selectedIdentity && (
                                    <span className="identity-hint">
                                        {t("servers.directConnect.usingIdentity", { name: selectedIdentity.name })}
                                    </span>
                                )}
                                {savedIdentities.length === 0 && (
                                    <span className="identity-hint">
                                        {t("servers.directConnect.messages.noIdentitiesAvailable")}
                                    </span>
                                )}
                            </div>
                        )}

                        {mode === "manual" && (
                        <div className={`name-row ${!showUsername ? 'single-column' : ''}`}>
                            {showUsername && (
                                <div className="form-group">
                                    <label htmlFor="username">{t("servers.dialog.fields.username")}</label>
                                    <Input
                                        icon={mdiAccountCircleOutline}
                                        type="text"
                                        placeholder={t("servers.dialog.placeholders.username")}
                                        autoComplete="off"
                                        value={username}
                                        setValue={setUsername}
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="direct-auth">{t("servers.dialog.identities.authentication")}</label>
                                <SelectBox id="direct-auth"
                                    options={authOptions}
                                    selected={authType}
                                    setSelected={setAuthType}
                                />
                            </div>
                        </div>
                        )}

                        {mode === "manual" && authType === "password" && (
                            <div className="form-group">
                                <label htmlFor="password">{t("servers.dialog.fields.password")}</label>
                                <Input
                                    icon={mdiLockOutline}
                                    type="password"
                                    placeholder={t("servers.dialog.placeholders.password")}
                                    autoComplete="off"
                                    value={password}
                                    setValue={setPassword}
                                />
                            </div>
                        )}

                        {mode === "manual" && authType === "ssh" && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="keyfile">{t("servers.dialog.identities.sshPrivateKey")}</label>
                                    <Input
                                        icon={mdiFileUploadOutline}
                                        type="file"
                                        autoComplete="off"
                                        onChange={readFile}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="passphrase">{t("servers.dialog.identities.passphrase")}</label>
                                    <Input
                                        icon={mdiLockOutline}
                                        type="password"
                                        placeholder={t("servers.dialog.identities.passphrase")}
                                        autoComplete="off"
                                        value={passphrase}
                                        setValue={setPassphrase}
                                    />
                                </div>

                                <span className="identity-note">
                                    {t("servers.directConnect.messages.sshIdentityHint")}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <Button
                    className="direct-connect-button"
                    onClick={handleConnect}
                    text={t("servers.contextMenu.connect")}
                />
            </div>
        </DialogProvider>
    );
};
