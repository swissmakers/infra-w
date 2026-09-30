const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { shellQuote } = require('../server/utils/shell');

test('quoted paths reach the shell unchanged', () => {
    for (const path of ["/srv/it's here", '/tmp/$(id) `id` ; rm -rf ~', "/a'b'c", '', '/with\nnewline']) {
        assert.equal(execFileSync('sh', ['-c', `printf %s ${shellQuote(path)}`], { encoding: 'utf8' }), path);
    }
});
