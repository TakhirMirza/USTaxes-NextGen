import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const s=readFileSync('src/nextgen/taxYears/irs2025OrdinaryTax.ts','utf8')
for(const v of ['508600','715300','1017200','1430600','682500','889200','3796875','4471800'])assert.ok(s.includes(v),`missing IRS worksheet constant ${v}`)
assert.ok(s.includes('input.taxableIncomeCents<10000000'),'Missing IRS Tax Table gate')
assert.ok(s.includes('ordinaryIncomeOnlyConfirmed')&&s.includes('line15Reconciled'),'Missing safety gates')
console.log('IRS worksheet constants and safety gates: PASS (static check, not independent tax certification)')
