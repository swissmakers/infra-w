import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { mdiApi, mdiContentCopy, mdiFormTextbox, mdiPlus } from "@mdi/js";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { DialogProvider } from "@/common/components/Dialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { SettingsSection } from "@/pages/Settings/components/SettingsLayout.jsx";
import { ApiTokenListItem } from "@/pages/Settings/components/ApiTokenListItem.jsx";
import { deleteRequest, getRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useCopyToClipboard } from "@/common/hooks/useCopyToClipboard.js";
import { useToast } from "@/common/contexts";
import "./styles.sass";

const EXPIRY_DAYS = [30, 90, 365];
const EMPTY_FORM = { name: "", scope: "read", days: "90" };

export const ApiTokens = () => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const copy = useCopyToClipboard();
    const [tokens, setTokens] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [created, setCreated] = useState(null);
    const [pendingRevoke, setPendingRevoke] = useState(null);
    const text = (key, values) => t(`settings.apiTokens.${key}`, values);

    const load = useCallback(() => getRequest("tokens").then(setTokens).catch(showError), [showError]);
    useEffect(() => { load(); }, [load]);

    const openDialog = () => {
        setForm(EMPTY_FORM);
        setCreated(null);
        setDialogOpen(true);
    };

    const create = (event) => {
        event.preventDefault();
        putRequest("tokens", { name: form.name.trim(), scope: form.scope, days: Number(form.days) })
            .then(token => { setCreated(token); return load(); })
            .catch(showError);
    };

    const revoke = () => deleteRequest(`tokens/${pendingRevoke.id}`)
        .then(() => { sendToast("Success", text("revoked", { name: pendingRevoke.name })); return load(); })
        .catch(showError);

    return <>
        <SettingsSection actions={<Button text={text("create")} icon={mdiPlus} onClick={openDialog} />}>
            {tokens.length ? tokens.map(token => <ApiTokenListItem key={token.id} token={token}
                actions={<Button type="secondary" text={text("revoke")} onClick={() => setPendingRevoke(token)} />} />)
                : <p className="settings-empty">{text("empty")}</p>}
        </SettingsSection>

        <DialogProvider open={dialogOpen} onClose={() => setDialogOpen(false)} isDirty={!created && form.name !== ""}>
            {created ? <div className="api-token-dialog">
                <h2>{text("createdTitle")}</h2>
                <p>{text("createdHint")}</p>
                <div className="api-token-value">
                    <code aria-label={text("tokenValue")}>{created.token}</code>
                    <Button icon={mdiContentCopy} title={text("copy")} aria-label={text("copy")} onClick={() => copy(created.token)} />
                </div>
                <div className="api-token-actions"><Button text={t("common.actions.done")} onClick={() => setDialogOpen(false)} /></div>
            </div> : <form className="api-token-dialog" onSubmit={create}>
                <h2>{text("create")}</h2>
                <div className="form-group">
                    <label htmlFor="api-token-name">{text("name")}</label>
                    <IconInput id="api-token-name" icon={mdiFormTextbox} value={form.name} placeholder={text("namePlaceholder")} required
                        setValue={name => setForm(prev => ({ ...prev, name }))} />
                </div>
                <div className="form-group">
                    <label htmlFor="api-token-scope">{text("access")}</label>
                    <SelectBox id="api-token-scope" selected={form.scope} setSelected={scope => setForm(prev => ({ ...prev, scope }))}
                        options={["read", "write"].map(value => ({ value, label: text(`scopes.${value}`) }))} />
                </div>
                <div className="form-group">
                    <label htmlFor="api-token-days">{text("expiry")}</label>
                    <SelectBox id="api-token-days" selected={form.days} setSelected={days => setForm(prev => ({ ...prev, days }))}
                        options={EXPIRY_DAYS.map(days => ({ value: String(days), label: text("days", { count: days }) }))} />
                </div>
                <p className="api-token-note">{text("limits")}</p>
                <div className="api-token-actions">
                    <Button type="secondary" buttonType="button" text={t("common.actions.cancel")} onClick={() => setDialogOpen(false)} />
                    <Button buttonType="submit" icon={mdiApi} text={text("createButton")} disabled={!form.name.trim()} />
                </div>
            </form>}
        </DialogProvider>

        <ActionConfirmDialog open={pendingRevoke !== null} setOpen={open => !open && setPendingRevoke(null)} onConfirm={revoke}
            text={pendingRevoke && text("revokeConfirm", { name: pendingRevoke.name })} />
    </>;
};
