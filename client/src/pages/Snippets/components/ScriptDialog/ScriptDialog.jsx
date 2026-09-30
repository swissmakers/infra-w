import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import { useState, useEffect, useEffectEvent, useRef } from "react";
import { getRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { mdiFormTextbox, mdiFileDocument, mdiCheck, mdiClose, mdiCodeTags, mdiLightbulb, mdiScript } from "@mdi/js";
import Icon from "@mdi/react";
import Editor from "@monaco-editor/react";
import { registerInfraWLanguage } from "@/common/monaco/infra-w-lang.js";
import { useTranslation } from "react-i18next";
import { OS_OPTIONS, parseOsFilter } from "@/common/utils/osUtils.js";
import "@/common/monaco/setup.js";
import { useToast, useScripts } from "@/common/contexts";

export const ScriptDialog = ({ open, onClose, editScriptId, selectedOrganization }) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [content, setContent] = useState("");
    const [osFilter, setOsFilter] = useState([]);
    const editorRef = useRef(null);
    const [initialValues, setInitialValues] = useState({ name: '', description: '', content: '', osFilter: [] });

    const { sendToast, showError } = useToast();
    const { t } = useTranslation();
    const { loadAllScripts } = useScripts();
    const [creating, setCreating] = useState(false);

    const isEditing = !!editScriptId;

    const getDefaultContent = () => {
        return `@INFRA-W:STEP "Getting user preferences"
@INFRA-W:INPUT APP_NAME "Which application would you like to install?" "nginx"
@INFRA-W:SELECT INSTALL_TYPE "Choose installation type" stable testing "development version"

if [ "$INSTALL_TYPE" = "development version" ]; then
    @INFRA-W:WARN "Development version may be unstable"
    @INFRA-W:CONFIRM "Are you sure you want to continue with development version?"

    if [ "$INFRA_W_CONFIRM_RESULT" = "Yes" ]; then
         @INFRA-W:INFO "Setting up development environment"
    fi
else
    @INFRA-W:STEP "Standard installation process"
    echo "Installing stable version of $APP_NAME..."
fi

@INFRA-W:SUMMARY "System Information" "OS" "$(lsb_release -d | cut -f2)" "User" "$(whoami)" "Memory" "$(free -h | grep '^Mem:' | awk '{print $2}')"`;
    };

    const resetForm = (defaultContent = getDefaultContent()) => {
        setName("");
        setDescription("");
        setContent(defaultContent);
        setOsFilter([]);
        setInitialValues({ name: '', description: '', content: defaultContent, osFilter: [] });
    };

    const [formSource, setFormSource] = useState({ open: false, editScriptId: null });
    if (formSource.open !== open || formSource.editScriptId !== editScriptId) {
        setFormSource({ open, editScriptId });
        if (open) resetForm(editScriptId ? "" : undefined);
    }

    const loadScriptData = useEffectEvent((isCurrent) => {
        const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : "";
        getRequest(`scripts/${editScriptId}${queryParams}`).then(script => {
            if (!isCurrent()) return;
            const parsedOsFilter = parseOsFilter(script.osFilter);
            setName(script.name || "");
            setDescription(script.description || "");
            setContent(script.content || getDefaultContent());
            setOsFilter(parsedOsFilter);
            setInitialValues({ 
                name: script.name || '', 
                description: script.description || '', 
                content: script.content || getDefaultContent(),
                osFilter: parsedOsFilter
            });
        }).catch(error => {
            if (!isCurrent()) return;
            console.error("Failed to load script:", error);
            sendToast("Error", t("scripts.messages.errors.loadFailed"));
            onClose();
        });
    });

    useEffect(() => {
        if (!open || !editScriptId) return;
        let current = true;
        loadScriptData(() => current);
        return () => { current = false; };
    }, [open, editScriptId]);

    const createScript = async () => {
        if (!name.trim()) {
            sendToast("Error", t("scripts.dialog.errors.nameRequired"));
            return;
        }

        if (!description.trim()) {
            sendToast("Error", t("scripts.dialog.errors.descriptionRequired"));
            return;
        }

        if (!content.trim()) {
            sendToast("Error", t("scripts.dialog.errors.contentRequired"));
            return;
        }

        setCreating(true);

        try {
            if (isEditing) {
                const scriptData = {
                    name: name.trim(),
                    description: description.trim(),
                    content: content.trim(),
                    osFilter: osFilter.length > 0 ? osFilter : null,
                };
                const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : "";
                await patchRequest(`scripts/${editScriptId}${queryParams}`, scriptData);
                sendToast("Success", t("scripts.messages.success.updated"));
            } else {
                const scriptData = {
                    name: name.trim(),
                    description: description.trim(),
                    content: content.trim(),
                    organizationId: selectedOrganization || undefined,
                    osFilter: osFilter.length > 0 ? osFilter : null,
                };
                await putRequest("scripts", scriptData);
                sendToast("Success", t("scripts.messages.success.created"));
            }

            await loadAllScripts();
            onClose();
            resetForm();
        } catch (err) {
            showError(err, t(`scripts.dialog.errors.${isEditing ? "updateFailed" : "createFailed"}`));
        } finally {
            setCreating(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const arraysEqual = (a, b) => {
        if (a.length !== b.length) return false;
        return a.every((val, i) => val === b[i]);
    };

    const isDirty = name !== initialValues.name || 
                     description !== initialValues.description || 
                     content !== initialValues.content ||
                     !arraysEqual(osFilter, initialValues.osFilter);

    return (
        <DialogProvider open={open} onClose={handleClose} isDirty={isDirty}>
            <div className="create-script-dialog">
                <div className="dialog-header">
                    <h2>
                        <Icon path={mdiScript} />
                        {isEditing ? t("scripts.dialog.title.edit") : t("scripts.dialog.title.create")}
                    </h2>
                </div>

                <div className="dialog-body">
                    <div className="form-section">
                        <h3>
                            <Icon path={mdiFormTextbox} />
                            {t("scripts.dialog.scriptDetails")}
                        </h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="script-name">{t("scripts.dialog.fields.name")}</label>
                                <IconInput id="script-name"
                                    icon={mdiFormTextbox}
                                    value={name}
                                    setValue={setName}
                                    placeholder={t("scripts.dialog.placeholders.name")}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="script-description">{t("scripts.dialog.fields.description")}</label>
                                <IconInput id="script-description"
                                    icon={mdiFileDocument}
                                    value={description}
                                    setValue={setDescription}
                                    placeholder={t("scripts.dialog.placeholders.description")}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="script-os-filter">{t("scripts.dialog.fields.osFilter")}</label>
                            <SelectBox id="script-os-filter"
                                options={OS_OPTIONS} 
                                selected={osFilter} 
                                setSelected={setOsFilter} 
                                multiple={true}
                                placeholder={t("scripts.dialog.placeholders.osFilter")}
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>
                            <Icon path={mdiCodeTags} />
                            {t("scripts.dialog.scriptContent")}
                            <div className="help-tip">
                                <Icon path={mdiLightbulb} />
                                <span>{t("scripts.dialog.helpTip")}</span>
                            </div>
                        </h3>

                        <div className="code-editor-container">
                            <Editor
                                value={content}
                                height="400px"
                                language="infra-w"
                                theme="infra-w-dark"
                                onChange={(value) => setContent(value || "")}
                                onMount={(editor, monaco) => {
                                    editorRef.current = editor;
                                    registerInfraWLanguage(monaco);
                                    monaco.editor.setTheme("infra-w-dark");
                                }}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    lineNumbers: "on",
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    wordWrap: "off",
                                    tabSize: 4,
                                    insertSpaces: true,
                                    folding: true,
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="dialog-actions">
                    <Button
                        onClick={handleClose}
                        text={t("scripts.dialog.actions.cancel")}
                        type="secondary"
                        icon={mdiClose}
                        disabled={creating}
                    />
                    <Button
                        onClick={createScript}
                        text={creating ? t(`scripts.dialog.actions.${isEditing ? "updating" : "creating"}`) : t(`scripts.dialog.actions.${isEditing ? "update" : "create"}`)}
                        icon={mdiCheck}
                        disabled={creating}
                    />
                </div>
            </div>
        </DialogProvider>
    );
};
