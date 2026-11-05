#!/usr/bin/env node
/** Stage 77: prevent CI validation from silently regressing. No npm dependencies required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/nextgen-validation.yml'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const steps = workflow.split(/^      - name: /m).slice(1).map(x => x.split('\n')[0].trim());
const at = name => steps.indexOf(name);
const checks = [
  ['Locked install exists once', () => assert.equal((workflow.match(/(?:run: |^          )npm ci --no-audit --no-fund/gm)||[]).length,1)],
  ['Install before TypeScript/Jest/React build', () => {
    const install=at('Install locked dependencies');
    for (const name of ['Dependency preflight','Form 1040 integration regression (local TypeScript)','NextGen 2025 Jest tests','Compile React application'])
      assert.ok(install >= 0 && install < at(name), `${name} must follow install`);
  }],
  ['Dependency-free audits before install; TypeScript checks after install', () => {
    for (const name of ['Audit npm lockfile before install','Verify shipped IRS 2025 runtime tax table against source CSV'])
      assert.ok(at(name)>=0 && at(name)<at('Install locked dependencies'),name);
    for (const name of ['Offline-capable architecture tests','Presentation regression (local TypeScript)','Stage 77 workflow safeguards'])
      assert.ok(at(name)>at('Install locked dependencies'),name);
  }],
  ['Jest command is registered', () => assert.match(pkg.scripts['test:nextgen:2025'], /craco test.*--runInBand/)],
  ['Local compiler required', () => assert.match(fs.readFileSync(path.join(root,'tools/stage73-integration-regression.js'),'utf8'), /Local TypeScript compiler missing/)],
  ['Build runs in CI without warning suppression', () => {assert.match(workflow,/CI: 'true'/);assert.doesNotMatch(workflow,/CI: 'false'/);assert.match(workflow,/(?:run: |^          )npm run build/m)}],
  ['Build and diagnostic artifacts retained on failure', () => {assert.match(workflow,/if: always\(\)/);assert.match(workflow,/build\//);assert.match(workflow,/test-results\//)}],
  ['Source and build config trigger workflow', () => {for(const name of ['src/nextgen/**','scripts/**','craco.config.js','tsconfig.json']) assert.ok(workflow.includes(name),name)}],
  ['Never deploy or authorize tax filing', () => assert.doesNotMatch(workflow,/actions\/deploy-pages|filingReady: true|postingAuthorized: true/)],
  ['Explicit Node 18 environment', () => assert.match(workflow,/node-version: '18'/)],
];
for (const [label,run] of checks){run();console.log('PASS',label)}
console.log(`Stage 77: ${checks.length}/${checks.length} CI safeguard checks passed`);
