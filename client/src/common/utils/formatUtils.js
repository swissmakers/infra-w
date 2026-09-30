import i18n from "@/i18n.js";

const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"];

export const formatBytes = (bytes) => {
    const exponent = bytes > 0 ? Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1) : 0;
    return new Intl.NumberFormat(i18n.language, { style: "unit", unit: BYTE_UNITS[exponent], maximumFractionDigits: exponent ? 1 : 0 })
        .format(bytes / 1024 ** exponent);
};

export const formatDuration = (seconds) => {
    const [value, unit] = seconds < 60 ? [seconds, "second"] : seconds < 3600 ? [Math.floor(seconds / 60), "minute"] : [Math.floor(seconds / 3600), "hour"];
    return new Intl.NumberFormat(i18n.language, { style: "unit", unit }).format(value);
};

export const formatRelative = (date, now = Date.now()) => {
    const minutes = Math.max(0, Math.floor((now - new Date(date)) / 60000));
    if (!Number.isFinite(minutes)) return "";
    if (minutes >= 7 * 1440) return formatDay(date);
    const format = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
    if (minutes < 60) return format.format(-minutes, "minute");
    if (minutes < 1440) return format.format(-Math.floor(minutes / 60), "hour");
    return format.format(-Math.floor(minutes / 1440), "day");
};

export const formatDate = (date) => new Date(date).toLocaleString(i18n.language);
export const formatDay = (date) => new Date(date).toLocaleDateString(i18n.language);
export const formatShortDateTime = (date) => new Date(date).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" });
export const formatTime = (date) => new Date(date).toLocaleTimeString(i18n.language);
export const formatNumber = (value) => Number(value).toLocaleString(i18n.language);
export const formatPercent = (percent) => (percent / 100).toLocaleString(i18n.language, { style: "percent" });
