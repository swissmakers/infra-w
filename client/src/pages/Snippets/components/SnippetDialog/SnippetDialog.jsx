import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import { useEffect, useEffectEvent, useState } from "react";
import { getRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { mdiFormTextbox, mdiTextBox, mdiCodeBrackets } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import { OS_OPTIONS, parseOsFilter } from "@/common/utils/osUtils.js";
import { useToast, useSnippets } from "@/common/contexts";

export const SnippetDialog = ({ open, onClose, editSnippetId, selectedOrganization }) => {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [command, setCommand] = useState("");
    const [description, setDescription] = useState("");
    const [osFilter, setOsFilter] = useState([]);
    const { sendToast, showError } = useToast();
    const { loadAllSnippets } = useSnippets();

    const [initialValues, setInitialValues] = useState({ name: '', command: '', description: '', osFilter: [] });
    const [formSource, setFormSource] = useState({ open: false, editSnippetId: null });

    const resetForm = () => {
        setName("");
        setCommand("");
        setDescription("");
        setOsFilter([]);
        setInitialValues({ name: '', command: '', description: '', osFilter: [] });
    };

    if (formSource.open !== open || formSource.editSnippetId !== editSnippetId) {
        setFormSource({ open, editSnippetId });
        if (open) resetForm();
    }

    const loadSnippetData = useEffectEvent((isCurrent) => {
        const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : '';
        getRequest(`snippets/${editSnippetId}${queryParams}`).then(snippet => {
            if (!isCurrent()) return;
            const parsedOsFilter = parseOsFilter(snippet.osFilter);
            setName(snippet.name);
            setCommand(snippet.command);
            setDescription(snippet.description || "");
            setOsFilter(parsedOsFilter);
            setInitialValues({ name: snippet.name, command: snippet.command, description: snippet.description || '', osFilter: parsedOsFilter });
        }).catch(error => {
            if (!isCurrent()) return;
            console.error("Failed to load snippet:", error);
            sendToast("Error", t('snippets.messages.errors.loadFailed'));
            onClose();
        });
    });

    useEffect(() => {
        if (!open || !editSnippetId) return;
        let current = true;
        loadSnippetData(() => current);
        return () => { current = false; };
    }, [open, editSnippetId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !command.trim()) {
            sendToast("Error", t('snippets.messages.errors.required'));
            return;
        }

        try {
            if (editSnippetId) {
                const snippetData = {
                    name,
                    command,
                    description: description || undefined,
                    osFilter: osFilter.length > 0 ? osFilter : null,
                };
                const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : '';
                await patchRequest(`snippets/${editSnippetId}${queryParams}`, snippetData);
                sendToast("Success", t('snippets.messages.success.updated'));
            } else {
                const snippetData = {
                    name,
                    command,
                    description: description || undefined,
                    organizationId: selectedOrganization || undefined,
                    osFilter: osFilter.length > 0 ? osFilter : null,
                };
                await putRequest("snippets", snippetData);
                sendToast("Success", t('snippets.messages.success.created'));
            }

            await loadAllSnippets();
            onClose();
        } catch (error) {
            showError(error, t('snippets.messages.errors.saveFailed'));
        }
    };

    const handleClose = (event) => {
        event.preventDefault();
        onClose();
    };

    const arraysEqual = (a, b) => {
        if (a.length !== b.length) return false;
        return a.every((val, i) => val === b[i]);
    };

    const isDirty = name !== initialValues.name || 
                     command !== initialValues.command || 
                     description !== initialValues.description ||
                     !arraysEqual(osFilter, initialValues.osFilter);

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty}>
            <div className="snippet-dialog">
                <div className="snippet-dialog-title">
                    <h2>
                        <Icon path={mdiCodeBrackets} />
                        {editSnippetId ? t('snippets.dialog.title.edit') : t('snippets.dialog.title.create')}
                    </h2>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dialog-content">
                        <div className="form-group">
                            <label htmlFor="name">{t('snippets.dialog.fields.name')}</label>
                            <IconInput icon={mdiFormTextbox} value={name} setValue={setName} 
                                       placeholder={t('snippets.dialog.placeholders.name')} id="name" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">{t('snippets.dialog.fields.description')}</label>
                            <IconInput icon={mdiTextBox} value={description} setValue={setDescription}
                                       placeholder={t('snippets.dialog.placeholders.description')} id="description" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="snippet-os-filter">{t('snippets.dialog.fields.osFilter')}</label>
                            <SelectBox id="snippet-os-filter"
                                options={OS_OPTIONS} 
                                selected={osFilter} 
                                setSelected={setOsFilter} 
                                multiple={true}
                                placeholder={t('snippets.dialog.placeholders.osFilter')}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="command">{t('snippets.dialog.fields.command')}</label>
                            <div className="textarea-container">
                                <textarea id="command" value={command} onChange={(e) => setCommand(e.target.value)}
                                          placeholder={t('snippets.dialog.placeholders.command')} rows={5} className="custom-textarea" />
                            </div>
                        </div>
                    </div>

                    <div className="dialog-actions">
                        <Button text={t('snippets.dialog.actions.cancel')} onClick={handleClose} type="secondary" />
                        <Button text={editSnippetId ? t('snippets.dialog.actions.save') : t('snippets.dialog.actions.create')} type="primary" />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};