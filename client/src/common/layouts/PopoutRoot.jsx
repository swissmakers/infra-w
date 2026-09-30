import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import Loading from "@/common/components/Loading";
import { AppProviders } from "@/common/layouts/AppProviders.jsx";

const PopoutRoot = () => (
    <AppProviders>
        <Suspense fallback={<Loading />}>
            <Outlet />
        </Suspense>
    </AppProviders>
);

export default PopoutRoot;
