import assert from 'node:assert/strict'
import fs from 'node:fs'
const src=fs.readFileSync('src/nextgen/taxYears/irs2025TaxTablePreview.ts','utf8')
const ui=fs.readFileSync('src/components/NextGen2025FederalReturn.tsx','utf8')
const cases=[
 ['single',11925],['single',48350],['marriedJoint',23850],['marriedJoint',96700],
 ['marriedSeparate',11925],['headOfHousehold',17000],['headOfHousehold',64850],
 ['qualifyingSurvivingSpouse',23850]
]
for(const [status,edge] of cases) {
 assert(src.includes(status),`Missing status ${status}`)
 assert(src.includes(String(edge)),`Missing threshold ${edge}`)
}
assert(src.includes('Math.floor(dollars/50)*50'))
assert(src.includes('Math.floor(marginalTax(intervalStart+25'))
assert(src.includes('input.year!==2025'))
assert(src.includes('taxableIncomeCents>=10000000'))
assert(ui.includes('copying disabled'))
assert(ui.includes("tablePreview.status==='preview'"))
assert(!ui.includes('setAmounts(p => ({...p,line16TaxCents:(tablePreview'))
console.log('Tax-table preview structural safety checks: PASS (NOT official table verification)')
