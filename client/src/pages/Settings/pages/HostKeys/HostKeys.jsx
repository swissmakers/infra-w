import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { mdiAlertOutline, mdiKeyVariant, mdiMagnify, mdiTrashCanOutline } from "@mdi/js";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { SettingsSection, SettingsListItem } from "@/pages/Settings/components/SettingsLayout.jsx";
import { deleteRequest, getRequest, postRequest } from "@/common/utils/RequestUtil.js";
import { formatDate } from "@/common/utils/formatUtils.js";
import { useToast } from "@/common/contexts";
import "./styles.sass";

const raw = { interpolation: { escapeValue: false } };

export const HostKeys = () => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const [keys, setKeys] = useState(null);
    const [search, setSearch] = useState("");
    const [pending, setPending] = useState(null);

    const load = useCallback(() => getRequest("host-keys").then(setKeys).catch(showError), [showError]);
    useEffect(() => { load(); }, [load]);

    const query = search.trim().toLowerCase();
    const shown = (keys || []).filter(key => !query || [key.host, key.fingerprint, key.pendingFingerprint, ...key.servers]
        .some(value => value?.toLowerCase().includes(query)));

    const confirm = (key, action) => setPending({
        text: t(`settings.hostKeys.${action}Confirm`, { host: key.host, ...raw }),
        run: () => (action === "accept" ? postRequest(`host-keys/${key.id}/accept`) : deleteRequest(`host-keys/${key.id}`))
            .then(() => {
                sendToast("Success", t(`settings.hostKeys.${action === "accept" ? "accepted" : "forgotten"}`, { host: key.host, ...raw }));
                return load();
            }).catch(showError),
    });

    return <>
        <SettingsSection actions={<IconInput icon={mdiMagnify} type="search" value={search} setValue={setSearch}
            placeholder={t("settings.hostKeys.search")} aria-label={t("settings.hostKeys.search")} />}>
            {keys === null ? <p className="settings-empty" role="status">{t("common.loading")}</p>
                : shown.length === 0 ? <p className="settings-empty">{t(query ? "settings.hostKeys.noMatch" : "settings.hostKeys.empty")}</p>
                    : shown.map(key => <SettingsListItem key={key.id} icon={key.pendingFingerprint ? mdiAlertOutline : mdiKeyVariant}
                        title={`${key.host}:${key.port}`}
                        badge={key.pendingFingerprint && <span className="settings-status error">{t("settings.hostKeys.changed")}</span>}
                        meta={[
                            key.servers.length ? t("settings.hostKeys.servers", { names: key.servers.join(", "), ...raw }) : t("settings.hostKeys.noServers"),
                            <span className="host-key-fingerprint" key="trusted">{t("settings.hostKeys.trusted", { type: key.keyType, fingerprint: key.fingerprint, ...raw })}</span>,
                            key.pendingFingerprint && <span className="host-key-fingerprint changed" key="presented">
                                {t("settings.hostKeys.presented", { type: key.pendingKeyType, fingerprint: key.pendingFingerprint, date: formatDate(key.pendingSeenAt), ...raw })}</span>,
                            t("settings.hostKeys.seen", { first: formatDate(key.firstSeenAt), last: formatDate(key.lastSeenAt), ...raw }),
                        ]}
                        actions={<>
                            {key.pendingFingerprint && <Button type="secondary" text={t("settings.hostKeys.accept")} onClick={() => confirm(key, "accept")} />}
                            <Button icon={mdiTrashCanOutline} title={t("settings.hostKeys.forget")} aria-label={t("settings.hostKeys.forgetFor", { host: key.host, ...raw })}
                                onClick={() => confirm(key, "forget")} />
                        </>} />)}
        </SettingsSection>
        <ActionConfirmDialog open={pending !== null} setOpen={open => !open && setPending(null)} onConfirm={() => pending?.run()} text={pending?.text} />
    </>;
};
