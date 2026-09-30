// guacd/FreeRDP expects "sha1:aa:bb:..." entries
const DIGESTS = { 40: "sha1", 64: "sha256" };

const normalizeCertFingerprints = (value) => {
    const entries = String(value || "").split(",").map(part => part.trim()).filter(Boolean).map(part => {
        const hex = part.replace(/^sha(1|256):/i, "").replace(/[\s:]/g, "").toLowerCase();
        if (!/^[0-9a-f]+$/.test(hex) || !DIGESTS[hex.length]) throw new Error(`"${part}" is not a SHA-1 or SHA-256 fingerprint`);
        return `${DIGESTS[hex.length]}:${hex.match(/../g).join(":")}`;
    });
    return entries.length ? entries.join(",") : null;
};

module.exports = { normalizeCertFingerprints };
