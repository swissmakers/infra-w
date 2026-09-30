import "./styles.sass";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiViewGrid, mdiViewList, mdiFileMove, mdiContentCopy, mdiHelpCircle } from "@mdi/js";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import { SettingsSection, SettingsRow } from "@/pages/Settings/components/SettingsLayout.jsx";
import { usePreferences } from "@/common/contexts";

const Segmented = ({ options, value, onChange }) => (
    <div className="segmented" role="group">
        {options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}><Icon path={option.icon} size={0.7} />{option.label}</button>)}
    </div>
);

export const FileManager = () => {
    const { t } = useTranslation();
    const {
        showThumbnails, setShowThumbnails, defaultViewMode, setDefaultViewMode, showHiddenFiles, setShowHiddenFiles,
        confirmBeforeDelete, setConfirmBeforeDelete, dragDropAction, setDragDropAction,
    } = usePreferences();
    const text = key => t(`settings.fileManager.${key}`);

    return (
        <SettingsSection>
            <SettingsRow title={text("defaultView.title")} description={text("defaultView.description")}>
                <Segmented value={defaultViewMode} onChange={setDefaultViewMode} options={[
                    { value: "list", icon: mdiViewList, label: text("defaultView.list") },
                    { value: "grid", icon: mdiViewGrid, label: text("defaultView.grid") },
                ]} />
            </SettingsRow>
            <SettingsRow title={text("thumbnails.title")} description={text("thumbnails.description")} htmlFor="show-thumbnails">
                <ToggleSwitch id="show-thumbnails" checked={showThumbnails} onChange={setShowThumbnails} />
            </SettingsRow>
            <SettingsRow title={text("hiddenFiles.title")} description={text("hiddenFiles.description")} htmlFor="show-hidden-files">
                <ToggleSwitch id="show-hidden-files" checked={showHiddenFiles} onChange={setShowHiddenFiles} />
            </SettingsRow>
            <SettingsRow title={text("deleteConfirmation.title")} description={text("deleteConfirmation.description")} htmlFor="confirm-before-delete">
                <ToggleSwitch id="confirm-before-delete" checked={confirmBeforeDelete} onChange={setConfirmBeforeDelete} />
            </SettingsRow>
            <SettingsRow title={text("dragDropAction.title")} description={text("dragDropAction.description")}>
                <Segmented value={dragDropAction} onChange={setDragDropAction} options={[
                    { value: "move", icon: mdiFileMove, label: text("dragDropAction.move") },
                    { value: "copy", icon: mdiContentCopy, label: text("dragDropAction.copy") },
                    { value: "ask", icon: mdiHelpCircle, label: text("dragDropAction.ask") },
                ]} />
            </SettingsRow>
        </SettingsSection>
    );
};
