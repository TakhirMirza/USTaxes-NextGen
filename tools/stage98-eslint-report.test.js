#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stage98-eslint-'));
try {
  const input = path.join(temp, 'lint.json');
  const output = path.join(temp, 'summary.json');
  fs.writeFileSync(input, JSON.stringify([
    { filePath: path.join(process.cwd(), 'src', 'example.ts'), errorCount: 1, warningCount: 2,
      messages: [{ ruleId: 'example-rule' }, { ruleId: 'example-rule' }] },
    { filePath: path.join(process.cwd(), 'src', 'clean.ts'), errorCount: 0, warningCount: 0, messages: [] },
  ]));
  const result = spawnSync(process.execPath, [path.join(__dirname, 'stage98-eslint-report.js'), input, output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(summary.errors, 1);
  assert.equal(summary.warnings, 2);
  assert.equal(summary.files.length, 1);
  assert.deepEqual(summary.files[0].rules, ['example-rule']);
  console.log('PASS Stage 98 ESLint report regression');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
