import "./styles.sass";
import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";
import { LAYERS } from "@/common/utils/layers.js";

export const ActionConfirmDialog = ({open, setOpen, onConfirm, onCancel, text, zIndex = LAYERS.confirm}) => {
    const { t } = useTranslation();

    const cancel = () => {
        setOpen(false);

        if (onCancel) {
            onCancel();
        }
    }

    const confirm = () => {
        setOpen(false);

        if (onConfirm) {
            onConfirm();
        }
    }

    return (
        <DialogProvider onClose={() => setOpen(false)} open={open} zIndex={zIndex}>
            <div className="confirm-dialog">
                <h2>{t('common.confirmDialog.title')}</h2>
                <p>{text ? text : t('common.confirmDialog.defaultText')}</p>
                <div className="btn-area">
                    <Button onClick={cancel} type="secondary" text={t('common.actions.cancel')} />
                    <Button onClick={confirm} type="primary" text={t('common.actions.confirm')} />
                </div>
            </div>
        </DialogProvider>
    )
}