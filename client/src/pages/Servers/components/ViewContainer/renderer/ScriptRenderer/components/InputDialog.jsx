import { DialogProvider } from "@/common/components/Dialog";
import { useState } from "react";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import { mdiFormTextbox, mdiSend, mdiClose, mdiFormTextboxPassword, mdiLock } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";
import "./InputDialog.sass";

const InputDialog = ({ open, onSubmit, onCancel, prompt }) => {
    const { t } = useTranslation();
    const text = key => t(`servers.scriptDialogs.${key}`);
    const [inputValue, setInputValue] = useState("");

    const [shownPrompt, setShownPrompt] = useState(null);
    if (prompt !== shownPrompt) {
        setShownPrompt(prompt);
        if (prompt) setInputValue(prompt.default || "");
    }

    const handleSubmit = () => {
        onSubmit(inputValue);
        setInputValue("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSubmit();
    };

    const handleCancel = () => {
        setInputValue("");
        onCancel?.();
    };

    const selectOption = (option) => onSubmit(option);

    if (!prompt) return null;

    const promptType = prompt.inputType || prompt.type || "input";

    return (
        <DialogProvider open={open} onClose={() => {}} disableClosing={true}>
            <div className="input-dialog">
                <div className="dialog-title">
                    <Icon path={promptType === "password" ? mdiFormTextboxPassword : mdiFormTextbox} />
                    <h2>{text("inputRequired")}</h2>
                </div>

                <div className="dialog-content">
                    <div className="prompt-description">
                        {prompt.prompt}
                    </div>

                    {promptType === "select" ? (
                        <div className="form-group">
                            <label>{text("selectOption")}</label>
                            <div className="options-container">
                                {prompt.options.map((option, index) => (
                                    <Button key={index} text={option} onClick={() => selectOption(option)} type="secondary" />
                                ))}
                                <Button text={t("common.actions.cancel")} icon={mdiClose} onClick={handleCancel} type="secondary" className="cancel-btn" />
                            </div>
                        </div>
                    ) : promptType === "confirm" ? (
                        <div className="form-group">
                            <label>{text("confirmAction")}</label>
                            <div className="confirm-actions">
                                {/* scripts expect an untranslated "Yes" or "No" */}
                                <Button text={text("yes")} icon={mdiSend} onClick={() => selectOption("Yes")} />
                                <Button text={text("no")} icon={mdiClose} onClick={() => selectOption("No")} type="secondary" />
                                <Button text={t("common.actions.cancel")} icon={mdiClose} onClick={handleCancel} type="secondary" />
                            </div>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label htmlFor="script-input-value">{text("enterValue")}</label>
                            <IconInput id="script-input-value"
                                type={promptType === "password" ? "password" : "text"}
                                icon={promptType === "password" ? mdiLock : mdiFormTextbox}
                                value={inputValue}
                                setValue={setInputValue}
                                placeholder={promptType === "password" ? text("passwordPlaceholder") : (prompt.default || text("valuePlaceholder"))}
                                onKeyDown={handleKeyDown}
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {(promptType !== "select" && promptType !== "confirm") && (
                    <div className="dialog-actions">
                        <Button onClick={handleCancel} text={t("common.actions.cancel")} icon={mdiClose} type="secondary" />
                        <Button onClick={handleSubmit} text={text("submit")} icon={mdiSend}
                                disabled={promptType === "password" ? !inputValue : !inputValue.trim()} />
                    </div>
                )}
            </div>
        </DialogProvider>
    );
};

export default InputDialog;
