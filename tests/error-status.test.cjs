require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { errorStatus, sendFailure } = require('../server/utils/error');

test('failures are sent with their HTTP status and keep their code in the body', () => {
    assert.equal(errorStatus(404), 404);
    assert.equal(errorStatus(202), 401, 'a missing second factor is an unauthenticated sign-in');
    assert.equal(errorStatus(205), 403, 'a locked account is refused');
    assert.equal(errorStatus(107), 500, 'unknown application codes never pass as success');
    const sent = {};
    const res = { status(code) { sent.status = code; return this; }, json(body) { sent.body = body; return this; } };
    sendFailure(res, { code: 409, message: 'Exists', extra: 1 });
    assert.deepEqual(sent, { status: 409, body: { code: 409, message: 'Exists', extra: 1 } });
});

test('controllers and routes only use HTTP codes, apart from the sign-in codes 201-205', () => {
    for (const dir of ['controllers', 'routes', 'utils', 'middlewares', 'lib']) {
        for (const file of readdirSync(`${__dirname}/../server/${dir}`).filter(name => name.endsWith('.js'))) {
            const source = readFileSync(`${__dirname}/../server/${dir}/${file}`, 'utf8');
            for (const [, code] of source.matchAll(/\bcode: (\d{3})\b/g)) {
                const value = Number(code);
                assert.ok(value >= 400 || (value >= 201 && value <= 205), `${dir}/${file} uses code ${code}`);
            }
        }
    }
});
