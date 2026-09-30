import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const screenshots = path.resolve(import.meta.dirname, "../docs/assets/screenshots");

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
            "@screenshots": screenshots,
        },
    },
    server: {
        fs: { allow: [import.meta.dirname, screenshots] },
    },
});
