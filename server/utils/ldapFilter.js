// RFC 4515 assertion value escaping
const escapeFilterValue = value => String(value ?? "").replace(/[\\*()\0]/g, char =>
    `\\${char.charCodeAt(0).toString(16).padStart(2, "0")}`);

const buildSearchFilter = (template, replacements = {}, { wildcardUsername = false } = {}) =>
    String(template || "").replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
        if (!Object.hasOwn(replacements, key)) return placeholder;
        if (wildcardUsername && key === "username" && replacements[key] === "*") return "*";
        return escapeFilterValue(replacements[key]);
    });

module.exports = { escapeFilterValue, buildSearchFilter };
