const logger = require("./logger");
const Entry = require("../models/Entry");
const stateBroadcaster = require("../lib/StateBroadcaster");

// run through sh since the login shell may not be POSIX
// Proxmox VE reports Debian in os-release, pveversion tells it apart
const OS_DETECTION_COMMAND = "sh -c 'cat /etc/os-release 2>/dev/null; test -x /usr/bin/pveversion && echo INFRA_W_PVE=1'";
const DETECTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DETECTION_TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 16 * 1024;

// names must match the OS filters in client/src/common/utils/osUtils.js
const OS_NAMES_BY_ID = {
    ubuntu: "Ubuntu",
    debian: "Debian",
    alpine: "Alpine Linux",
    fedora: "Fedora",
    centos: "CentOS",
    rhel: "Red Hat",
    rocky: "Rocky Linux",
    almalinux: "AlmaLinux",
    ol: "Oracle Linux",
    "opensuse-leap": "openSUSE",
    "opensuse-tumbleweed": "openSUSE",
    opensuse: "openSUSE",
    sles: "SUSE Linux Enterprise",
    arch: "Arch Linux",
};

const parseOsRelease = (output) => {
    if (!output) return null;
    if (/^INFRA_W_PVE=1$/m.test(output)) return "Proxmox VE";

    const fields = {};
    for (const line of output.split("\n")) {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (match) fields[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    }
    if (!fields.ID) return null;

    const known = OS_NAMES_BY_ID[fields.ID.toLowerCase()];
    return known || (fields.NAME || fields.PRETTY_NAME || fields.ID).slice(0, 64);
};

const runProbe = (ssh) => new Promise((resolve) => {
    let output = "", channel = null;
    const timer = setTimeout(() => { channel?.close(); resolve(null); }, DETECTION_TIMEOUT_MS);
    ssh.exec(OS_DETECTION_COMMAND, (err, stream) => {
        if (err) { clearTimeout(timer); return resolve(null); }
        channel = stream;
        stream.on("data", (chunk) => {
            if (output.length < MAX_OUTPUT_BYTES) output += chunk.toString();
        });
        stream.stderr.resume();
        stream.on("close", () => { clearTimeout(timer); resolve(output); });
    });
});

const detectEntryOs = async (ssh, entry) => {
    const lastAttempt = entry.osDetectedAt ? new Date(entry.osDetectedAt).getTime() : 0;
    if (Date.now() - lastAttempt < DETECTION_INTERVAL_MS) return;

    const osName = parseOsRelease(await runProbe(ssh));
    const changed = osName && osName !== entry.osName;
    await Entry.update({ osDetectedAt: new Date(), ...(changed && { osName }) }, { where: { id: entry.id } });

    if (changed) {
        logger.info("Detected operating system", { entryId: entry.id, osName });
        stateBroadcaster.broadcast("ENTRIES", { accountId: entry.accountId, organizationId: entry.organizationId });
    }
};

module.exports = { parseOsRelease, detectEntryOs, OS_NAMES_BY_ID };
