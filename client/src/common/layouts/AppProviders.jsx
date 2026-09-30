import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ErrorBoundary } from "@/common/components/ErrorBoundary";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { UserProvider } from "@/common/contexts/UserContext.jsx";
import { PreferencesProvider } from "@/common/contexts/PreferencesContext.jsx";
import { OrganizationProvider } from "@/common/contexts/OrganizationContext.jsx";
import { StateStreamProvider } from "@/common/contexts/StateStreamContext.jsx";
import { KeymapProvider } from "@/common/contexts/KeymapContext.jsx";
import { ServerProvider } from "@/common/contexts/ServerContext.jsx";
import { IdentityProvider } from "@/common/contexts/IdentityContext.jsx";
import { SnippetProvider } from "@/common/contexts/SnippetContext.jsx";
import { ScriptProvider } from "@/common/contexts/ScriptContext.jsx";
import { SessionProvider } from "@/common/contexts/SessionContext.jsx";

// outermost first, each provider may use the ones above it
const PROVIDERS = [ToastProvider, UserProvider, PreferencesProvider, OrganizationProvider, StateStreamProvider, KeymapProvider,
    ServerProvider, IdentityProvider, SnippetProvider, ScriptProvider, SessionProvider];

export const AppProviders = ({ children }) => (
    <ErrorBoundary>
        <DndProvider backend={HTML5Backend}>
            {PROVIDERS.reduceRight((content, Provider) => <Provider>{content}</Provider>, children)}
        </DndProvider>
    </ErrorBoundary>
);
