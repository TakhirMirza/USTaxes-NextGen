/**
 * Illinois IL-1040 tests, worked by hand from the 2025 IL-1040 instructions and Schedule IL-E/EITC.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { IlInput, TaxReturnInput } from './model.ts'
import { computeIllinois, ilUseTaxTable } from './il2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 35 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number) => ({ ...emptyDependent(), name: 'Kid Payer', relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput> = {}, il: Partial<IlInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'IL', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, il: { ...r.il, ...il } }
}
const il = (ret: TaxReturnInput) => computeIllinois(ret, computeReturn(ret))

test('single: $2,850 exemption and 4.95% of net income', () => {
  const v = il(base({ w2s: [w2(50000)] }, { withholding: 2400, useTaxTable: true }))
  assert.equal(v.lines['9'], 50000)
  assert.equal(v.lines['10'], 2850)
  assert.equal(v.lines['11'], 47150)
  assert.equal(v.lines['12'], 2334) // 47,150 × 4.95% = 2,333.93
  assert.equal(v.lines['21'], 23) // UT Table, $40,001–$50,000
  assert.equal(v.lines['24'], 2357)
  assert.equal(v.lines['41'], 0)
  assert.equal(v.lines['38'], 43)
})

test('joint, 65 or older, with dependents; retirement and Social Security subtracted', () => {
  const r = base({
    filingStatus: 'mfj', taxpayer: { ...person, age: 67 }, spouse: { ...person, firstName: 'Pat', age: 60 }, w2s: [w2(40000)], dependents: [kid(15)],
    retirement: [{ id: 'r', owner: 'taxpayer', payer: 'Plan', grossDistribution: 20000, taxableAmount: 20000, federalWithholding: 0, code: '7', ira: false, earlyExceptionCode: '', earlyExceptionAmount: 0 }]
  })
  const v = il(r)
  assert.equal(v.lines['5'], 20000)
  assert.equal(v.lines['10a'], 5700)
  assert.equal(v.lines['10b'], 1000)
  assert.equal(v.lines['10d'], 2850)
  assert.equal(v.lines['11'], 40000 - 9550)
})

test('no exemption allowance over $250,000 (single)', () => {
  const v = il(base({ w2s: [w2(260000)] }))
  assert.equal(v.lines['10'], 0)
  assert.equal(v.lines['12'], Math.round(260000 * 0.0495))
})

test('Illinois EITC 20% of federal and Child Tax Credit 40% of it for a child under 12', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(5)] })
  const res = computeReturn(ret)
  const v = computeIllinois(ret, res)
  assert.ok(res.eic.credit > 0)
  assert.equal(v.lines['29'], Math.round(Math.round(res.eic.credit) * 0.2))
  assert.equal(v.lines['30'], Math.round(v.lines['29'] * 0.4))
})

test('Illinois Expanded EITC: age 22 without a child', () => {
  const v = il(base({ taxpayer: { ...person, age: 22 }, w2s: [w2(8000)] }))
  assert.equal(v.eitc.expanded, true)
  assert.equal(v.eitc.federal, 614) // 8,025 × 7.65%
  assert.equal(v.lines['29'], 123)
  assert.equal(v.lines['30'], 0)
})

test('UT Table', () => {
  assert.equal(ilUseTaxTable(9000), 3)
  assert.equal(ilUseTaxTable(75000), 31)
  assert.equal(ilUseTaxTable(200000), 100)
})
