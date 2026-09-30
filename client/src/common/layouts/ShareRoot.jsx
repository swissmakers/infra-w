import { Outlet } from "react-router-dom";
import { ToastProvider } from "@/common/contexts/ToastContext.jsx";
import { PreferencesProvider } from "@/common/contexts/PreferencesContext.jsx";
import { KeymapProvider } from "@/common/contexts/KeymapContext.jsx";
import { Suspense } from "react";
import Loading from "@/common/components/Loading";
import { ErrorBoundary } from "@/common/components/ErrorBoundary";

const ShareRoot = () => {
    return (
        <ErrorBoundary>
            <PreferencesProvider>
                <ToastProvider>
                    <KeymapProvider>
                        <Suspense fallback={<Loading />}>
                            <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
                                <Outlet />
                            </div>
                        </Suspense>
                    </KeymapProvider>
                </ToastProvider>
            </PreferencesProvider>
        </ErrorBoundary>
    );
};

export default ShareRoot;
