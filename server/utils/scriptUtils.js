const escapeColons = (t) => t.replace(/:/g, "\\x3A");
const unescapeColons = (t) => t.replace(/\\x3A/g, ":");

const parseOptions = (str) => {
    const s = str.replace(/\\"/g, "\"");
    const opts = [];
    let cur = "", inQ = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "\"" && (i === 0 || s[i - 1] === " ")) inQ = true;
        else if (c === "\"" && inQ) { inQ = false; opts.push(cur.trim()); cur = ""; }
        else if (c === " " && !inQ) { if (cur.trim()) { opts.push(cur.trim()); cur = ""; } }
        else cur += c;
    }
    if (cur.trim()) opts.push(cur.trim());
    return opts;
};

const checkSudoPrompt = (output) => {
    const patterns = ["[sudo] password for", "Password:", "sudo: a password is required", "sudo: a terminal is required"];
    if (!patterns.some(p => output.includes(p))) return null;
    const m = output.match(/\[sudo\] password for ([^:]+):/);
    return { variable: "SUDO_PASSWORD", prompt: `Enter sudo password for ${m?.[1] || "user"}`, default: "", isSudoPassword: true, type: "password" };
};

const transformScript = (content) => {
    const esc = escapeColons;
    let t = content
        .replace(/^(\s*)sudo(?!\s+-S)(\s+)/gm, "$1sudo -S$2")
        .replace(/^(\s*)@INFRA-W:STEP\s+"((?:\\.|[^"\\])*)"/gm, "$1echo \"INFRA_W_STEP:$2\"")
        .replace(/^(\s*)@INFRA-W:INPUT\s+(\S+)\s+"((?:\\.|[^"\\])*)"(?:\s+"((?:\\.|[^"\\]*)*)")?/gm, (_, i, v, p, d) =>
            `${i}echo "INFRA_W_INPUT:${v}:${esc(p)}:${d ? esc(d) : ""}" && read -r ${v}`)
        .replace(/^(\s*)@INFRA-W:SELECT\s+(\S+)\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm, (_, i, v, p, o) =>
            `${i}echo "INFRA_W_SELECT:${v}:${esc(p)}:${esc(o).replace(/"/g, "\\\"")}" && read -r ${v}`)
        .replace(/^(\s*)@INFRA-W:WARN\s+"((?:\\.|[^"\\])*)"/gm, (_, i, m) => `${i}echo "INFRA_W_WARN:${esc(m)}"`)
        .replace(/^(\s*)@INFRA-W:INFO\s+"((?:\\.|[^"\\])*)"/gm, (_, i, m) => `${i}echo "INFRA_W_INFO:${esc(m)}"`)
        .replace(/^(\s*)@INFRA-W:ERROR\s+"((?:\\.|[^"\\])*)"/gm, (_, i, m) => `${i}echo "INFRA_W_ERROR:${esc(m)}"`)
        .replace(/^(\s*)@INFRA-W:CONFIRM\s+"((?:\\.|[^"\\])*)"/gm, (_, i, m) =>
            `${i}echo "INFRA_W_CONFIRM:${esc(m)}" && read -r INFRA_W_CONFIRM_RESULT`)
        .replace(/^(\s*)@INFRA-W:PROGRESS\s+(\$?\w+|\d+)/gm, "$1echo \"INFRA_W_PROGRESS:$2\"")
        .replace(/^(\s*)@INFRA-W:SUCCESS\s+"((?:\\.|[^"\\])*)"/gm, (_, i, m) => `${i}echo "INFRA_W_SUCCESS:${esc(m)}"`)
        .replace(/^(\s*)@INFRA-W:SUMMARY\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm, (_, i, ti, d) =>
            `${i}echo "INFRA_W_SUMMARY:${esc(ti).replace(/"/g, "\\\"")}:${esc(d).replace(/"/g, "\\\"")}" && read -r INFRA_W_SUMMARY_RESULT`)
        .replace(/^(\s*)@INFRA-W:TABLE\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm, (_, i, ti, d) =>
            `${i}echo "INFRA_W_TABLE:${esc(ti).replace(/"/g, "\\\"")}:${esc(d).replace(/"/g, "\\\"")}" && read -r INFRA_W_TABLE_RESULT`)
        .replace(/^(\s*)@INFRA-W:MSGBOX\s+"((?:\\.|[^"\\])*)"\s+"((?:\\.|[^"\\])*)"/gm, (_, i, ti, m) =>
            `${i}echo "INFRA_W_MSGBOX:${esc(ti)}:${esc(m)}" && read -r INFRA_W_MSGBOX_RESULT`);

    const script = `#!/bin/bash\nset -e\n${t}\n`;
    const b64 = Buffer.from(script).toString("base64");
    return { b64, command: null };
};

const getScriptCommands = (b64) => {
    const CHUNK_SIZE = 2000;
    const commands = [];

    commands.push(`_nts=$(mktemp) && _ntb=$(mktemp)`);

    for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
        const chunk = b64.slice(i, i + CHUNK_SIZE);
        commands.push(`printf '%s' '${chunk}' >> "$_ntb"`);
    }

    commands.push(`base64 -d < "$_ntb" > "$_nts" && rm -f "$_ntb" && chmod +x "$_nts" && "$_nts"; _exit=$?; rm -f "$_nts"; echo "INFRA_W_END:$_exit"`);

    return commands;
};

const stripAnsi = (s) => s.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");

const findInfraWCommand = (line) => {
    const clean = stripAnsi(line);
    if (clean.match(/echo\s+["']?INFRA_W_/i) || clean.trim().match(/^[$#>]\s+.*INFRA_W_/)) return null;
    const m = clean.match(/INFRA_W_(INPUT|SELECT|STEP|WARN|INFO|ERROR|CONFIRM|PROGRESS|SUCCESS|SUMMARY|TABLE|MSGBOX|END):(.*)/s);
    return m ? { command: `INFRA_W_${m[1]}`, rest: m[2] } : null;
};

const processInfraWLine = (line) => {
    const found = findInfraWCommand(line);
    if (!found) return null;
    const { command, rest } = found;
    const parts = rest.split(":");
    const unescape = unescapeColons;

    switch (command) {
        case "INFRA_W_INPUT":
            return { type: "input", variable: parts[0], prompt: unescape(parts[1] || ""), default: parts[2] ? unescape(parts[2]) : "" };
        case "INFRA_W_SELECT": {
            const opts = parseOptions(unescape(parts.slice(2).join(":")));
            return { type: "select", variable: parts[0], prompt: unescape(parts[1] || ""), options: opts, default: opts[0] || "" };
        }
        case "INFRA_W_STEP": return { type: "step", description: rest.trim() };
        case "INFRA_W_WARN": return { type: "warning", message: unescape(rest) };
        case "INFRA_W_INFO": return { type: "info", message: unescape(rest) };
        case "INFRA_W_ERROR": return { type: "error", message: unescape(rest) };
        case "INFRA_W_CONFIRM": return { type: "confirm", message: unescape(rest) };
        case "INFRA_W_PROGRESS": return { type: "progress", percentage: parseInt(rest.split(":")[0]) || 0 };
        case "INFRA_W_SUCCESS": return { type: "success", message: unescape(rest) };
        case "INFRA_W_SUMMARY": {
            const data = parseOptions(unescape(parts.slice(1).join(":")));
            return { type: "summary", title: unescape(parts[0] || ""), data };
        }
        case "INFRA_W_TABLE": {
            const data = parseOptions(unescape(parts.slice(1).join(":")));
            return { type: "table", title: unescape(parts[0] || ""), data };
        }
        case "INFRA_W_MSGBOX": return { type: "msgbox", title: unescape(parts[0] || ""), message: unescape(parts.slice(1).join(":")) };
        case "INFRA_W_END": return { type: "end", exitCode: parseInt(rest.trim()) || 0 };
        default: return null;
    }
};

module.exports = { checkSudoPrompt, transformScript, getScriptCommands, processInfraWLine };