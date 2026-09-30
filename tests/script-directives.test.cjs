require('./support/isolate.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transformScript, processInfraWLine } = require('../server/utils/scriptUtils');

const lines = script => Buffer.from(transformScript(script).b64, 'base64').toString().split('\n');
const roundTrip = directive => processInfraWLine(lines(directive)[2].replace(/^echo "|"( &&.*)?$/g, '').replace(/\\"/g, '"'));

test('scripts run in bash with set -e and sudo reading the password from stdin', () => {
    const [shebang, strict, command] = lines('sudo systemctl restart nginx');
    assert.equal(shebang, '#!/bin/bash');
    assert.equal(strict, 'set -e');
    assert.equal(command, 'sudo -S systemctl restart nginx');
});

test('every directive becomes a marker that is parsed back', () => {
    assert.deepEqual(roundTrip('@INFRA-W:STEP "Collect input"'), { type: 'step', description: 'Collect input' });
    assert.deepEqual(roundTrip('@INFRA-W:INPUT HOST "Target host" "localhost"'), { type: 'input', variable: 'HOST', prompt: 'Target host', default: 'localhost' });
    assert.deepEqual(roundTrip('@INFRA-W:SELECT MODE "Mode" "A" "B"'), { type: 'select', variable: 'MODE', prompt: 'Mode', options: ['A', 'B'], default: 'A' });
    assert.deepEqual(roundTrip('@INFRA-W:CONFIRM "Sure?"'), { type: 'confirm', message: 'Sure?' });
    assert.deepEqual(roundTrip('@INFRA-W:INFO "Starting: now"'), { type: 'info', message: 'Starting: now' });
    assert.deepEqual(roundTrip('@INFRA-W:WARN "Low disk"'), { type: 'warning', message: 'Low disk' });
    assert.deepEqual(roundTrip('@INFRA-W:ERROR "Config: missing"'), { type: 'error', message: 'Config: missing' });
    assert.deepEqual(roundTrip('@INFRA-W:SUCCESS "Done"'), { type: 'success', message: 'Done' });
    assert.deepEqual(roundTrip('@INFRA-W:PROGRESS 40'), { type: 'progress', percentage: 40 });
    assert.deepEqual(roundTrip('@INFRA-W:MSGBOX "Completed" "Operation finished"'), { type: 'msgbox', title: 'Completed', message: 'Operation finished' });
});

test('answers are read into variables, confirmations into INFRA_W_CONFIRM_RESULT', () => {
    assert.match(lines('@INFRA-W:INPUT HOST "Target host"')[2], /&& read -r HOST$/);
    assert.match(lines('@INFRA-W:CONFIRM "Sure?"')[2], /&& read -r INFRA_W_CONFIRM_RESULT$/);
});

test('echoed markers and unknown directives are left alone', () => {
    assert.equal(processInfraWLine('echo "INFRA_W_STEP:x"'), null);
    assert.equal(lines('@OTHER:INFO "x"')[2], '@OTHER:INFO "x"');
});
