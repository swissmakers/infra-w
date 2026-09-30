import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Input from "@/common/components/IconInput";
import {
    mdiAccountMultiple,
    mdiChevronDown,
    mdiChevronRight,
    mdiDomain,
    mdiFormTextbox,
    mdiKey,
    mdiKeyChain,
    mdiLink,
    mdiAccountGroup,
    mdiClose,
    mdiPlus,
} from "@mdi/js";
import SelectBox from "@/common/components/SelectBox";
import Button from "@/common/components/Button";
import Icon from "@mdi/react";
import { patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast, useOrganizations } from "@/common/contexts";

// the server never returns the secret, this placeholder keeps the stored one
const SECRET_UNCHANGED = "********";

const toForm = (provider) => provider ? {
    name: provider.name, issuer: provider.issuer, clientId: provider.clientId, clientSecret: SECRET_UNCHANGED,
    redirectUri: provider.redirectUri, scope: provider.scope, usernameAttribute: provider.usernameAttribute,
    firstNameAttribute: provider.firstNameAttribute, lastNameAttribute: provider.lastNameAttribute,
    groupsClaim: provider.groupsClaim || "groups", adminGroupsText: (provider.adminGroups || []).join("\n"),
    organizationGroups: provider.organizationGroups || [],
} : {
    name: "", issuer: "", clientId: "", clientSecret: "", redirectUri: `${window.location.origin}/api/auth/oidc/callback`,
    scope: "openid profile", usernameAttribute: "preferred_username", firstNameAttribute: "given_name", lastNameAttribute: "family_name",
    groupsClaim: "groups", adminGroupsText: "", organizationGroups: [],
};

const MAIN_FIELDS = [
    ["name", "displayName", mdiFormTextbox], ["issuer", "issuerUrl", mdiDomain, "url"], ["clientId", "clientId", mdiKey],
    ["clientSecret", "clientSecret", mdiKeyChain, "password"], ["redirectUri", "redirectUri", mdiLink, "url"], ["scope", "scope", mdiAccountMultiple],
];
const ADVANCED_FIELDS = [
    ["usernameAttribute", "usernameAttribute", mdiAccountMultiple], ["firstNameAttribute", "firstNameAttribute", mdiFormTextbox],
    ["lastNameAttribute", "lastNameAttribute", mdiFormTextbox],
];

export const OidcProviderDialog = ({ open, onClose, provider, onSave }) => {
    const { t } = useTranslation();
    const { showError } = useToast();
    const { organizations } = useOrganizations();
    const T = (key) => t(`settings.authentication.providerDialog.${key}`);
    const [form, setForm] = useState(() => toForm(provider));
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [formSource, setFormSource] = useState({ provider, open });

    if (formSource.provider !== provider || formSource.open !== open) {
        setFormSource({ provider, open });
        setForm(toForm(provider));
        setShowAdvanced(false);
    }

    const setMapping = (index, changes) => setForm(prev => ({ ...prev,
        organizationGroups: prev.organizationGroups.map((mapping, position) => position === index ? { ...mapping, ...changes } : mapping) }));

    const handleSubmit = async () => {
        const { clientSecret, adminGroupsText, organizationGroups, ...fields } = form;
        const data = { ...fields, adminGroups: adminGroupsText.split("\n").map(group => group.trim()).filter(Boolean),
            organizationGroups: organizationGroups.filter(mapping => mapping.group.trim() && mapping.organizationId)
                .map(mapping => ({ group: mapping.group.trim(), organizationId: mapping.organizationId })) };
        if (clientSecret && clientSecret !== SECRET_UNCHANGED) data.clientSecret = clientSecret;
        try {
            if (provider) await patchRequest(`auth/providers/admin/oidc/${provider.id}`, data);
            else await putRequest("auth/providers/admin/oidc", { ...data, enabled: true });
            onSave();
            onClose();
        } catch (error) {
            showError(error, T("messages.saveFailed"));
        }
    };

    const renderField = ([key, labelKey, icon, type = "text"]) => {
        const placeholder = key === "clientSecret" && provider ? T("fields.clientSecretPlaceholderEdit") : T(`fields.${labelKey}Placeholder`);
        return <div className="form-group" key={key}>
            <label htmlFor={`oidc-${key}`}>{T(`fields.${labelKey}`)}</label>
            <Input icon={icon} type={type} id={`oidc-${key}`} placeholder={placeholder} value={form[key]}
                setValue={(value) => setForm(prev => ({ ...prev, [key]: value }))} />
        </div>;
    };

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={() => JSON.stringify(form) !== JSON.stringify(toForm(provider))}>
            <div className="provider-dialog">
                <h2>{provider ? T("editTitle") : T("createTitle")}</h2>

                {MAIN_FIELDS.map(renderField)}

                <div className="advanced-settings">
                    <button type="button" className="advanced-toggle" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(!showAdvanced)}>
                        <Icon path={showAdvanced ? mdiChevronDown : mdiChevronRight} size={0.7} />
                        {showAdvanced ? T("advanced.hide") : T("advanced.show")}
                    </button>

                    {showAdvanced && <div className="advanced-form">
                        {ADVANCED_FIELDS.map(renderField)}
                        <div className="oidc-groups">
                            <h3>{T("groups.title")}</h3>
                            <p>{T("groups.description")}</p>
                        </div>
                        {renderField(["groupsClaim", "groupsClaim", mdiAccountGroup])}
                        <div className="form-group">
                            <label htmlFor="oidc-adminGroups">{T("fields.adminGroups")}</label>
                            <textarea id="oidc-adminGroups" className="oidc-textarea" rows={3} value={form.adminGroupsText}
                                placeholder={T("fields.adminGroupsPlaceholder")}
                                onChange={event => setForm(prev => ({ ...prev, adminGroupsText: event.target.value }))} />
                        </div>
                        <div className="form-group" role="group" aria-label={T("fields.organizationGroups")}>
                            <span className="oidc-label">{T("fields.organizationGroups")}</span>
                            {form.organizationGroups.map((mapping, index) => <div className="oidc-mapping" key={index}>
                                <Input icon={mdiAccountGroup} value={mapping.group} placeholder={T("fields.mappingGroup")} aria-label={T("fields.mappingGroup")}
                                    setValue={group => setMapping(index, { group })} />
                                <SelectBox id={`oidc-mapping-${index}`} selected={mapping.organizationId}
                                    options={organizations.map(org => ({ value: org.id, label: org.name }))}
                                    setSelected={organizationId => setMapping(index, { organizationId })} />
                                <Button icon={mdiClose} title={T("fields.removeMapping")} aria-label={T("fields.removeMapping")}
                                    onClick={() => setForm(prev => ({ ...prev, organizationGroups: prev.organizationGroups.filter((_, position) => position !== index) }))} />
                            </div>)}
                            <Button type="secondary" icon={mdiPlus} text={T("fields.addMapping")} disabled={!organizations.length}
                                onClick={() => setForm(prev => ({ ...prev, organizationGroups: [...prev.organizationGroups, { group: "", organizationId: organizations[0]?.id }] }))} />
                        </div>
                    </div>}
                </div>

                <div className="button-row">
                    <Button type="secondary" text={t("common.actions.cancel")} onClick={onClose} />
                    <Button text={provider ? T("actions.saveChanges") : T("actions.addProvider")} onClick={handleSubmit} />
                </div>
            </div>
        </DialogProvider>
    );
};
