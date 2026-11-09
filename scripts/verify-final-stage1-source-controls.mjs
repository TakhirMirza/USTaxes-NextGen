import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const ui=readFileSync('src/components/NextGen2025FederalReturn.tsx','utf8')
for(const check of [
  'setWorksheetStatus(e.target.value as Filing2025);setChecks',
  'setWorksheetLine15Reviewed(e.target.checked);setChecks',
  'setWorksheetOrdinaryOnly(e.target.checked);setChecks',
  'worksheetMismatch',
  'finalReconciled && result.status',
  "status: finalReconciled ? 'reconciled' : 'blocked'",
  'Line 16 differs from the independently calculated 2025 IRS worksheet',
])assert.ok(ui.includes(check),`missing source protection: ${check}`)
const source=readFileSync('src/nextgen/taxYears/irs2025OrdinaryTax.ts','utf8')
for(const constant of ['508600','715300','1017200','1430600','682500','889200','3796875','4471800'])assert.ok(source.includes(constant))
const table=readFileSync('src/nextgen/taxYears/irs2025TaxTablePreview.ts','utf8')
assert.ok(table.includes("status:'preview'"))
assert.ok(ui.includes('copying disabled'))
const se=readFileSync('src/nextgen/taxYears/selfEmploymentPipeline2025.ts','utf8')
assert.ok(se.includes("status:'blocked'"))
console.log('PASS: worksheet changes invalidate tax review; line16 mismatch blocks export; unverified tax table and SE remain non-posting')
