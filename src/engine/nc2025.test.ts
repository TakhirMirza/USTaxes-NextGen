/**
 * North Carolina D-400 tests, worked by hand from the 2025 D-401 instructions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { NcInput, TaxReturnInput } from './model.ts'
import { computeNorthCarolina, ncChildDeductionPer } from './nc2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 35 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number) => ({ ...emptyDependent(), name: 'Kid Payer', relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput> = {}, nc: Partial<NcInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'NC', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, nc: { ...r.nc, ...nc } }
}
const nc = (ret: TaxReturnInput) => computeNorthCarolina(ret, computeReturn(ret))

test('child deduction table', () => {
  assert.equal(ncChildDeductionPer('mfj', 40000), 3000)
  assert.equal(ncChildDeductionPer('mfj', 40001), 2500)
  assert.equal(ncChildDeductionPer('hoh', 50000), 2000)
  assert.equal(ncChildDeductionPer('single', 70000), 500)
  assert.equal(ncChildDeductionPer('single', 70001), 0)
})

test('single: NC standard deduction $12,750 and 4.25%', () => {
  const v = nc(base({ w2s: [w2(60000)] }, { withholding: { taxpayer: 2100, spouse: 0 } }))
  assert.equal(v.lines['11'], 12750)
  assert.equal(v.lines['14'], 47250)
  assert.equal(v.lines['15'], 2008)
  assert.equal(v.lines['28'], 92)
  assert.equal(v.lines['34'], 92)
})

test('head of household with two children: child deduction', () => {
  const v = nc(base({ filingStatus: 'hoh', w2s: [w2(50000)], dependents: [kid(5), kid(9)] }))
  assert.equal(v.lines['10a'], 2)
  assert.equal(v.lines['10b'], 4000)
  assert.equal(v.lines['14'], 50000 - 4000 - 19125)
  assert.equal(v.lines['15'], 1142)
})

test('joint itemizer: mortgage interest plus property tax capped at $20,000', () => {
  const v = nc(base({ filingStatus: 'mfj', w2s: [w2(150000)], itemized: { ...emptyReturn().itemized, mortgageInterest: 15000, realEstateTax: 8000, stateLocalIncomeOrSalesTax: 7000, charityCash: 6000 } }))
  assert.equal(v.deduction.mortgageAndTaxes, 20000)
  assert.equal(v.deduction.itemized, 26000)
  assert.equal(v.lines['11'], 26000)
})

test('Social Security deducted; U.S. interest deducted', () => {
  const v = nc(base({ w2s: [w2(30000)] }, { usObligationInterest: 500 }))
  assert.equal(v.scheduleS.deductions['18'], 500)
  assert.equal(v.lines['9'], 500)
})
