const {test}=require('node:test')
const assert=require('node:assert/strict')
const {check}=require('./stage78-tax-table-runtime-audit')
test('shipped 2025 tax table exactly matches extracted IRS CSV',()=>{const r=check();assert.equal(r.intervals,2062);assert.equal(r.values,8248);assert.equal(r.matching,true)})
