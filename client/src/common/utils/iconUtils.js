import * as mdiIcons from "@mdi/js";

export const getIconPath = (iconName) =>
    (iconName && mdiIcons[iconName]) || mdiIcons.mdiServerOutline;

const providerIcons = {
    "login.microsoftonline.com": mdiIcons.mdiMicrosoft,
    "accounts.google.com": mdiIcons.mdiGoogle,
    "appleid.apple.com": mdiIcons.mdiApple,
    "gitlab.com": mdiIcons.mdiGitlab,
    "auth.atlassian.com": mdiIcons.mdiAtlassian,
};

export const getProviderIcon = (provider) => {
    try {
        return providerIcons[new URL(provider.issuer).hostname.toLowerCase()] || mdiIcons.mdiShieldAccount;
    } catch {
        return mdiIcons.mdiShieldAccount;
    }
};