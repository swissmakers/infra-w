import "./styles.sass";
import { useState, useMemo } from "react";
import CommandList from "@/pages/Snippets/components/CommandList";
import SnippetDialog from "@/pages/Snippets/components/SnippetDialog";
import ScriptDialog from "@/pages/Snippets/components/ScriptDialog";
import { ScriptHostPicker } from "@/pages/Snippets/components/ScriptHostPicker.jsx";
import IconInput from "@/common/components/IconInput";
import Button from "@/common/components/Button";
import PageHeader from "@/common/components/PageHeader";
import SelectBox from "@/common/components/SelectBox";
import TabSwitcher from "@/common/components/TabSwitcher";
import { mdiCodeBraces, mdiPlus, mdiScriptText, mdiAccount, mdiDomain, mdiMagnify } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { useSnippets, useScripts, useOrganizations } from "@/common/contexts";

export const Snippets = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(0);
    const [snippetDialogOpen, setSnippetDialogOpen] = useState(false);
    const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
    const [editSnippetId, setEditSnippetId] = useState(null);
    const [editScriptId, setEditScriptId] = useState(null);
    const [selectedOrganization, setSelectedOrganization] = useState(null);
    const { allSnippets } = useSnippets();
    const { allScripts } = useScripts();
    const { organizations } = useOrganizations();
    const [search, setSearch] = useState("");
    const [scriptToRun, setScriptToRun] = useState(null);

    const query = search.trim().toLowerCase();
    const items = useMemo(() => (activeTab === 0 ? allSnippets : allScripts)
        .filter(item => (item.organizationId ?? null) === selectedOrganization)
        .filter(item => !query || [item.name, item.description, item.command, item.content].some(text => text?.toLowerCase().includes(query))),
    [activeTab, allSnippets, allScripts, selectedOrganization, query]);

    const organizationOptions = useMemo(() => [
        { value: null, label: t("snippets.page.personal"), icon: mdiAccount },
        ...organizations.map(org => ({ value: org.id, label: org.name, icon: mdiDomain })),
    ], [organizations, t]);

    const openCreateSnippetDialog = () => {
        setEditSnippetId(null);
        setSnippetDialogOpen(true);
    };

    const openEditSnippetDialog = (id) => {
        setEditSnippetId(id);
        setSnippetDialogOpen(true);
    };

    const closeSnippetDialog = () => {
        setSnippetDialogOpen(false);
        setEditSnippetId(null);
    };

    const openCreateScriptDialog = () => {
        setEditScriptId(null);
        setScriptDialogOpen(true);
    };

    const openEditScriptDialog = (id) => {
        setEditScriptId(id);
        setScriptDialogOpen(true);
    };

    const closeScriptDialog = () => {
        setScriptDialogOpen(false);
        setEditScriptId(null);
    };

    const handleCreateClick = () => {
        if (activeTab === 0) {
            openCreateSnippetDialog();
        } else {
            openCreateScriptDialog();
        }
    };

    return (
        <div className="snippets-page page-document">
            <PageHeader title={t("snippets.page.title")}
                subtitle={activeTab === 0 ? t("snippets.page.subtitle") : t("scripts.page.subtitle")}>
                <Button icon={mdiPlus} onClick={handleCreateClick}
                    text={activeTab === 0 ? t("snippets.page.addSnippet") : t("scripts.page.addScript")} />
            </PageHeader>

            <div className="snippets-toolbar">
                <TabSwitcher activeTab={activeTab === 0 ? "snippets" : "scripts"}
                    onTabChange={tabKey => setActiveTab(tabKey === "snippets" ? 0 : 1)} tabs={[
                        { key: "snippets", label: t("snippets.page.tabs.snippets"), icon: mdiCodeBraces },
                        { key: "scripts", label: t("scripts.page.tabs.scripts"), icon: mdiScriptText },
                    ]} />
                <div className="snippets-search">
                    <IconInput icon={mdiMagnify} type="search" value={search} setValue={setSearch}
                        placeholder={t("snippets.page.searchPlaceholder")} aria-label={t("snippets.page.searchLabel")} />
                </div>
                <div className="organization-selector">
                    <SelectBox options={organizationOptions} selected={selectedOrganization} setSelected={setSelectedOrganization} />
                </div>
            </div>

            {/* a filtered list would hide where reordered items land */}
            <CommandList kind={activeTab === 0 ? "snippets" : "scripts"} items={items} reorderable={!query}
                onEdit={activeTab === 0 ? openEditSnippetDialog : openEditScriptDialog}
                onRun={activeTab === 1 ? setScriptToRun : undefined}
                emptyText={query ? t("snippets.page.noMatch") : undefined}
                selectedOrganization={selectedOrganization} />

            <ScriptHostPicker script={scriptToRun} onClose={() => setScriptToRun(null)} />

            <SnippetDialog open={snippetDialogOpen} onClose={closeSnippetDialog} editSnippetId={editSnippetId}
                           selectedOrganization={selectedOrganization} />
            <ScriptDialog open={scriptDialogOpen} onClose={closeScriptDialog} editScriptId={editScriptId}
                          selectedOrganization={selectedOrganization} />
        </div>
    );
};
