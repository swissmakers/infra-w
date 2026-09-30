import { mdiServerOutline, mdiCodeBraces, mdiShieldCheckOutline, mdiAccountCircleOutline, mdiAccountGroup, mdiClockStarFourPointsOutline, mdiShieldAccountOutline, mdiDomain, mdiKeyVariant, mdiConsole, mdiKeyboardOutline, mdiChartLine, mdiHarddisk, mdiFolderOutline, mdiLanConnect, mdiTuneVariant, mdiShieldKeyOutline, mdiApi, mdiBellOutline } from "@mdi/js";

export const getSidebarNavigation = (t, isAdmin = false) => [
    { title: t("enterprise.workspace"), key: "servers", path: "/servers", icon: mdiServerOutline, toggleEvent: "toggleServerList" },
    { title: t('common.sidebar.snippets'), key: "snippets", path: "/snippets", icon: mdiCodeBraces },
    ...(isAdmin ? [{ title: t('common.sidebar.audit'), key: "audit", path: "/audit", icon: mdiShieldCheckOutline }] : []),
];

export const getSettingsUserPages = t => [
    { title: t("settings.pages.account"), key: "account", icon: mdiAccountCircleOutline },
    { title: t("settings.pages.preferences"), key: "preferences", icon: mdiTuneVariant },
    { title: t("settings.pages.terminal"), key: "terminal", icon: mdiConsole },
    { title: t("settings.pages.fileManager"), key: "fileManager", icon: mdiFolderOutline },
    { title: t("settings.pages.keymaps"), key: "keymaps", icon: mdiKeyboardOutline },
    { title: t("settings.pages.identities"), key: "identities", icon: mdiKeyVariant },
    { title: t("settings.pages.sessions"), key: "sessions", icon: mdiClockStarFourPointsOutline },
    { title: t("settings.pages.apiTokens"), key: "apiTokens", icon: mdiApi },
    { title: t("settings.pages.organizations"), key: "organizations", icon: mdiDomain },
];

export const getSettingsAdminPages = t => [
    { title: t("settings.pages.users"), key: "users", icon: mdiAccountGroup },
    { title: t("settings.pages.authentication"), key: "authentication", icon: mdiShieldAccountOutline },
    { title: t("settings.pages.integrations"), key: "integrations", icon: mdiLanConnect },
    { title: t("settings.pages.monitoring"), key: "monitoring", icon: mdiChartLine },
    { title: t("settings.pages.hostKeys"), key: "hostKeys", icon: mdiShieldKeyOutline },
    { title: t("settings.pages.notifications"), key: "notifications", icon: mdiBellOutline },
    { title: t("settings.pages.backup"), key: "backup", icon: mdiHarddisk },
];
