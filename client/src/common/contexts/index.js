import { createContext, useContext } from "react";

export const UserContext = createContext({});
export const StateStreamContext = createContext({});
export const ServerContext = createContext({});
export const IdentityContext = createContext({});
export const SessionContext = createContext({});
export const SnippetContext = createContext({});
export const ScriptContext = createContext({});
export const KeymapContext = createContext({});
export const PreferencesContext = createContext({});
export const ToastContext = createContext({});
export const OrganizationContext = createContext({ organizations: [], loadOrganizations: () => {} });

export const useActiveSessions = () => useContext(SessionContext);
export const useSnippets = () => useContext(SnippetContext);
export const useScripts = () => useContext(ScriptContext);
export const usePreferences = () => useContext(PreferencesContext);
export const useToast = () => useContext(ToastContext);
export const useOrganizations = () => useContext(OrganizationContext);
export const useKeymaps = () => {
    const context = useContext(KeymapContext);
    if (!context) throw new Error("useKeymaps must be used within a KeymapProvider");
    return context;
};
