import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SelectBox from "@/common/components/SelectBox";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts";
import "./styles.sass";

const FOREVER = "forever";
const PERIODS = [90, 180, 365, 730, 1825, 3650];

export const AuditRetention = () => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const [retention, setRetention] = useState(null);
    const [pending, setPending] = useState(null);

    useEffect(() => {
        getRequest("settings").then(({ auditRetentionDays }) => setRetention(auditRetentionDays ? String(auditRetentionDays) : FOREVER))
            .catch(showError);
    }, [showError]);

    const periodLabel = value => value === FOREVER ? t("audit.retention.forever")
        : Number(value) % 365 === 0 ? t("audit.retention.years", { count: Number(value) / 365 }) : t("audit.retention.days", { count: Number(value) });
    const options = [FOREVER, ...PERIODS.map(String)].map(value => ({ value, label: periodLabel(value) }));

    const save = value => patchRequest("settings", { auditRetentionDays: value === FOREVER ? null : Number(value) }).then(() => {
        setRetention(value);
        sendToast("Success", t("audit.retention.saved", { period: periodLabel(value) }));
    }).catch(showError);

    const shortens = value => value !== FOREVER && (retention === FOREVER || Number(value) < Number(retention));
    const choose = value => value !== retention && (shortens(value) ? setPending(value) : save(value));

    if (retention === null) return null;
    return <div className="audit-retention">
        <label htmlFor="audit-retention">{t("audit.retention.label")}</label>
        <SelectBox id="audit-retention" options={options} selected={retention} setSelected={choose} />
        <ActionConfirmDialog open={pending !== null} setOpen={open => !open && setPending(null)} onConfirm={() => save(pending)}
            text={pending && t("audit.retention.confirm", { period: periodLabel(pending) })} />
    </div>;
};
