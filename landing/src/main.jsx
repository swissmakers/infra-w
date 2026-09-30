import React from "react";
import ReactDOM from "react-dom/client";
import "@/common/styles/fonts.sass";
import "@/common/styles/default.sass";
import {createBrowserRouter, RouterProvider} from "react-router-dom";
import Root from "@/common/layouts/Root";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Install from "@/pages/Install";
import Changelog from "@/pages/Changelog";

const router = createBrowserRouter([
    {
        path: "/",
        element: <Root/>,
        errorElement: <NotFound />,
        children: [
            {index: true, element: <Home />},
            {path: "install", element: <Install />},
            {path: "changelog", element: <Changelog />},
        ]
    }
]);

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <RouterProvider router={router}/>
    </React.StrictMode>,
);
