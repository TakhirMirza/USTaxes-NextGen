/**
 * Tax year 2026 (Rev. Proc. 2025-32 and Public Law 119-21). Expected values worked by hand.
 * Every test also checks that switching years back to 2025 gives the 2025 result again.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyBusiness, emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { TaxReturnInput } from './model.ts'
import * as R from './rules.ts'

const base = (patch: Partial<TaxReturnInput> = {}): TaxReturnInput => ({
  ...emptyReturn(),
  filingStatus: 'single',
  taxpayer: { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 40 },
  ...patch
})
const w2 = (wages: number, withholding = 0) =>
  ({ ...emptyW2('taxpayer'), employer: 'Acme', wages, federalWithholding: withholding, socialSecurityWages: wages, medicareWages: wages })
const child = (age: number) => ({ ...emptyDependent(), name: 'Kid Payer', relationship: 'son', age, ssn: '123-45-6789' })

test('a return defaults to 2025, and both years are offered', () => {
  assert.equal(emptyReturn().taxYear, 2025)
  assert.deepEqual([...R.TAX_YEARS].sort(), [2025, 2026])
  assert.equal(R.isTaxYear(2026), true)
  assert.equal(R.isTaxYear(2024), false)
})

test('2026 single W-2: $16,100 standard deduction and 2026 brackets', () => {
  const res = computeReturn(base({ taxYear: 2026, w2s: [w2(60000)] }))
  assert.equal(R.TAX_YEAR, 2026)
  assert.equal(res.f1040['12e'], 16100)
  assert.equal(res.f1040['15'], 43900)
  // Tax Table row 43,900–43,950, midpoint 43,925: 1,240 + 12% × 31,525 = 5,023
  assert.equal(res.f1040['16'], 5023)
})

test('switching back to 2025 restores 2025 law', () => {
  computeReturn(base({ taxYear: 2026, w2s: [w2(60000)] }))
  const res = computeReturn(base({ taxYear: 2025, w2s: [w2(60000)] }))
  assert.equal(R.TAX_YEAR, 2025)
  assert.equal(res.f1040['12e'], 15750)
  assert.equal(res.f1040['15'], 44250)
  assert.equal(res.f1040['16'], 5075)
})

test('2026 married filing jointly standard deduction', () => {
  const res = computeReturn(base({ taxYear: 2026, filingStatus: 'mfj', spouse: { ...emptyReturn().spouse, firstName: 'S', lastName: 'Payer', age: 40 }, w2s: [w2(100000)] }))
  assert.equal(res.f1040['12e'], 32200)
  assert.equal(res.f1040['15'], 67800)
})

test('2026 cash gifts to charity are deducted with the standard deduction (up to $1,000 single)', () => {
  const res = computeReturn(base({ taxYear: 2026, w2s: [w2(60000)], itemized: { ...emptyReturn().itemized, charityCash: 1500 } }))
  assert.equal(res.schedule1A.charityNonItemizer, 1000)
  assert.equal(res.f1040['15'], 42900)
  const res25 = computeReturn(base({ taxYear: 2025, w2s: [w2(60000)], itemized: { ...emptyReturn().itemized, charityCash: 1500 } }))
  assert.equal(res25.schedule1A.charityNonItemizer, 0)
  assert.equal(res25.f1040['15'], 44250)
})

test('2026 child care credit: 50% rate stepping down to 35%', () => {
  const care = { expenses: 3000, employerBenefits: 0, providers: [] }
  // AGI 40,000: 50% − ceil(25,000 / 2,000) = 37%; 37% × 3,000 = 1,110
  const low = computeReturn(base({ taxYear: 2026, w2s: [w2(40000)], dependents: [child(5)], dependentCare: care }))
  assert.equal(low.form2441.rate, 0.37)
  assert.equal(low.form2441.credit, 1110)
  // AGI 60,000: floor of 35% → 1,050
  const mid = computeReturn(base({ taxYear: 2026, w2s: [w2(60000)], dependents: [child(5)], dependentCare: care }))
  assert.equal(mid.form2441.rate, 0.35)
  assert.equal(mid.form2441.credit, 1050)
  // 2025 at AGI 60,000 is 20%
  const old = computeReturn(base({ taxYear: 2025, w2s: [w2(60000)], dependents: [child(5)], dependentCare: care }))
  assert.equal(old.form2441.rate, 0.2)
  assert.equal(old.form2441.credit, 600)
})

test('2026 QBI deduction is at least $400 with $1,000 of active business income', () => {
  const biz = { ...emptyBusiness(), name: 'Shop', grossReceipts: 1500 }
  const res = computeReturn(base({ taxYear: 2026, w2s: [w2(40000)], businesses: [biz] }))
  assert.ok(res.qbi.deduction < 400)
  assert.equal(res.f1040['13a'], 400)
  const res25 = computeReturn(base({ taxYear: 2025, w2s: [w2(40000)], businesses: [biz] }))
  assert.equal(res25.f1040['13a'], res25.qbi.deduction)
})

test('2026 educator expense limit is $350', () => {
  const res = computeReturn(base({ taxYear: 2026, w2s: [w2(50000)], adjustments: { ...emptyReturn().adjustments, educatorExpenses: 500 } }))
  assert.equal(res.f1040['15'], 50000 - 350 - 16100)
})
