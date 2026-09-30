import { defineConfig } from "vitepress";

import { useSidebar } from "vitepress-openapi";
import spec from "../public/openapi.json";

const sidebar = useSidebar({ spec, linkPrefix: "/operations/" });

export default defineConfig({
    title: "INFRA-W",
    description: "Infrastructure Workspace: self-hosted browser access to SSH, RDP and VNC with file management, automation and audit",
    lastUpdated: true,
    cleanUrls: true,
    metaChunk: true,

    vite: {
        build: { target: ["chrome111", "edge111", "firefox114", "safari16.4"] },
    },

    head: [
        ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
        ["link", { rel: "icon", type: "image/png", href: "/favicon.png" }],
        ["meta", { name: "theme-color", content: "#00204b" }],
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:locale", content: "en" }],
        ["meta", { property: "og:title", content: "INFRA-W - Infrastructure Workspace" }],
        ["meta", { property: "og:site_name", content: "INFRA-W" }],
        ["meta", { property: "og:image", content: "https://raw.githubusercontent.com/swissmakers/infra-w/main/docs/assets/screenshots/workspace-dark.png" }],
        ["meta", { property: "og:image:type", content: "image/png" }],
        ["meta", { property: "twitter:card", content: "summary_large_image" }],
        ["meta", { property: "twitter:image:src", content: "https://raw.githubusercontent.com/swissmakers/infra-w/main/docs/assets/screenshots/workspace-dark.png" }],
        ["meta", { property: "og:url", content: "https://github.com/swissmakers/infra-w" }],
    ],
    themeConfig: {
        logo: "/logo.svg",

        nav: [
            { text: "Home", link: "/" },
            { text: "Install", link: "/installation" },
        ],

        footer: {
            message: '<a href="/licensing">Licensing and Commercial Terms</a>',
            copyright: "© Swissmakers GmbH and contributors",
        },
        search: {
            provider: "local",
        },

        sidebar: [
            {
                text: "Getting Started",
                items: [
                    { text: "Home", link: "/" },
                    { text: "Install", link: "/installation" },
                    { text: "Screenshots", link: "/screenshots" },
                ],
            },
            {
                text: "Using INFRA-W",
                items: [
                    { text: "Workspace", link: "/workspace" },
                    { text: "Integrations", link: "/integrations" },
                    { text: "Organizations and Audit", link: "/organizations-and-audit" },
                    { text: "Users and Sign-in", link: "/administration" },
                    { text: "Operating System Detection", link: "/os-detection" },
                ],
            },
            {
                text: "Operations",
                items: [
                    { text: "SSL/HTTPS", link: "/ssl" },
                    { text: "Reverse Proxy", link: "/reverse-proxy" },
                    { text: "Backup and Restore", link: "/backup" },
                ],
            },
            {
                text: "Authentication",
                items: [
                    { text: "LDAP", link: "/ldap" },
                    { text: "OIDC / SSO", link: "/oidc" },
                ],
            },
            {
                text: "Integrations & Automation",
                items: [
                    { text: "Scripts & Snippets", link: "/scripts&snippets" },
                    { text: "Scripting Variables & Directives", link: "/ScriptingVariables" },
                ],
            },
            {
                text: "API",
                items: [
                    { text: "API Reference", link: "/api-reference" },
                    ...sidebar.generateSidebarGroups(),
                ],
            },
            {
                text: "Project",
                items: [
                    { text: "Contributing", link: "/contributing" },
                    { text: "Licensing", link: "/licensing" },
                ],
            },
        ],

        socialLinks: [
            { icon: "github", link: "https://github.com/swissmakers/infra-w" },
            { icon: "website", link: "https://swissmakers.ch" },
        ],
    },
});
