const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const sanitizeFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

module.exports = class SmbProvider {
    constructor(provider) {
        this.share = provider.share || "";
        this.folder = provider.folder || "";
        this.username = provider.username || "";
        this.password = provider.password || "";
        this.domain = provider.domain || "";
    }

    buildCommands(cmd) {
        const commands = [];
        if (this.folder) commands.push(`cd "${this.folder}"`);
        commands.push(cmd);
        return commands.join("; ");
    }

    exec(cmdStr, timeout = 30000) {
        if (!this.share) throw new Error("SMB share is required");

        // PASSWD keeps the password out of the process list
        const auth = this.username && this.password ? ["-U", (this.domain ? `${this.domain}/` : "") + this.username] : ["-N"];

        try {
            return execFileSync("smbclient", [this.share, ...auth, "-c", cmdStr], {
                encoding: "utf8",
                timeout,
                env: { ...process.env, PASSWD: this.password },
                stdio: ["ignore", "pipe", "pipe"],
            });
        } catch (error) {
            const output = error.stdout || error.stderr || error.message;
            const status = output.match(/NT_STATUS_\w+/);
            throw new Error(status ? status[0] : output.split("\n")[0]);
        }
    }

    withTempFile(prefix, fn) {
        const tempFile = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        try {
            return fn(tempFile);
        } finally {
            try { fs.unlinkSync(tempFile); } catch {}
        }
    }

    async test() {
        this.exec(this.folder ? `cd "${this.folder}"` : "ls");
        return true;
    }

    async upload(buffer, name) {
        const safeName = sanitizeFilename(name);
        return this.withTempFile("smb-upload", (tempFile) => {
            fs.writeFileSync(tempFile, buffer);
            this.exec(this.buildCommands(`put "${tempFile}" "${safeName}"`), 300000);
        });
    }

    async download(name) {
        const safeName = sanitizeFilename(name);
        return this.withTempFile("smb-download", (tempFile) => {
            this.exec(this.buildCommands(`get "${safeName}" "${tempFile}"`), 300000);
            return fs.readFileSync(tempFile);
        });
    }

    async list() {
        try {
            const output = this.exec(this.buildCommands("ls"));
            return output.split("\n")
                .map(line => line.match(/^\s*(backup-\S+\.tar\.gz)\s+[AHDRS]*\s*(\d+)/))
                .filter(Boolean)
                .map(match => ({ name: match[1], size: parseInt(match[2]), created: new Date() }))
                .sort((a, b) => b.name.localeCompare(a.name));
        } catch (error) {
            if (error.message.includes("NO_SUCH_FILE") || error.message.includes("OBJECT_NAME_NOT_FOUND")) {
                return [];
            }
            throw error;
        }
    }

    async delete(name) {
        try {
            this.exec(this.buildCommands(`del "${sanitizeFilename(name)}"`));
        } catch {}
    }
};
