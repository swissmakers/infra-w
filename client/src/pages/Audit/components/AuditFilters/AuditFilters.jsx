import { useMemo, useCallback } from "react";
import SelectBox from "@/common/components/SelectBox";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";
import "./styles.sass";

export const AuditFilters = ({ filters, metadata, organizations, onChange }) => {
    const { t } = useTranslation();

    const handleFilterChange = useCallback((key, value) => {
        onChange({ [key]: value });
    }, [onChange]);

    const clearFilters = useCallback(() => {
        onChange({
            organizationId: null, category: "", action: "", actorId: null, startDate: "", endDate: "",
        });
    }, [onChange]);

    const categories = useMemo(() => metadata?.categories || [], [metadata]);
    const activityOptions = useMemo(() => [
        { value: "", label: t("audit.filters.options.allActivities") },
        ...categories.map(category => ({ value: category.key, label: t(`audit.categories.${category.key}`) })),
    ], [categories, t]);
    const actionOptions = useMemo(() => [
        { value: "", label: t("audit.filters.options.allActions") },
        ...categories.filter(category => !filters.category || category.key === filters.category)
            .flatMap(category => category.actions)
            .map(action => ({ value: action, label: t(`audit.actions.${action}`) })),
    ], [categories, filters.category, t]);

    const organizationOptions = useMemo(() => [
        { value: "", label: t('audit.filters.options.allOrganizations') },
        { value: "personal", label: t('audit.filters.options.personalOnly') },
        ...organizations.map(org => ({ value: org.id.toString(), label: org.name })),
    ], [organizations, t]);

    const actors = metadata?.actors;
    const actorOptions = useMemo(() => {
        const base = [{ value: "", label: t('audit.filters.options.allActors') }];
        if (!actors?.length) return base;
        return [
            ...base,
            ...actors.map((a) => ({ value: String(a.id), label: a.label })),
        ];
    }, [actors, t]);

    const activeFilterCount = useMemo(() => Object.entries(filters)
        .filter(([key, v]) => !["limit", "offset"].includes(key) && v !== "" && v !== null)
        .length, [filters]);

    const fields = [
        { key: "organization", control: <SelectBox options={organizationOptions} selected={filters.organizationId || ""}
            setSelected={value => handleFilterChange("organizationId", value || null)} /> },
        { key: "activity", control: <SelectBox options={activityOptions} selected={filters.category}
            setSelected={value => onChange({ category: value, action: "" })} /> },
        { key: "action", control: <SelectBox options={actionOptions} selected={filters.action} setSelected={value => handleFilterChange("action", value)} /> },
        { key: "actor", control: <SelectBox options={actorOptions} selected={filters.actorId != null ? String(filters.actorId) : ""}
            setSelected={value => handleFilterChange("actorId", value ? parseInt(value, 10) : null)} /> },
        { key: "startDate", control: <input type="datetime-local" className="date-input" value={filters.startDate}
            onChange={event => handleFilterChange("startDate", event.target.value)} /> },
        { key: "endDate", control: <input type="datetime-local" className="date-input" value={filters.endDate}
            onChange={event => handleFilterChange("endDate", event.target.value)} /> },
    ];

    return (
        <div className="audit-filters" role="search">
            {fields.map(({ key, control }) => <label className="filter-group" key={key}>
                <span>{t(`audit.filters.${key}`)}</span>{control}
            </label>)}
            {activeFilterCount > 0 && <Button text={t("audit.filters.clearAll")} type="secondary" onClick={clearFilters} />}
        </div>
    );
};
