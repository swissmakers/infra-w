// POSIX single quotes; an embedded quote closes, escapes and reopens the string
const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

module.exports = { shellQuote };
