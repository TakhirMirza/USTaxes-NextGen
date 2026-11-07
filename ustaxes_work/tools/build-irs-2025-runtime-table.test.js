const assert = require('assert')
const {build} = require('./build-irs-2025-runtime-table')
const {expectedIntervals} = require('./import-irs-2025-tax-table')
const intervals = expectedIntervals()
const header = 'lower,upper,single,marriedJoint,marriedSeparate,headOfHousehold'
const samples = new Map([[25200,[2789,2550,2789,2687]],[25250,[2795,2556,2795,2693]],[25300,[2801,2562,2801,2699]],[25350,[2807,2568,2807,2705]]])
const first = [0,1,2,4,6,9,11,14,16,19,21,24,26,29,31,34,36,39,41,44,46,49,51,54,56,59,61,64,66,69,71,74,76,79,81,84,86,89,91,94,96,99]
function makeCsv() {
  return [header,...intervals.map(([lo,hi],i)=>{
    const tax = i < first.length ? first[i] : lo >= 25400 ? 2807 + Math.floor((lo - 25350) * .1) : Math.floor(lo * .1)
    const values = samples.get(lo) || [tax,tax,tax,tax]
    return [lo,hi,...values].join(',')
  })].join('\n')+'\n'
}
const csv = makeCsv()
const result = build(csv,csv)
assert.equal(result.report.intervalsChecked,2062)
assert(result.source.includes('filing'))
assert(result.source.includes('IMPORTED_2025_TAX_ROWS'))
const broken = csv.replace('25300,25350,2801,2562,2801,2699','25300,25350,2801,2563,2801,2699')
assert.throws(()=>build(csv,broken))
console.log('Stage 21: 4 assertions passed (synthetic fixture, not IRS validation)')
