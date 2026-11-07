'use strict'
const assert = require('assert')
const {auditIndependentTranscriptions} = require('./audit-irs-2025-tax-table')
const {expectedIntervals} = require('./import-irs-2025-tax-table')
const ranges = expectedIntervals()
const first = [0,1,2,4,6,9,11,14,16,19,21,24,26,29,31,34,36,39,41,44,46,49,51,54,56,59,61,64,66,69,71,74,76,79,81,84,86,89,91,94,96,99]
const sample = new Map([[25200,[2789,2550,2789,2687]],[25250,[2795,2556,2795,2693]],[25300,[2801,2562,2801,2699]],[25350,[2807,2568,2807,2705]]])
// Synthetic fixture satisfies structural controls but is NOT IRS data.
const lines = ranges.map(([a,b],i) => {
  const tax = i < first.length ? [first[i],first[i],first[i],first[i]] :
    sample.has(a) ? sample.get(a) : a < 25200 ? [2500,2300,2500,2400] :
    a >= 25400 ? [3000,2800,3000,2900] : [2807,2568,2807,2705]
  return [a,b,...tax].join(',')
})
const header = 'lower,upper,single,marriedJoint,marriedSeparate,headOfHousehold\n'
const csv = header + lines.join('\n') + '\n'
const good = auditIndependentTranscriptions(csv,csv)
assert.strictEqual(good.intervalsChecked,2062)
assert.strictEqual(good.valuesChecked,8248)
assert.strictEqual(good.transcriptionsAgree,true)
assert.strictEqual(good.filingReady,false)
assert.strictEqual(good.independentlyVerifiedAgainstIRS,false)
const edited = [...lines]
const index = ranges.length - 1
const cells = edited[index].split(',');cells[2]=String(Number(cells[2])+1);edited[index]=cells.join(',')
const changed = auditIndependentTranscriptions(csv,header+edited.join('\n')+'\n')
assert.strictEqual(changed.transcriptionsAgree,false)
assert.strictEqual(changed.mismatches.length,1)
assert.strictEqual(changed.mismatches[0].field,'single')
assert.notStrictEqual(changed.firstSha256,changed.secondSha256)
assert.throws(()=>auditIndependentTranscriptions(csv,'bad'),/CSV must have header and rows/)
console.log('PASS: Stage 20 independent transcription comparison (9 assertions; synthetic fixtures only)')
