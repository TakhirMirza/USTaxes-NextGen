import fs from 'node:fs'
import assert from 'node:assert/strict'
const table=fs.readFileSync('src/nextgen/taxYears/irs2025TaxTablePreview.ts','utf8')
const scenario=fs.readFileSync('src/nextgen/taxYears/federalTaxScenario2025.ts','utf8')
const ui=fs.readFileSync('src/components/NextGen2025FederalReturn.tsx','utf8')
for(const [file,name] of [[table,'tax table preview'],[scenario,'scenario engine']]) {
  assert(!file.includes('48350'), `${name}: stale 2025 single threshold`)
  assert(!file.includes('96700'), `${name}: stale 2025 joint threshold`)
  assert(file.includes('48475'),`${name}: missing official 2025 single threshold`)
  assert(file.includes('96950'),`${name}: missing official 2025 joint threshold`)
}
assert(table.includes('taxableIncomeCents>=10000000'),'Tax Table must stop at $100k')
assert(table.includes('ordinaryIncomeOnlyConfirmed'),'Special-method blocker missing')
assert(table.includes('line15Reconciled'),'Line 15 review blocker missing')
assert(ui.includes('setWithholdingConfirmed(false)'),'Editing amounts must reset withholding confirmation')
assert(ui.includes('independentTaxReview:false, independentCreditReview:false'),'Editing amounts must reset reviews')
assert(ui.includes('copying disabled'),'Unverified Tax Table must remain non-posting')
console.log('Final Stage 1 — corrected thresholds, invalidation, and non-posting checks PASS')
