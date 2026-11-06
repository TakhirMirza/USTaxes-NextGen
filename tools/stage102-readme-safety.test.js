// Documentation regression: keep the public landing page honest about filing readiness.
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
const firstSection = readme.split('## Origin and legacy documentation')[0];
for (const token of ['NOT READY FOR TAX FILING', '2025:', '2026–2028+:', 'filingReady: false', 'postingAuthorized: false', 'CI=false', 'Node.js 18']) {
  assert(firstSection.includes(token), `README missing public safety notice: ${token}`);
}
assert(firstSection.indexOf('NOT READY FOR TAX FILING') < firstSection.indexOf('## Project status'), 'Filing warning must be prominent');
console.log('PASS Stage 102 public README non-filing safety notices');
