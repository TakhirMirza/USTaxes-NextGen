/**
 * Pennsylvania PA-40 tests, worked by hand from the 2025 PA-40 instructions, Schedule O and the
 * Schedule SP Eligibility Income Tables.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { PaInput, TaxReturnInput } from './model.ts'
import { computePennsylvania, forgivenessPercent } from './pa2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 35 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number) => ({ ...emptyDependent(), name: 'Kid Payer', relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput> = {}, pa: Partial<PaInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'PA', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, pa: { ...r.pa, ...pa } }
}
const pa = (ret: TaxReturnInput) => computePennsylvania(ret, computeReturn(ret))

test('Eligibility Income Tables 1 and 2', () => {
  assert.equal(forgivenessPercent(6500, false, 0), 1)
  assert.equal(forgivenessPercent(6501, false, 0), 0.9)
  assert.equal(forgivenessPercent(8750, false, 0), 0.1)
  assert.equal(forgivenessPercent(8751, false, 0), 0)
  assert.equal(forgivenessPercent(16000, false, 1), 1)
  assert.equal(forgivenessPercent(16300, false, 1), 0.8)
  assert.equal(forgivenessPercent(32600, true, 2), 0.7)
  assert.equal(forgivenessPercent(100750, true, 9), 0.1)
})

test('single: 401(k) deferrals are PA compensation; 3.07% flat', () => {
  const r = base({ w2s: [w2(50000)] }, { withholding: 1500 })
  const v = pa({ ...r, savings: { ...r.savings, taxpayer: { ...r.savings.taxpayer, electiveDeferrals: 5000 } } })
  assert.equal(v.lines['1a'], 55000)
  assert.equal(v.lines['11'], 55000)
  assert.equal(v.lines['12'], 1689) // 1,688.50
  assert.equal(v.lines['21'], 0)
  assert.equal(v.lines['26'], 189)
})

test('Tax Forgiveness: single parent with one child, full and partial', () => {
  const full = pa(base({ filingStatus: 'hoh', w2s: [w2(16000)], dependents: [kid(6)] }, { withholding: 491 }))
  assert.equal(full.lines['12'], 491)
  assert.equal(full.forgiveness.percent, 1)
  assert.equal(full.lines['21'], 491)
  assert.equal(full.lines['30'], 491)
  const part = pa(base({ filingStatus: 'hoh', w2s: [w2(16300)], dependents: [kid(6)] }))
  assert.equal(part.forgiveness.percent, 0.8)
  assert.equal(part.lines['21'], Math.round(Math.round(16300 * 0.0307) * 0.8))
})

test('Social Security, unemployment and pensions are not PA income; losses do not offset other classes', () => {
  const r = base({
    w2s: [w2(30000)], unemployment: 4000,
    socialSecurity: [{ ...(emptyReturn().socialSecurity[0] ?? {}), id: 's', owner: 'taxpayer', netBenefits: 12000, federalWithholding: 0 } as never],
    businesses: []
  })
  const v = pa(r)
  assert.equal(v.lines['9'], 30000)
})

test('Schedule O: 529 contributions, HSA and student loan interest (up to $2,500)', () => {
  const r = base({ w2s: [w2(60000)], adjustments: { ...emptyReturn().adjustments, studentLoanInterest: 3000 } }, { tuitionContributions: { taxpayer: 4000, spouse: 0 } })
  const v = pa(r)
  assert.equal(v.scheduleO.studentLoan, 2500)
  assert.equal(v.lines['10'], 6500 + v.scheduleO.hsa)
  assert.equal(v.lines['11'], 60000 - v.lines['10'])
})

test('Working Pennsylvanians Tax Credit: 10% of federal EITC, up to $805', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(5)] })
  const res = computeReturn(ret)
  const v = computePennsylvania(ret, res)
  assert.equal(v.wptc, Math.min(805, Math.round(res.eic.credit * 0.1)))
})
