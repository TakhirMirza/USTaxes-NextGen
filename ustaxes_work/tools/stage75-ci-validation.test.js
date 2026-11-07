#!/usr/bin/env node
/** Dependency-free static checks for the new CI workflow. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/nextgen-validation.yml'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks=[
 ['CI runs on main and master',()=>assert.match(workflow,/branches: \[main, master\]/)],
 ['Locked install is used',()=>assert.match(workflow,/npm ci --no-audit --no-fund/)],
 ['Integration checks follow install',()=>assert.ok(workflow.indexOf('npm run test:integration:2025')>workflow.indexOf('npm ci --no-audit'))],
 ['Strict dependency check runs before build',()=>assert.ok(workflow.indexOf('npm run preflight:build:strict')<workflow.indexOf('npm run build'))],
 ['React build runs in CI',()=>assert.match(workflow,/npm run build(?:\s|$)/)],
 ['No filing or deploy action',()=>{assert.doesNotMatch(workflow,/actions\/deploy-pages|gh release|filingReady: true/);}],
 ['Offline test command registered',()=>assert.match(pkg.scripts['test:stage75:offline'],/stage75-ci-validation/)],
];
for(const [name,run] of checks){run();console.log('PASS',name)}
console.log(`${checks.length}/${checks.length} Stage 75 CI checks passed`);
