const {Sequelize} = require('sequelize');
const logger = require('./logger');

const { DB_PATH } = require('./dataPaths');

Sequelize.DATE.prototype._stringify = function(date) {
    return (date instanceof Date ? date : new Date(date)).toISOString();
};

const getCallerFromStack = () => {
    const originalPrepare = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack;
    Error.prepareStackTrace = originalPrepare;

    for (const frame of stack) {
        const fileName = frame.getFileName();
        if (!fileName || fileName.includes('node_modules') || fileName.includes('database.js') || fileName.includes('internal/')) continue;
        const file = fileName.split('/').slice(-2).join('/');
        const func = frame.getFunctionName();
        return func ? `${file}:${frame.getLineNumber()} ${func}()` : `${file}:${frame.getLineNumber()}`;
    }
    return 'sequelize';
};

module.exports = new Sequelize({
    dialect: 'sqlite',
    storage: DB_PATH,
    logging: (msg) => logger.baseLogger.debug(msg, { caller: getCallerFromStack() }),
    query: {raw: true}
});
