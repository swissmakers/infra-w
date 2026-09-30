import "./styles.sass";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDrag, useDrop } from "react-dnd";
import Icon from "@mdi/react";
import { mdiPencil, mdiTrashCan, mdiDragVertical, mdiPlay } from "@mdi/js";
import { deleteRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { parseOsFilter } from "@/common/utils/osUtils.js";
import { useSnippets, useScripts, useToast } from "@/common/contexts";

const CommandRow = ({ item, kind, onEdit, onDelete, onReposition, onRun, reorderable, t }) => {
    const [{ isDragging }, drag] = useDrag({ type: kind, item: { id: item.id }, canDrag: reorderable, collect: m => ({ isDragging: m.isDragging() }) });
    const [{ isOver }, drop] = useDrop({ accept: kind, drop: dragged => dragged.id !== item.id && onReposition(dragged.id, item.id),
        collect: m => ({ isOver: m.isOver() && m.getItem()?.id !== item.id }) });
    const osFilter = parseOsFilter(item.osFilter);
    const preview = kind === "scripts" ? item.content?.split("\n").find(line => line.trim() && !line.startsWith("#!")) : item.command;

    return (
        <div className={`command-row${isDragging ? " dragging" : ""}${isOver ? " drop-target" : ""}`} ref={node => drag(drop(node))}>
            <Icon path={mdiDragVertical} size={0.75} className={`drag-handle${reorderable ? "" : " hidden"}`} />
            <div className="command-name">
                <strong>{item.name}</strong>
                {item.description && <span>{item.description}</span>}
            </div>
            <code className="command-preview" title={kind === "scripts" ? item.content : item.command}>{preview}</code>
            <div className="command-meta">
                {osFilter.length > 0 && <span className="command-badge" title={osFilter.join(", ")}>
                    {osFilter.length === 1 ? osFilter[0] : `${osFilter.length} OS`}</span>}
            </div>
            <div className="command-actions">
                {onRun && <Button icon={mdiPlay} title={t("scripts.run.title")} aria-label={t("scripts.run.titleFor", { name: item.name })} onClick={() => onRun(item)} />}
                <Button icon={mdiPencil} title={t(`${kind}.list.actions.edit`)} aria-label={t(`${kind}.list.actions.edit`)} onClick={() => onEdit(item.id)} />
                <Button icon={mdiTrashCan} title={t(`${kind}.list.actions.delete`)} aria-label={t(`${kind}.list.actions.delete`)} onClick={() => onDelete(item)} />
            </div>
        </div>
    );
};

export const CommandList = ({ kind, items, onEdit, onRun, selectedOrganization, reorderable = true, emptyText }) => {
    const { t } = useTranslation();
    const { loadAllSnippets } = useSnippets();
    const { loadAllScripts } = useScripts();
    const { sendToast, showError } = useToast();
    const [pendingDelete, setPendingDelete] = useState(null);
    const queryParams = selectedOrganization ? `?organizationId=${selectedOrganization}` : "";
    const reload = kind === "scripts" ? loadAllScripts : loadAllSnippets;

    const deleteItem = async () => {
        try {
            await deleteRequest(`${kind}/${pendingDelete.id}${queryParams}`);
            sendToast("Success", t(`${kind}.messages.success.deleted`));
            await reload();
        } catch (e) {
            showError(e, t(`${kind}.messages.errors.deleteFailed`));
        }
    };

    const reposition = async (sourceId, targetId) => {
        try {
            await patchRequest(`${kind}/${sourceId}/reposition${queryParams}`, { targetId });
            await reload();
        } catch (e) {
            showError(e, t(`${kind}.messages.errors.reorderFailed`));
        }
    };

    if (!items?.length) return <p className="command-list-empty">{emptyText || t(`${kind}.list.empty`)}</p>;

    return <>
        <div className="command-list">
            {items.map(item => <CommandRow key={item.id} item={item} kind={kind} onEdit={onEdit} onRun={onRun} reorderable={reorderable}
                onDelete={setPendingDelete} onReposition={reposition} t={t} />)}
        </div>
        <ActionConfirmDialog open={pendingDelete !== null} setOpen={open => !open && setPendingDelete(null)} onConfirm={deleteItem}
            text={pendingDelete && t(`${kind}.list.confirmDelete`, { name: pendingDelete.name })} />
    </>;
};
