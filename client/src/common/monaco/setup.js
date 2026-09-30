import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import JsonWorker from "monaco-editor/languages/features/json/json.worker.js?worker";
import CssWorker from "monaco-editor/languages/features/css/css.worker.js?worker";
import HtmlWorker from "monaco-editor/languages/features/html/html.worker.js?worker";
import TypeScriptWorker from "monaco-editor/languages/features/typescript/ts.worker.js?worker";

loader.config({ monaco });
window.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === "json") return new JsonWorker();
        if (["css", "scss", "less"].includes(label)) return new CssWorker();
        if (["html", "handlebars", "razor"].includes(label)) return new HtmlWorker();
        if (["typescript", "javascript"].includes(label)) return new TypeScriptWorker();
        return new EditorWorker();
    },
};
