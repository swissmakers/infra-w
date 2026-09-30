import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";
import * as fs from "fs";

const guacamolePlugin = () => {
    const modulesDir = path.resolve(import.meta.dirname, '../vendor/guacamole-client/guacamole-common-js/src/main/webapp/modules');
    const virtualId = 'virtual:guacamole-common-js';

    return {
        name: 'guacamole-common-js',
        resolveId(id) {
            if (id === 'guacamole-common-js') return virtualId;
        },
        load(id) {
            if (id === virtualId) {
                const files = ['Namespace.js', ...fs.readdirSync(modulesDir)
                    .filter(f => f.endsWith('.js') && f !== 'Namespace.js').sort()];
                const content = files.map(f => fs.readFileSync(path.join(modulesDir, f), 'utf-8')).join('\n');
                return content + '\nexport default Guacamole;\n';
            }
        }
    };
}

const { version } = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8"));

export default defineConfig({
    plugins: [guacamolePlugin(), react()],
    define: { "import.meta.env.APP_VERSION": JSON.stringify(version.split(".").slice(0, 2).join(".")) },
    css: {
        preprocessorOptions: {
            sass: {
                api: "modern"
            }
        }
    },
    resolve: {
        alias: [
            { find: /^@mdi\/react$/, replacement: path.resolve(import.meta.dirname, "src/common/components/Icon.jsx") },
            { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
        ]
    },
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:6989",
                ws: true
            }
        }
    }
});
