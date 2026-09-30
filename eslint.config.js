const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    {
        files: ["server/**/*.js", "tests/**/*.cjs", "scripts/**/*.{js,cjs}", "eslint.config.js"],
        languageOptions: { ecmaVersion: 2024, sourceType: "commonjs", globals: globals.node },
        rules: {
            ...js.configs.recommended.rules,
            "no-empty": ["error", { allowEmptyCatch: true }],
            "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
        },
    },
    {
        // terminal escape sequences
        files: ["server/utils/keyTranslation.js", "server/utils/scriptUtils.js"],
        rules: { "no-control-regex": "off" },
    },
    {
        // page.evaluate() callbacks run in the browser
        files: ["tests/browser-smoke.cjs", "scripts/screenshots.cjs"],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
    },
];
