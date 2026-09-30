import { Outlet, useLocation } from "react-router-dom";
import { QuickActionProvider } from "@/common/contexts/QuickActionContext.jsx";
import { AppProviders } from "@/common/layouts/AppProviders.jsx";
import { Suspense, lazy, useState, useEffect, useRef } from "react";
import Loading from "@/common/components/Loading";
import ConnectionErrorBanner from "@/common/components/ConnectionErrorBanner";
import ImpersonationBanner from "@/common/components/ImpersonationBanner";
import WorkspaceHeader from "@/common/components/WorkspaceHeader/WorkspaceHeader.jsx";
import MobileNav from "@/common/components/MobileNav";
import ConnectionEvents from "@/common/components/ConnectionEvents";

const Servers = lazy(() => import("@/pages/Servers"));

const AppContent = () => {
    const { pathname } = useLocation();
    const isServers = pathname.replace(/\/+$/, "") === "/servers";
    const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false);
    const [isLeftPaneHovering, setIsLeftPaneHovering] = useState(false);
    const leftPaneRef = useRef(null);
    const hoverBarRef = useRef(null);

    useEffect(() => {
        if (!isLeftPaneCollapsed) return;
        const isPointInRect = (rect, x, y) => rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        const handleMouseMove = (event) => {
            const leftPaneRect = leftPaneRef.current?.getBoundingClientRect();
            const hoverBarRect = hoverBarRef.current?.getBoundingClientRect();
            const isOverLeftPane = isPointInRect(leftPaneRect, event.clientX, event.clientY);
            const isOverHoverBar = isPointInRect(hoverBarRect, event.clientX, event.clientY);
            const nextHovering = Boolean(isOverLeftPane || isOverHoverBar);
            setIsLeftPaneHovering(prev => (prev === nextHovering ? prev : nextHovering));
        };
        const handleMouseOut = (event) => {
            if (!event.relatedTarget) {
                setIsLeftPaneHovering(false);
            }
        };
        document.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseout", handleMouseOut);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseout", handleMouseOut);
        };
    }, [isLeftPaneCollapsed]);

    const isLeftPaneVisible = !isLeftPaneCollapsed || isLeftPaneHovering;

    return (
        <div className="app-wrapper">
            <ImpersonationBanner />
            <ConnectionErrorBanner />
            <WorkspaceHeader navigationCollapsed={isLeftPaneCollapsed}
                onToggleNavigation={() => setIsLeftPaneCollapsed(prev => !prev)} />
            <div className="content-wrapper">
                <div className={`left-pane${isLeftPaneCollapsed ? " collapsed" : ""}${isLeftPaneVisible ? " open" : ""}`}
                    ref={leftPaneRef} hidden={!isServers}>
                    <div className="left-pane-slot" id="left-pane-slot" />
                </div>
                <div className={`left-pane-hover-bar${isLeftPaneCollapsed ? " active" : ""}`} ref={hoverBarRef} hidden={!isServers} />
                <div className="main-content">
                    <div className="persistent-server-workspace" hidden={!isServers}>
                        <Suspense fallback={<Loading />}><Servers hidden={!isServers} /></Suspense>
                    </div>
                    {!isServers && <Suspense fallback={<Loading />}><Outlet /></Suspense>}
                </div>
            </div>
            <MobileNav />
            <ConnectionEvents />
        </div>
    );
};

const Root = () => (
    <AppProviders>
        <QuickActionProvider>
            <AppContent />
        </QuickActionProvider>
    </AppProviders>
);

export default Root;
