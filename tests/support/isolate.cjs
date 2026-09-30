// Keeps server tests off the real data directory, which is the production volume on this host
const path = require('path');
const { Sequelize } = require('sequelize');

// relative paths are taken from tests/, like the requires in the test files
const stub = (modulePath, exports) => {
    const id = require.resolve(modulePath.startsWith('.') ? path.resolve(__dirname, '..', modulePath) : modulePath);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};
const quiet = () => {};

stub('../server/utils/database', new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, query: { raw: true } }));
stub('../server/utils/logger', { info: quiet, warn: quiet, error: quiet, system: quiet, verbose: quiet, debug: quiet, baseLogger: { debug: quiet } });

module.exports = { stub };
