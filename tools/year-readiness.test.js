const assert = require('assert');
const {result} = require('./year-readiness');
const find = year => result.years.find(x=>x.year===year);
assert(find(2019), '2019 must remain declared');
assert.strictEqual(find(2019).unsupported,true,'2019 is deliberately unsupported');
for(const year of [2020,2021]){
 const entry=find(year);
 assert(entry && entry.declaredInEnum && entry.wiredFederal,`${year} must be wired`);
 assert(entry.files.federalEntry && entry.files.federalForm && entry.files.federalData && entry.files.taxTable,`${year} core files missing`);
 assert.strictEqual(entry.availableForFiling,false,'Structural checks must not imply filing readiness');
}
assert.strictEqual(find(2025),undefined,'Do not claim 2025 implemented');
assert.strictEqual(find(2026),undefined,'Do not claim 2026 implemented');
assert(result.issues.includes('Y2020: wired but no taxRates tests'), 'Missing 2020 tax-rate regression suite must be reported');
console.log('PASS: 2019 unsupported; 2020/2021 structurally wired; 2025/2026 not implemented. No tax correctness asserted.');
