#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage103-eslint-'));
const file = path.join(dir, 'summary.json');
const run = () => spawnSync(process.execPath, [path.join(__dirname, 'stage103-eslint-budget.js'), file], { encoding: 'utf8' });
const write = (errors, warnings) => fs.writeFileSync(file, JSON.stringify({ errors, warnings,
  files: [{ file: 'src/test.ts', errors, warnings }], rules: [] }));
try {
  write(10, 70); assert.equal(run().status, 0, 'baseline should pass');
  write(0, 0); assert.equal(run().status, 0, 'clean report should pass');
  write(11, 70); assert.notEqual(run().status, 0, 'new errors must fail');
  write(10, 71); assert.notEqual(run().status, 0, 'new warnings must fail');
  fs.writeFileSync(file, '{bad'); assert.notEqual(run().status, 0, 'invalid report must fail');
  fs.rmSync(file); assert.notEqual(run().status, 0, 'missing report must fail');
  console.log('PASS Stage 103 ESLint budget tests: baseline, clean, errors, warnings, malformed, missing');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
