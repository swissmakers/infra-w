// sign-in codes the client tells apart, sent with these HTTP statuses
const SIGN_IN_CODES = { 201: 401, 202: 401, 203: 401, 204: 401, 205: 403 };

const errorStatus = (code) => (code >= 400 && code < 600 ? code : SIGN_IN_CODES[code] || 500);

module.exports.errorStatus = errorStatus;

module.exports.sendFailure = (res, { code, message, ...extra }) =>
    res.status(errorStatus(code)).json({ code, message, ...extra });
