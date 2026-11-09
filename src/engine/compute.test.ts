/**
 * Engine regression tests. Expected values are worked by hand from the 2025 Form 1040
 * instructions (Tax Table, Tax Computation Worksheet, QDCG worksheet, Schedules SE/8812/1-A).
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn, regularTax, taxFromSchedule } from './compute.ts'
import { emptyBusiness, emptyDependent, emptyReturn, emptyTransaction, emptyW2, empty1099Div, normalizeReturn } from './model.ts'
import type { TaxReturnInput } from './model.ts'

const base = (patch: Partial<TaxReturnInput> = {}): TaxReturnInput => ({
  ...emptyReturn(),
  taxpayer: { firstName: 'Test', lastName: 'Payer', age65OrOlder: false, blind: false },
  spouse: { firstName: 'Test', lastName: 'Spouse', age65OrOlder: false, blind: false },
  ...patch
})
const w2 = (wages: number, withholding: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, federalWithholding: withholding, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })

test('tax table uses row midpoint below $100,000', () => {
  assert.equal(regularTax(44250, 'single'), 5075)
  assert.equal(regularTax(0, 'single'), 0)
  assert.equal(regularTax(3, 'single'), 0)
})

test('tax computation worksheet at and above $100,000', () => {
  assert.equal(regularTax(134250, 'single'), 25067)
  assert.equal(Math.round(taxFromSchedule(100000, 'mfj')), 11828)
})

test('single W-2 filer gets a refund', () => {
  const res = computeReturn(base({ w2s: [w2(60000, 6000)] }))
  assert.equal(res.f1040['11'], 60000)
  assert.equal(res.f1040['12'], 15750)
  assert.equal(res.f1040['15'], 44250)
  assert.equal(res.f1040['16'], 5075)
  assert.equal(res.f1040['34'], 925)
  assert.equal(res.f1040['37'], 0)
})

test('MFJ with two children applies $2,200 Child Tax Credit each', () => {
  const res = computeReturn(base({
    filingStatus: 'mfj', w2s: [w2(90000, 5000)],
    dependents: [{ ...emptyDependent(), name: 'A' }, { ...emptyDependent(), name: 'B' }]
  }))
  assert.equal(res.f1040['15'], 58500)
  assert.equal(res.f1040['16'], 6546)
  assert.equal(res.f1040['19'], 4400)
  assert.equal(res.f1040['24'], 2146)
  assert.equal(res.f1040['34'], 2854)
})

test('refundable Additional Child Tax Credit is limited to $1,700 per child', () => {
  const res = computeReturn(base({
    filingStatus: 'mfj', w2s: [w2(30000, 1000)],
    dependents: [{ ...emptyDependent(), name: 'A' }, { ...emptyDependent(), name: 'B' }]
  }))
  assert.equal(res.f1040['15'], 0)
  assert.equal(res.f1040['28'], 3400)
  assert.equal(res.f1040['34'], 4400)
})

test('Schedule C → SE tax, half-SE adjustment and QBI deduction', () => {
  const biz = { ...emptyBusiness(), name: 'Consulting', grossReceipts: 50000 }
  const res = computeReturn(base({ businesses: [biz] }))
  assert.equal(res.schedule2.selfEmploymentTax, 7065)
  assert.equal(res.schedule1.adjustments.deductibleHalfOfSeTax, 3533)
  assert.equal(res.f1040['11'], 46467)
  assert.equal(res.f1040['13a'], 6143)
  assert.equal(res.f1040['15'], 24574)
  assert.equal(res.f1040['16'], 2711)
  assert.equal(res.f1040['24'], 9776)
})

test('qualified dividends inside the 0% zone are untaxed', () => {
  const div = { ...empty1099Div(), payer: 'Fund', ordinaryDividends: 10000, qualifiedDividends: 10000 }
  const res = computeReturn(base({ w2s: [w2(40000, 0)], dividends: [div] }))
  assert.equal(res.f1040['15'], 34250)
  assert.equal(res.f1040['16'], 2675)
})

test('capital loss is limited to $3,000 with a carryover', () => {
  const tx = { ...emptyTransaction(), term: 'short' as const, proceeds: 5000, costBasis: 15000 }
  const res = computeReturn(base({ w2s: [w2(50000, 0)], capitalTransactions: [tx] }))
  assert.equal(res.f1040['7'], -3000)
  assert.equal(res.scheduleD.carryoverShort, 7000)
})

test('senior gets additional standard deduction and $6,000 Schedule 1-A deduction', () => {
  const res = computeReturn(base({ taxpayer: { firstName: 'S', lastName: 'R', age65OrOlder: true, blind: false }, w2s: [w2(50000, 0)] }))
  assert.equal(res.f1040['12'], 17750)
  assert.equal(res.f1040['13b'], 6000)
  assert.equal(res.f1040['16'], 2915)
})

test('tips deduction phases out $100 per $1,000 above $150,000', () => {
  const res = computeReturn(base({ w2s: [w2(160000, 0)], schedule1A: { qualifiedTips: 20000, qualifiedOvertime: 0, carLoanInterest: 0 } }))
  assert.equal(res.schedule1A.tips, 19000)
})

test('SALT is capped at $40,000', () => {
  const res = computeReturn(base({
    filingStatus: 'mfj', w2s: [w2(300000, 0)], deductionChoice: 'itemized',
    itemized: { ...emptyReturn().itemized, stateLocalIncomeOrSalesTax: 30000, realEstateTax: 20000 }
  }))
  assert.equal(res.scheduleA.taxes, 40000)
})

test('additional Medicare tax and NIIT above $200,000 single', () => {
  const res = computeReturn(base({ w2s: [w2(250000, 0)] }))
  assert.equal(res.schedule2.additionalMedicareTax, 450)
  assert.equal(res.schedule2.netInvestmentIncomeTax, 0)
})

test('spouse documents are excluded unless filing jointly', () => {
  const res = computeReturn(base({ w2s: [w2(40000, 0), w2(40000, 0, 'spouse')] }))
  assert.equal(res.f1040['1a'], 40000)
  assert.ok(res.issues.some((i) => i.level === 'error'))
})

test('normalizeReturn tolerates partial saved data', () => {
  const n = normalizeReturn({ filingStatus: 'mfj', w2s: [{ wages: 1 }] })
  assert.equal(n.filingStatus, 'mfj')
  assert.equal(n.w2s[0].wages, 1)
  assert.equal(n.w2s[0].federalWithholding, 0)
  assert.equal(n.itemized.medical, 0)
})
