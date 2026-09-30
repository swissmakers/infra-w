import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "@/common/styles/main.sass";
import { useSyncExternalStore, lazy } from "react";
import Root from "@/common/layouts/Root.jsx";
import PopoutRoot from "@/common/layouts/PopoutRoot.jsx";
import ShareRoot from "@/common/layouts/ShareRoot.jsx";
import i18n from "./i18n.js";
import Loading from "@/common/components/Loading";
import { RouteErrorPage } from "@/common/components/ErrorBoundary";

const Settings = lazy(() => import("@/pages/Settings/Settings.jsx"));
const Snippets = lazy(() => import("@/pages/Snippets"));
const Audit = lazy(() => import("@/pages/Audit"));
const Popout = lazy(() => import("@/pages/Popout"));
const Share = lazy(() => import("@/pages/Share"));

const router = createBrowserRouter([
        {
            path: "/",
            element: <Root />,
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/", element: <Navigate to="/servers" /> },
                { path: "/servers", element: null },
                { path: "/settings", element: <Settings /> },
                { path: "/settings/:section", element: <Settings /> },
                { path: "/audit", element: <Audit /> },
                { path: "/snippets", element: <Snippets /> }
            ],
        },
        {
            path: "/popout",
            element: <PopoutRoot />,
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/popout/:sessionId", element: <Popout /> }
            ],
        },
        {
            path: "/share",
            element: <ShareRoot />,
            errorElement: <RouteErrorPage />,
            children: [
                { path: "/share/:shareId", element: <Share /> }
            ],
        },
    ]);

const subscribeToTranslations = callback => {
    i18n.on("initialized", callback);
    return () => i18n.off("initialized", callback);
};

const App = () => {
    const translationsLoaded = useSyncExternalStore(subscribeToTranslations, () => i18n.isInitialized, () => false);

    if (!translationsLoaded) {
        return (
            <div className="app-wrapper">
                <Loading />
            </div>
        );
    }

    return <RouterProvider router={router}/>;
};

export default App;
