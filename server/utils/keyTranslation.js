const translateKeys = (data, config) => {
    if (!config || !data) return data;

    const isBuffer = Buffer.isBuffer(data);
    let str = isBuffer ? data.toString('binary') : data;

    if (config.backspaceMode === 'ctrl-h') str = str.replace(/\x7f/g, '\x08');
    if (config.deleteMode === 'del') str = str.replace(/\x1b\[3~/g, '\x7f');

    if (config.functionKeyMode === 'vt') {
        str = str.replace(/\x1bOP/g, '\x1b[11~');
        str = str.replace(/\x1bOQ/g, '\x1b[12~');
        str = str.replace(/\x1bOR/g, '\x1b[13~');
        str = str.replace(/\x1bOS/g, '\x1b[14~');
    } else if (config.functionKeyMode === 'linux') {
        str = str.replace(/\x1bOP/g, '\x1b[[A');
        str = str.replace(/\x1bOQ/g, '\x1b[[B');
        str = str.replace(/\x1bOR/g, '\x1b[[C');
        str = str.replace(/\x1bOS/g, '\x1b[[D');
        str = str.replace(/\x1b\[15~/g, '\x1b[[E');

        str = str.replace(/\x1b\[11~/g, '\x1b[[A');
        str = str.replace(/\x1b\[12~/g, '\x1b[[B');
        str = str.replace(/\x1b\[13~/g, '\x1b[[C');
        str = str.replace(/\x1b\[14~/g, '\x1b[[D');
    }

    return isBuffer ? Buffer.from(str, 'binary') : str;
};

module.exports = { translateKeys };
