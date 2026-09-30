import { useEffect, useState, useCallback, useMemo, useContext } from "react";
import { getRequest, saveDownload } from "@/common/utils/RequestUtil.js";
import { mdiDownload } from "@mdi/js";
import PageHeader from "@/common/components/PageHeader";
import Button from "@/common/components/Button";
import AuditTable from "./components/AuditTable";
import AuditFilters from "./components/AuditFilters";
import AuditRetention from "./components/AuditRetention";
import { useTranslation } from "react-i18next";
import { useToast, UserContext } from "@/common/contexts";

const filterParams = (filters, { paging = true } = {}) => new URLSearchParams(Object.entries(filters)
    .filter(([key, value]) => value !== "" && value != null && (paging || !["limit", "offset"].includes(key)))
    .map(([key, value]) => [key, String(value)]));

export const Audit = () => {
    const { t } = useTranslation();
    const { sendToast, showError } = useToast();
    const { user } = useContext(UserContext);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [metadata, setMetadata] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [filters, setFilters] = useState({
        organizationId: null,
        category: "",
        action: "",
        actorId: null,
        startDate: "",
        endDate: "",
        limit: 50,
        offset: 0,
    });
    const [total, setTotal] = useState(0);
    const [forbidden, setForbidden] = useState(false);

    const pagination = useMemo(() => ({
        total,
        currentPage: Math.floor(filters.offset / filters.limit) + 1,
        itemsPerPage: filters.limit,
    }), [total, filters.offset, filters.limit]);

    useEffect(() => {
        if (user?.role !== "admin") return;
        const fetchMetadata = async () => {
            try {
                const params = new URLSearchParams();
                if (filters.organizationId !== null && filters.organizationId !== "") {
                    params.set("organizationId", String(filters.organizationId));
                }
                const path = params.toString() ? `audit/metadata?${params}` : "audit/metadata";
                const metadataRes = await getRequest(path);
                setMetadata(metadataRes);
                setForbidden(false);
            } catch (error) {
                if (error?.code === 403 || error?.message === "Forbidden") {
                    setForbidden(true);
                    return;
                }
                sendToast("Error", t('audit.errors.failedToLoadData'));
            }
        };
        fetchMetadata();
    }, [filters.organizationId, sendToast, t, user?.role]);

    useEffect(() => {
        if (user?.role !== "admin") return;
        const fetchAuditLogs = async () => {
            try {
                const response = await getRequest(`audit/logs?${filterParams(filters)}`);
                setAuditLogs(response.logs);
                setTotal(response.total);
                setForbidden(false);
            } catch (error) {
                if (error?.code === 403 || error?.message === "Forbidden") {
                    setForbidden(true);
                    setAuditLogs([]);
                    return;
                }
                sendToast("Error", t('audit.errors.failedToLoadLogs'));
                setAuditLogs([]);
            } finally {
                setLoading(false);
            }
        };
        fetchAuditLogs();
    }, [filters, sendToast, t, user?.role]);

    const handleFilterChange = useCallback((newFilters) => {
        setLoading(true);
        setFilters(prev => {
            const next = { ...prev, ...newFilters, offset: 0 };
            if (Object.prototype.hasOwnProperty.call(newFilters, "organizationId")) {
                next.actorId = null;
            }
            return next;
        });
    }, []);

    const handlePageChange = useCallback((page) => {
        setLoading(true);
        setFilters(prev => ({ ...prev, offset: (page - 1) * prev.limit }));
    }, []);

    const exportCsv = () => {
        setExporting(true);
        saveDownload(`audit/export?${filterParams(filters, { paging: false })}`, `infra-w-audit-${new Date().toISOString().slice(0, 10)}.csv`)
            .catch(error => showError(error, t("audit.export.failed")))
            .finally(() => setExporting(false));
    };

    const available = user?.role === "admin" && !forbidden;

    return (
        <div className="audit-page page-document">
            <PageHeader title={t("audit.page.title")} subtitle={t("audit.page.subtitle")}>
                {available && <>
                    <AuditRetention />
                    <Button type="secondary" icon={mdiDownload} text={t("audit.export.button")} onClick={exportCsv} disabled={exporting || total === 0} />
                </>}
            </PageHeader>
            {!available
                ? <p role="alert">{t("enterprise.unavailablePageDescription")}</p>
                : <>
                    <AuditFilters filters={filters} metadata={metadata} organizations={metadata?.organizations || []} onChange={handleFilterChange} />
                    <AuditTable logs={auditLogs} loading={loading} pagination={pagination} onPageChange={handlePageChange} />
                </>}
        </div>
    );
};
