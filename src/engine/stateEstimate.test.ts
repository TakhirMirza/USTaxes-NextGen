/**
 * State estimate tests, worked by hand from the 2025 brackets, deductions and exemptions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { TaxReturnInput } from './model.ts'
import { bracketTax, estimateStateTax } from './stateEstimate.ts'
import { STATES } from './states.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const ret = (state: string, patch: Partial<TaxReturnInput> = {}): TaxReturnInput => ({ ...emptyReturn(), residentState: state, w2s: [w2(60000)], ...patch })
const est = (r: TaxReturnInput) => {
  const e = estimateStateTax(r, computeReturn(r))
  assert.ok(e)
  return e
}

test('bracket math', () => {
  assert.equal(bracketTax(50000, [[0.0425, 0]]), 2125)
  assert.equal(bracketTax(20000, [[0.044, 10000]]), 440)
  assert.equal(bracketTax(5000, [[0.02, 0], [0.04, 500], [0.05, 3000]]), 10 + 100 + 100)
})

test('every state with an income tax other than Virginia has an estimate', () => {
  for (const s of STATES.filter((x) => x.support === 'estimate')) assert.ok(estimateStateTax(ret(s.code), computeReturn(ret(s.code))), s.code)
})

test('North Carolina: flat 4.25% after the $12,750 standard deduction', () => {
  const e = est(ret('NC'))
  assert.equal(e.taxable, 60000 - 12750)
  assert.equal(e.tax, Math.round(47250 * 0.0425))
})

test('Georgia 2025 rate is 5.19%; dependents $4,000 each', () => {
  const e = est(ret('GA', { filingStatus: 'hoh', dependents: [{ ...emptyDependent(), name: 'Kid', relationship: 'Son', age: 5, ssn: '123456789' }] }))
  assert.equal(e.taxable, 60000 - 12000 - 4000)
  assert.equal(e.tax, Math.round(44000 * 0.0519))
})

test('Illinois: 4.95% after the $2,850 exemption; withholding gives a refund', () => {
  const r = ret('IL')
  r.stateGeneric = { ...r.stateGeneric, withholding: 3000 }
  const e = est(r)
  assert.equal(e.taxable, 57150)
  assert.equal(e.tax, Math.round(57150 * 0.0495))
  assert.equal(e.refund, 3000 - e.tax)
})

test('California: brackets less exemption credit', () => {
  const e = est(ret('CA'))
  const taxable = 60000 - 5540
  assert.equal(e.taxable, taxable)
  const tax = 10756 * 0.01 + (25499 - 10756) * 0.02 + (40245 - 25499) * 0.04 + (taxable - 40245) * 0.06
  assert.equal(e.tax, Math.round(tax))
  assert.equal(e.credits, 149)
})

test('Social Security is left out in states that do not tax it', () => {
  const r = ret('NC', { socialSecurity: [{ ...emptyReturn().socialSecurity[0] ?? {}, id: 'ss', owner: 'taxpayer', netBenefits: 30000, federalWithholding: 0 } as never] })
  const res = computeReturn(r)
  const e = estimateStateTax(r, res)
  assert.ok(e)
  assert.equal(e.socialSecurity, res.f1040['6b'])
  assert.ok(res.f1040['6b'] > 0)
})

test('Colorado starts from federal taxable income', () => {
  const r = ret('CO')
  const res = computeReturn(r)
  const e = estimateStateTax(r, res)
  assert.ok(e)
  assert.equal(e.start, res.f1040['15'])
  assert.equal(e.tax, Math.round(res.f1040['15'] * 0.044))
})

test('Maryland local rate is added when entered', () => {
  const r = ret('MD')
  r.stateGeneric = { ...r.stateGeneric, localRate: 3.2 }
  const e = est(r)
  assert.equal(e.taxable, 60000 - 3350 - 3200)
  assert.equal(e.local, Math.round(0.032 * e.taxable))
})
