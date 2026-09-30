import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DialogProvider } from "@/common/components/Dialog";
import IconInput from "@/common/components/IconInput";
import { mdiDomain, mdiFormTextbox } from "@mdi/js";
import Button from "@/common/components/Button";
import { patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import "./styles.sass";
import { useToast } from "@/common/contexts";

export const OrganizationDialog = ({ open, onClose, organization = null, refreshOrganizations }) => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const initial = { name: organization?.name || "", description: organization?.description || "" };
    const [form, setForm] = useState(initial);

    const [source, setSource] = useState({ open, organization });
    if (source.open !== open || source.organization !== organization) {
        setSource({ open, organization });
        if (open) setForm(initial);
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.name.trim()) {
            sendToast("Error", t('settings.organizations.dialog.messages.nameRequired'));
            return;
        }

        const data = { name: form.name.trim(), description: form.description.trim() || null };
        try {
            if (organization) await patchRequest(`organizations/${organization.id}`, data);
            else await putRequest("organizations", data);

            sendToast("Success", t(organization ? 'settings.organizations.dialog.messages.updateSuccess' : 'settings.organizations.dialog.messages.createSuccess'));
            refreshOrganizations();
            onClose();
        } catch (error) {
            showError(error, t(organization ? 'settings.organizations.dialog.messages.updateFailed' : 'settings.organizations.dialog.messages.createFailed'));
        }
    };

    const setField = key => value => setForm(prev => ({ ...prev, [key]: value }));
    const isDirty = form.name !== initial.name || form.description !== initial.description;

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty}>
            <div className="organization-dialog">
                <h2>{t(organization ? 'settings.organizations.dialog.editTitle' : 'settings.organizations.dialog.title')}</h2>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="organization-name">{t('settings.organizations.dialog.fields.name')}</label>
                        <IconInput
                            icon={mdiDomain}
                            id="organization-name"
                            placeholder={t('settings.organizations.dialog.fields.namePlaceholder')}
                            value={form.name}
                            setValue={setField("name")}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="organization-description">{t('settings.organizations.dialog.fields.description')}</label>
                        <IconInput
                            icon={mdiFormTextbox}
                            id="organization-description"
                            placeholder={t('settings.organizations.dialog.fields.descriptionPlaceholder')}
                            value={form.description}
                            setValue={setField("description")}
                        />
                    </div>

                    <div className="dialog-actions">
                        <Button text={t('settings.organizations.dialog.actions.cancel')} onClick={onClose} type="secondary" buttonType="button" />
                        <Button text={t(organization ? 'common.actions.save' : 'settings.organizations.dialog.actions.create')} type="primary" buttonType="submit" />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};
