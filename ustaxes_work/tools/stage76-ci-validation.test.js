#!/usr/bin/env node
/** Stage 76: CI must install dependencies before TypeScript/Jest, and must not hide warnings. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root,'.github/workflows/nextgen-validation.yml'),'utf8');
const integration = fs.readFileSync(path.join(root,'tools/stage73-integration-regression.js'),'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks = [
  ['Locked installation precedes TypeScript regression', () => assert.ok(workflow.indexOf('npm ci --no-audit') < workflow.indexOf('npm run test:integration:2025'))],
  ['Locked installation precedes Jest', () => assert.ok(workflow.indexOf('npm ci --no-audit') < workflow.indexOf('npm run test:nextgen:2025'))],
  ['Jest suite explicitly registered', () => assert.match(pkg.scripts['test:nextgen:2025'], /--testPathPattern=src\/nextgen\/taxYears/)],
  ['Integration uses local TypeScript compiler', () => assert.match(integration, /node_modules.*\.bin.*tsc/)],
  ['Integration rejects missing local compiler', () => assert.match(integration, /Local TypeScript compiler missing/)],
  ['CI does not suppress build warnings', () => assert.doesNotMatch(workflow, /CI: 'false'/)],
  ['CI never deploys or marks filing-ready', () => assert.doesNotMatch(workflow, /actions\/deploy-pages|filingReady: true/)],
  ['Strict preflight precedes integration', () => assert.ok(workflow.indexOf('npm run preflight:build:strict') < workflow.indexOf('npm run test:integration:2025'))],
];
for (const [label,check] of checks) { check(); console.log('PASS', label); }
console.log(`${checks.length}/${checks.length} Stage 76 CI validation checks passed`);
