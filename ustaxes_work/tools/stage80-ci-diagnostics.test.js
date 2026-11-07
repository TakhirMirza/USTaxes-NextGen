#!/usr/bin/env node
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const y=fs.readFileSync(path.join(root,'.github/workflows/nextgen-validation.yml'),'utf8');const p=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks=[
['npm ci log captured',/npm ci --no-audit --no-fund 2>&1 \| tee test-results\/npm-ci\.log/.test(y)],
['pipefail prevents masking failures',/set -o pipefail/.test(y)],
['Jest log captured',/npm run test:nextgen:2025 2>&1 \| tee test-results\/jest\.log/.test(y)],
['React build log captured',/npm run build 2>&1 \| tee test-results\/react-build\.log/.test(y)],
['integration log captured',/npm run test:integration:2025 2>&1 \| tee test-results\/integration\.log/.test(y)],
['artifact uploaded even after failure',/if: always\(\)/.test(y)&&/test-results\//.test(y)],
['artifact retention defined',/retention-days: 14/.test(y)],
['no filing authorization',!(/filingReady:\s*true|postingAuthorized:\s*true/.test(y))],
['offline script registered',p.scripts['test:stage80:offline']==='node tools/stage80-ci-diagnostics.test.js']];
for(const [name,ok] of checks){assert.ok(ok,name);console.log('PASS',name)}console.log(`Stage 80: ${checks.length}/${checks.length} checks passed`);
