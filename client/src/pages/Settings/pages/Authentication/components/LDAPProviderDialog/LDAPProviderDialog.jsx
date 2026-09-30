import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { mdiAccountMultiple, mdiCog, mdiFormTextbox, mdiKey, mdiServer, mdiNumeric, mdiFilter, mdiTestTube } from "@mdi/js";
import Button from "@/common/components/Button";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { patchRequest, postRequest, putRequest } from "@/common/utils/RequestUtil.js";

import { createLdapPreset } from "@/common/utils/ldapPresets.js";
import { useToast, useOrganizations } from "@/common/contexts";

const PRESET_OPTIONS = [{ value: "freeipa", label: "FreeIPA" }, { value: "ad", label: "Microsoft Active Directory" }];

const defaults = {
    name: "", host: "", port: "636", bindDN: "", bindPassword: "", baseDN: "",
    userSearchFilter: "(uid={{username}})", useTLS: true, usernameAttr: "uid",
    emailAttr: "mail", firstNameAttr: "givenName", lastNameAttr: "sn",
    organizationIds: [], adminGroupDNsText: "", groupSearchBaseDN: "", groupSearchFilter: "(member={{dn}})",
    groupNameAttribute: "cn", groupMemberAttribute: "member", connectionTimeoutMs: "10000", searchTimeoutMs: "10000",
};

const toForm = (provider) => provider ? {
    name: provider.name, host: provider.host, port: String(provider.port), bindDN: provider.bindDN,
    bindPassword: "********", baseDN: provider.baseDN, userSearchFilter: provider.userSearchFilter,
    useTLS: Boolean(provider.useTLS), usernameAttr: provider.usernameAttribute,
    emailAttr: provider.emailAttribute || "mail",
    firstNameAttr: provider.firstNameAttribute, lastNameAttr: provider.lastNameAttribute,
    organizationIds: provider.organizationIds || [],
    adminGroupDNsText: Array.isArray(provider.adminGroupDNs) ? provider.adminGroupDNs.join("\n") : "",
    groupSearchBaseDN: provider.groupSearchBaseDN || "",
    groupSearchFilter: provider.groupSearchFilter || "(member={{dn}})",
    groupNameAttribute: provider.groupNameAttribute || "cn",
    groupMemberAttribute: provider.groupMemberAttribute || "member",
    connectionTimeoutMs: String(provider.connectionTimeoutMs || 10000),
    searchTimeoutMs: String(provider.searchTimeoutMs || 10000),
} : defaults;

export const LDAPProviderDialog = ({ open, onClose, provider, onSave }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const [initialForm, setInitialForm] = useState(() => toForm(provider));
    const [form, setForm] = useState(initialForm);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testingUsers, setTestingUsers] = useState(false);
    const { organizations } = useOrganizations();
    const [connectionTestResult, setConnectionTestResult] = useState(null);
    const [usersTestResult, setUsersTestResult] = useState(null);
    const dialogRef = useRef(null);
    const [preset, setPreset] = useState("freeipa");
    const [domain, setDomain] = useState("");
    const [formSource, setFormSource] = useState({ provider, open });

    if (formSource.provider !== provider || formSource.open !== open) {
        const nextForm = toForm(provider);
        setFormSource({ provider, open });
        setInitialForm(nextForm);
        setForm(nextForm);
        setDomain("");
        setShowAdvanced(false);
        setConnectionTestResult(null);
        setUsersTestResult(null);
    }

    const applyPreset = () => {
        try {
            setForm(current => ({ ...current, ...createLdapPreset(preset, domain) }));
            setConnectionTestResult(null);
        } catch { sendToast("Error", T("preset.invalidDomain")); }
    };

    const set = (key) => (val) => { setConnectionTestResult(null); setForm(f => ({ ...f, [key]: val })); };
    const T = (key) => t(`settings.authentication.ldapDialog.${key}`);

    const buildPayload = () => ({
                name: form.name, host: form.host, port: parseInt(form.port), bindDN: form.bindDN, baseDN: form.baseDN,
                userSearchFilter: form.userSearchFilter, useTLS: Boolean(form.useTLS), usernameAttribute: form.usernameAttr,
                emailAttribute: form.emailAttr, firstNameAttribute: form.firstNameAttr, lastNameAttribute: form.lastNameAttr,
                organizationIds: form.organizationIds.map((id) => Number(id)).filter((id) => Number.isInteger(id)),
                adminGroupDNs: String(form.adminGroupDNsText || "").split("\n").map((line) => line.trim()).filter(Boolean),
                groupSearchBaseDN: form.groupSearchBaseDN || null,
                groupSearchFilter: form.groupSearchFilter,
                groupNameAttribute: form.groupNameAttribute,
                groupMemberAttribute: form.groupMemberAttribute,
                connectionTimeoutMs: parseInt(form.connectionTimeoutMs || "10000"),
                searchTimeoutMs: parseInt(form.searchTimeoutMs || "10000"),
                ...(form.bindPassword !== "********" && { bindPassword: form.bindPassword }),
    });

    const handleSubmit = async () => {
        try {
            const data = buildPayload();
            await (provider ? patchRequest(`auth/providers/admin/ldap/${provider.id}`, data) : putRequest("auth/providers/admin/ldap", { ...data, enabled: false }));
            onSave(); onClose();
        } catch (e) { sendToast("Error", e.message || T("messages.saveFailed")); }
    };

    const handleTest = async () => {
        setTesting(true);
        setConnectionTestResult(null);
        try {
            const r = await postRequest("auth/providers/admin/ldap/test", { ...buildPayload(), ...(provider && { existingProviderId: provider.id }) });
            setConnectionTestResult(r);
            if (r.success) {
                sendToast("Success", T("messages.testSuccess"));
                setTimeout(() => {
                    dialogRef.current?.scrollTo({ top: dialogRef.current.scrollHeight, behavior: "smooth" });
                }, 50);
            } else sendToast("Error", r.message || T("messages.testFailed"));
        } catch (e) { sendToast("Error", e.message || T("messages.testFailed")); }
        finally { setTesting(false); }
    };

    const handleTestUsers = async () => {
        if (!provider) return sendToast("Error", T("messages.saveFirst"));
        setTestingUsers(true);
        try {
            const r = await postRequest(`auth/providers/admin/ldap/${provider.id}/test-users`, { limit: 100 });
            if (r.success) {
                setUsersTestResult(r);
                sendToast("Success", T("messages.testUsersSuccess"));
                setTimeout(() => {
                    dialogRef.current?.scrollTo({ top: dialogRef.current.scrollHeight, behavior: "smooth" });
                }, 50);
            }
        } catch (e) { sendToast("Error", e.message || T("messages.testUsersFailed")); }
        finally { setTestingUsers(false); }
    };

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={() => JSON.stringify(form) !== JSON.stringify(initialForm)}>
            <div className="ldap-provider-dialog" ref={dialogRef}>
                <h2>{provider ? T("editTitle") : T("createTitle")}</h2>

                {!provider && <section className="ldap-preset">
                    <h3>{T("preset.title")}</h3>
                    <p>{T("preset.description")}</p>
                    <div className="preset-fields">
                        <div className="form-group">
                            <label htmlFor="directory-preset">{T("preset.directory")}</label>
                            <SelectBox id="directory-preset" options={PRESET_OPTIONS} selected={preset} setSelected={setPreset} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="directory-domain">{T("preset.domain")}</label>
                            <Input id="directory-domain" value={domain} setValue={setDomain} placeholder="corp.example.com" />
                        </div>
                        <Button type="secondary" text={T("preset.apply")} onClick={applyPreset} />
                    </div>
                    <p>{T("preset.help")}</p>
                </section>}

                <div className="form-group">
                    <label htmlFor="ldap-displayName">{T("fields.displayName")}</label>
                    <Input id="ldap-displayName" icon={mdiFormTextbox} placeholder={T("fields.displayNamePlaceholder")} value={form.name} setValue={set("name")} />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="ldap-host">{T("fields.host")}</label>
                        <Input id="ldap-host" icon={mdiServer} placeholder={T("fields.hostPlaceholder")} value={form.host} setValue={set("host")} />
                    </div>
                    <div className="form-group port-field">
                        <label htmlFor="ldap-port">{T("fields.port")}</label>
                        <Input id="ldap-port" icon={mdiNumeric} type="number" placeholder="389" value={form.port} setValue={set("port")} />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="ldap-bindDN">{T("fields.bindDN")}</label>
                    <Input id="ldap-bindDN" icon={mdiAccountMultiple} placeholder={T("fields.bindDNPlaceholder")} value={form.bindDN} setValue={set("bindDN")} />
                </div>

                <div className="form-group">
                    <label htmlFor="ldap-bindPassword">{T("fields.bindPassword")}</label>
                    <Input id="ldap-bindPassword" icon={mdiKey} type="password" placeholder={provider ? T("fields.bindPasswordPlaceholderEdit") : T("fields.bindPasswordPlaceholder")} value={form.bindPassword} setValue={set("bindPassword")} />
                </div>

                <div className="form-group">
                    <label htmlFor="ldap-baseDN">{T("fields.baseDN")}</label>
                    <Input id="ldap-baseDN" icon={mdiFormTextbox} placeholder={T("fields.baseDNPlaceholder")} value={form.baseDN} setValue={set("baseDN")} />
                </div>

                <div className="form-group">
                    <label htmlFor="ldap-userSearchFilter">{T("fields.userSearchFilter")}</label>
                    <Input id="ldap-userSearchFilter" icon={mdiFilter} placeholder={T("fields.userSearchFilterPlaceholder")} value={form.userSearchFilter} setValue={set("userSearchFilter")} />
                </div>

                <div className="form-group toggle-group">
                    <label htmlFor="useTLS">{T("fields.useTLS")}</label>
                    <ToggleSwitch checked={form.useTLS} onChange={set("useTLS")} id="useTLS" />
                </div>

                <div className="form-group">
                    <label htmlFor="ldap-organizations">{T("fields.organizations")}</label>
                    <SelectBox id="ldap-organizations"
                        multiple
                        searchable
                        options={organizations.map((org) => ({ value: org.id, label: org.name }))}
                        selected={form.organizationIds}
                        setSelected={set("organizationIds")}
                        placeholder={T("fields.organizationsPlaceholder")}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="ldap-adminGroupDNs">{T("fields.adminGroupDNs")}</label>
                    <textarea id="ldap-adminGroupDNs"
                        className="ldap-textarea"
                        value={form.adminGroupDNsText}
                        onChange={(event) => set("adminGroupDNsText")(event.target.value)}
                        placeholder={T("fields.adminGroupDNsPlaceholder")}
                    />
                </div>

                <div className="advanced-settings">
                    <Button type="secondary" icon={mdiCog} onClick={() => setShowAdvanced(!showAdvanced)} text={showAdvanced ? T("advanced.hide") : T("advanced.show")} />
                    {showAdvanced && (
                        <div className="advanced-form">
                            {[["usernameAttr", "usernameAttribute", mdiAccountMultiple], ["emailAttr", "emailAttribute", mdiFormTextbox], ["firstNameAttr", "firstNameAttribute", mdiFormTextbox], ["lastNameAttr", "lastNameAttribute", mdiFormTextbox]].map(([key, field, icon]) => (
                                <div className="form-group" key={key}>
                                    <label htmlFor={`ldap-${key}`}>{T(`fields.${field}`)}</label>
                                    <Input id={`ldap-${key}`} icon={icon} placeholder={T(`fields.${field}Placeholder`)} value={form[key]} setValue={set(key)} />
                                </div>
                            ))}
                            <div className="form-group">
                                <label htmlFor="ldap-groupSearchBaseDN">{T("fields.groupSearchBaseDN")}</label>
                                <Input id="ldap-groupSearchBaseDN" icon={mdiFormTextbox} placeholder={T("fields.groupSearchBaseDNPlaceholder")} value={form.groupSearchBaseDN} setValue={set("groupSearchBaseDN")} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="ldap-groupSearchFilter">{T("fields.groupSearchFilter")}</label>
                                <Input id="ldap-groupSearchFilter" icon={mdiFilter} placeholder={T("fields.groupSearchFilterPlaceholder")} value={form.groupSearchFilter} setValue={set("groupSearchFilter")} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="ldap-groupNameAttribute">{T("fields.groupNameAttribute")}</label>
                                    <Input id="ldap-groupNameAttribute" icon={mdiFormTextbox} placeholder={T("fields.groupNameAttributePlaceholder")} value={form.groupNameAttribute} setValue={set("groupNameAttribute")} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="ldap-groupMemberAttribute">{T("fields.groupMemberAttribute")}</label>
                                    <Input id="ldap-groupMemberAttribute" icon={mdiFormTextbox} placeholder={T("fields.groupMemberAttributePlaceholder")} value={form.groupMemberAttribute} setValue={set("groupMemberAttribute")} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="ldap-connectionTimeoutMs">{T("fields.connectionTimeoutMs")}</label>
                                    <Input id="ldap-connectionTimeoutMs" icon={mdiNumeric} type="number" placeholder="10000" value={form.connectionTimeoutMs} setValue={set("connectionTimeoutMs")} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="ldap-searchTimeoutMs">{T("fields.searchTimeoutMs")}</label>
                                    <Input id="ldap-searchTimeoutMs" icon={mdiNumeric} type="number" placeholder="10000" value={form.searchTimeoutMs} setValue={set("searchTimeoutMs")} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {!provider && <p className="ldap-activation-note">{T("preset.activation")}</p>}
                <div className="button-row">
                    <Button type="secondary" icon={mdiTestTube} onClick={handleTest} text={testing ? T("actions.testing") : T("actions.testConnection")} disabled={testing} />
                    {provider && <Button type="secondary" icon={mdiAccountMultiple} onClick={handleTestUsers} text={testingUsers ? T("actions.testingUsers") : T("actions.testUsers")} disabled={testingUsers || testing} />}
                    <Button text={provider ? T("actions.saveChanges") : T("actions.addProvider")} onClick={handleSubmit} />
                </div>

                {connectionTestResult?.diagnostics && (
                    <div className="ldap-test-results">
                        <h3>{T("diagnostics.connectionTitle")}</h3>
                        <div className="diagnostic-grid">
                            <div><span>{T("diagnostics.host")}:</span> {connectionTestResult.diagnostics.host}</div>
                            <div><span>{T("diagnostics.port")}:</span> {connectionTestResult.diagnostics.port}</div>
                            <div><span>{T("diagnostics.tls")}:</span> {connectionTestResult.diagnostics.useTLS ? T("diagnostics.enabled") : T("diagnostics.disabled")}</div>
                            <div><span>{T("diagnostics.baseDN")}:</span> {connectionTestResult.diagnostics.baseDN}</div>
                            <div><span>{T("diagnostics.bindDN")}:</span> {connectionTestResult.diagnostics.bindDN}</div>
                            <div><span>{T("diagnostics.durationMs")}:</span> {connectionTestResult.diagnostics.durationMs}</div>
                            <div><span>{T("diagnostics.searchProbe")}:</span> {connectionTestResult.diagnostics.searchProbe?.attempted ? (connectionTestResult.diagnostics.searchProbe?.success ? T("diagnostics.success") : T("diagnostics.failed")) : T("diagnostics.notRun")}</div>
                            <div><span>{T("diagnostics.searchSampleCount")}:</span> {connectionTestResult.diagnostics.searchProbe?.sampleCount ?? 0}</div>
                        </div>
                        {connectionTestResult.diagnostics.searchProbe?.error && (
                            <p className="diagnostic-error">{connectionTestResult.diagnostics.searchProbe.error}</p>
                        )}
                    </div>
                )}

                {provider && usersTestResult?.success && (
                    <div className="ldap-test-results">
                        <h3>{T("diagnostics.usersTitle")}</h3>
                        <div className="diagnostic-grid">
                            <div><span>{T("diagnostics.rawEntries")}:</span> {usersTestResult.summary?.rawEntries ?? 0}</div>
                            <div><span>{T("diagnostics.usersFound")}:</span> {usersTestResult.summary?.searchedUsers ?? 0}</div>
                            <div><span>{T("diagnostics.adminCandidates")}:</span> {usersTestResult.summary?.adminCandidates ?? 0}</div>
                            <div><span>{T("diagnostics.limit")}:</span> {usersTestResult.summary?.limit ?? 100}</div>
                        </div>

                        <div className="diagnostic-list">
                            <h4>{T("diagnostics.matchedUsers")}</h4>
                            {(usersTestResult.users || []).length === 0 ? (
                                <p>{T("diagnostics.noUsers")}</p>
                            ) : (
                                <ul>
                                    {usersTestResult.users.map((user) => (
                                        <li key={`${user.dn}-${user.username}`}>
                                            <strong>{user.username || "-"}</strong> ({user.firstName || "-"} {user.lastName || "-"}) - {user.dn}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="diagnostic-list">
                            <h4>{T("diagnostics.adminUsers")}</h4>
                            {(usersTestResult.adminCandidates || []).length === 0 ? (
                                <p>{T("diagnostics.noAdminUsers")}</p>
                            ) : (
                                <ul>
                                    {usersTestResult.adminCandidates.map((user) => (
                                        <li key={`admin-${user.dn}-${user.username}`}>
                                            <strong>{user.username || "-"}</strong> - {user.adminMatchMethod} ({user.matchedAdminTarget || "-"})
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DialogProvider>
    );
};