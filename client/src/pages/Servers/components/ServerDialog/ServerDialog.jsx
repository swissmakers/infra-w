import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useContext, useEffect, useEffectEvent, useState, useMemo } from "react";
import DetailsPage from "@/pages/Servers/components/ServerDialog/pages/DetailsPage.jsx";
import Button from "@/common/components/Button";
import TabSwitcher from "@/common/components/TabSwitcher";
import { getRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import IdentityPage from "@/pages/Servers/components/ServerDialog/pages/IdentityPage.jsx";
import SettingsPage from "@/pages/Servers/components/ServerDialog/pages/SettingsPage.jsx";
import { useTranslation } from "react-i18next";
import { getAvailableTabs, validateRequiredFields, getFieldConfig } from "./utils/fieldConfig.js";
import Icon from "@mdi/react";
import * as mdiIcons from "@mdi/js";
import { ServerContext, IdentityContext, useToast } from "@/common/contexts";
import { PROTOCOLS, protocolIcon, protocolPort } from "@/common/utils/protocols.js";

export const ServerDialog = ({ open, onClose, currentFolderId, currentOrganizationId, editServerId, initialProtocol }) => {
    const { t } = useTranslation();

    const { loadServers } = useContext(ServerContext);
    const { loadIdentities } = useContext(IdentityContext);
    const { sendToast, showError } = useToast();

    const [name, setName] = useState("");
    const [icon, setIcon] = useState(null);
    const [identities, setIdentities] = useState([]);
    const [config, setConfig] = useState({});
    const [entryType, setEntryType] = useState("server");

    const [identityUpdates, setIdentityUpdates] = useState({});

    const [activeTab, setActiveTab] = useState(0);

    const [initialValues, setInitialValues] = useState({ name: '', icon: null, config: {} });

    const [formTarget, setFormTarget] = useState(null);
    if (!formTarget || formTarget.open !== open || formTarget.editServerId !== editServerId || formTarget.initialProtocol !== initialProtocol) {
        setFormTarget({ open, editServerId, initialProtocol });
        if (open) {
            if (!editServerId) {
                setName("");
                setIcon(null);
                setIdentities([]);
                setEntryType("server");

                if (initialProtocol) {
                    let initialConfig = { protocol: initialProtocol };
                    if (getFieldConfig("server", initialProtocol).showIpPort) {
                        initialConfig.port = PROTOCOLS[initialProtocol] ? String(protocolPort(initialProtocol)) : "";
                    }

                    setConfig(initialConfig);
                    const defaultIcon = PROTOCOLS[initialProtocol]?.icon || null;
                    setIcon(defaultIcon);
                    setInitialValues({
                        name: '', 
                        icon: defaultIcon, 
                        config: JSON.stringify(initialConfig)
                    });
                } else {
                    setConfig({});
                    setInitialValues({ name: '', icon: null, config: '{}' });
                }
            }

            setIdentityUpdates({});
            setActiveTab(0);
        }
    }

    const fieldConfig = getFieldConfig(entryType, config.protocol);
    const tabs = getAvailableTabs(entryType, config.protocol);

    const normalizeIdentity = (identity) => {
        const normalized = { ...identity };
        if (normalized.username === "") normalized.username = undefined;

        if (!identity.passwordTouched && normalized.password === "") normalized.password = undefined;
        if (!identity.passphraseTouched && normalized.passphrase === "") normalized.passphrase = undefined;

        if (normalized.sshKey === null) normalized.sshKey = undefined;
        return normalized;
    };

    const buildIdentityPayload = (identity) => {
        const payload = {
            name: identity.name,
            username: identity.authType === 'password-only' ? undefined : identity.username,
            type: identity.authType,
        };

        if (identity.organizationId) {
            payload.organizationId = identity.organizationId;
        }

        if (identity.authType === 'password' || identity.authType === 'password-only') {
            if (identity.passwordTouched || identity.password) {
                payload.password = identity.password;
            }
        } else if (identity.authType === 'both') {
            if (identity.passwordTouched || identity.password) {
                payload.password = identity.password;
            }
            payload.sshKey = identity.sshKey;
            if (identity.passphraseTouched || identity.passphrase) {
                payload.passphrase = identity.passphrase;
            }
        } else {
            payload.sshKey = identity.sshKey;
            if (identity.passphraseTouched || identity.passphrase) {
                payload.passphrase = identity.passphrase;
            }
        }

        return payload;
    };

    const updateIdentities = async () => {
        const allIdentityIds = new Set();

        identities.forEach(id => allIdentityIds.add(id));

        for (const identityId of Object.keys(identityUpdates)) {
            const identity = normalizeIdentity(identityUpdates[identityId]);

            if (identityId.startsWith("new-")) {
                const payload = buildIdentityPayload(identity);
                try {
                    const result = await putRequest("identities", payload);
                    if (result.id) allIdentityIds.add(result.id);
                } catch (error) {
                    showError(error, t("servers.messages.createIdentityFailed"));
                    console.error(error);
                    return null;
                }
            } else if (identity.linked) {
                allIdentityIds.add(parseInt(identityId));
            } else {
                const payload = buildIdentityPayload(identity);
                try {
                    await patchRequest("identities/" + identityId, payload);
                    allIdentityIds.add(parseInt(identityId));
                } catch (error) {
                    showError(error, t("servers.messages.updateIdentityFailed"));
                    console.error(error);
                    return null;
                }
            }
        }

        return Array.from(allIdentityIds);
    };

    const buildConfig = () => {
        const finalConfig = { ...config };

        delete finalConfig.monitoringEnabled;

        if (!fieldConfig.showIpPort) {
            delete finalConfig.ip;
            delete finalConfig.port;
            delete finalConfig.protocol;
        }

        if (!fieldConfig.showKeyboardLayout) {
            delete finalConfig.keyboardLayout;
        }

        return finalConfig;
    };

    const createServer = async () => {
        try {
            const serverIdentityIds = await updateIdentities();
            if (serverIdentityIds === null) return;

            loadIdentities();

            const result = await putRequest("entries", {
                name,
                icon,
                config: buildConfig(),
                folderId: currentFolderId,
                organizationId: currentOrganizationId,
                identities: serverIdentityIds,
                type: "server"
            });

            loadServers();
            if (result.id) {
                sendToast("Success", t("servers.messages.serverCreated"));
                onClose();
            }
        } catch (error) {
            showError(error, t("servers.messages.createFailed"));
            console.error(error);
        }
    };

    const patchServer = async () => {
        try {
            const serverIdentityIds = await updateIdentities();
            if (serverIdentityIds === null) return;

            await patchRequest("entries/" + editServerId, {
                name, icon,
                config: buildConfig(),
                identities: serverIdentityIds
            });

            loadServers();
            sendToast("Success", t("servers.messages.serverUpdated"));
            onClose();
        } catch (error) {
            showError(error, t("servers.messages.updateFailed"));
            console.error(error);
        }
    };

    const handleSubmit = () => {
        if (!validateRequiredFields(entryType, config.protocol, name, config)) {
            sendToast("Error", t("servers.messages.fillRequiredFields"));
            return;
        }
        editServerId ? patchServer() : createServer();
    };

    useEffect(() => {
        if (!open || !editServerId) return;

        getRequest("entries/" + editServerId).then((server) => {
            setName(server.name);
            setIcon(server.icon || null);
            setIdentities(server.identities);
            setEntryType(server.type || "server");

            const parsedConfig = server.config || {};
            setConfig(parsedConfig);
            setInitialValues({
                name: server.name,
                icon: server.icon || null,
                config: JSON.stringify(parsedConfig)
            });
        });
    }, [open, editServerId]);

    const handleEnterKey = useEffectEvent(() => handleSubmit());

    useEffect(() => {
        if (!open) return;

        const submitOnEnter = (event) => {
            if (event.key === "Enter") {
                handleEnterKey();
            }
        };

        document.addEventListener("keydown", submitOnEnter);

        return () => {
            document.removeEventListener("keydown", submitOnEnter);
        };
    }, [open]);

    const isDirty = name !== initialValues.name || 
                     icon !== initialValues.icon ||
                     JSON.stringify(config) !== initialValues.config ||
                     Object.keys(identityUpdates).length > 0;

    const tabSwitcherTabs = useMemo(() => tabs.map((tab, index) => ({
        key: index.toString(),
        label: t(tab.label),
        icon: tab.icon
    })), [tabs, t]);

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty}>
            <div className="server-dialog">
                <div className="server-dialog-header">
                    <div className="dialog-icon">
                        <Icon path={mdiIcons[protocolIcon(config.protocol, entryType)]} size={1} />
                    </div>
                    <div className="server-dialog-title">
                        <h2>
                            {editServerId 
                                ? t("servers.dialog.editServer") 
                                : config.protocol 
                                    ? t("servers.dialog.addProtocolServer", { protocol: config.protocol.toUpperCase() })
                                    : t("servers.dialog.addServer")
                            }
                        </h2>
                        {entryType === "server" && config.protocol && (
                            <span className="protocol-badge">{config.protocol.toUpperCase()}</span>
                        )}
                        {entryType?.startsWith('pve') && (
                            <span className="protocol-badge">
                                {entryType === 'pve-shell' ? 'PVE SHELL' : 
                                 entryType === 'pve-lxc' ? 'PVE LXC' : 
                                 entryType === 'pve-qemu' ? 'PVE QEMU' : 'PVE'}
                            </span>
                        )}
                    </div>
                </div>

                {tabs.length > 1 && (
                    <div className="server-dialog-tabs">
                        <TabSwitcher
                            tabs={tabSwitcherTabs}
                            activeTab={activeTab.toString()}
                            onTabChange={(tabKey) => setActiveTab(parseInt(tabKey))}
                        />
                    </div>
                )}

                <form className="server-dialog-content" onSubmit={(e) => e.preventDefault()} autoComplete="on">
                    {activeTab === 0 && <DetailsPage name={name} setName={setName}
                                                     icon={icon} setIcon={setIcon}
                                                     config={config} setConfig={setConfig}
                                                     fieldConfig={fieldConfig} />}
                    {activeTab === 1 && tabs[1]?.key === "identities" &&
                        <IdentityPage serverIdentities={identities} setIdentityUpdates={setIdentityUpdates}
                                      identityUpdates={identityUpdates} setIdentities={setIdentities}
                                      currentOrganizationId={currentOrganizationId} allowedAuthTypes={fieldConfig.allowedAuthTypes}
                                      serverName={name} />}
                    {tabs.find((tab, idx) => idx === activeTab && tab.key === "settings") && 
                        <SettingsPage config={config} setConfig={setConfig}
                                      fieldConfig={fieldConfig} editServerId={editServerId} />}
                </form>

                <Button className="server-dialog-button" onClick={handleSubmit}
                        text={editServerId ? t("servers.dialog.actions.save") : t("servers.dialog.actions.create")} />
            </div>

        </DialogProvider>
    );
};