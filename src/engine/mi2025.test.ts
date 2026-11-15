/**
 * Michigan MI-1040 and MI-1040CR tests, worked by hand from the 2025 forms and instruction books.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { MiInput, TaxReturnInput } from './model.ts'
import { computeMichigan, miTableA, miTableB } from './mi2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 35 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number) => ({ ...emptyDependent(), name: 'Kid Payer', relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const pension = (amount: number) => ({ id: 'r', owner: 'taxpayer' as const, payer: 'Plan', grossDistribution: amount, taxableAmount: amount, federalWithholding: 0, code: '7', ira: false, earlyExceptionCode: '', earlyExceptionAmount: 0 })
const base = (patch: Partial<TaxReturnInput> = {}, mi: Partial<MiInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'MI', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, mi: { ...r.mi, ...mi } }
}
const mi = (ret: TaxReturnInput) => computeMichigan(ret, computeReturn(ret))

test('Tables A and B', () => {
  assert.equal(miTableA(21000), 1)
  assert.equal(miTableA(21001), 0.96)
  assert.equal(miTableA(30000), 0.64)
  assert.equal(miTableA(30001), 0.6)
  assert.equal(miTableB(62500), 1)
  assert.equal(miTableB(63000), 0.9)
  assert.equal(miTableB(71500), 0.1)
  assert.equal(miTableB(71501), 0)
})

test('single: $5,800 exemption and 4.25%', () => {
  const v = mi(base({ w2s: [w2(50000)] }, { withholding: 1900 }))
  assert.equal(v.lines['9f'], 5800)
  assert.equal(v.lines['16'], 44200)
  assert.equal(v.lines['17'], 1879) // 1,878.50
  assert.equal(v.lines['39'], 21)
})

test('joint with two children: four exemptions; Michigan EITC 30% of federal', () => {
  const ret = base({ filingStatus: 'mfj', w2s: [w2(30000)], dependents: [kid(3), kid(8)] })
  const res = computeReturn(ret)
  const v = computeMichigan(ret, res)
  assert.equal(v.lines['9f'], 23200)
  assert.equal(v.lines['28b'], Math.round(Math.round(res.eic.credit) * 0.3))
})

test('retirement subtraction: Section D (born 1958) and Section A (born 1940)', () => {
  const d = mi(base({ taxpayer: { ...person, age: 67 }, retirement: [pension(40000)] }, { birthYear: { taxpayer: 1958, spouse: 0 } }))
  assert.equal(d.retirement.section, 'D')
  assert.equal(d.retirement.deduction, 40000)
  const d2 = mi(base({ taxpayer: { ...person, age: 67 }, retirement: [pension(80000)] }, { birthYear: { taxpayer: 1958, spouse: 0 } }))
  assert.equal(d2.retirement.deduction, 49423) // 75% of 65,897
  const a = mi(base({ taxpayer: { ...person, age: 85 }, retirement: [pension(80000)] }, { birthYear: { taxpayer: 1940, spouse: 0 } }))
  assert.equal(a.retirement.section, 'A')
  assert.equal(a.retirement.deduction, 65897)
  const none = mi(base({ taxpayer: { ...person, age: 50 }, retirement: [pension(20000)] }, { birthYear: { taxpayer: 1975, spouse: 0 } }))
  assert.equal(none.retirement.deduction, 0)
})

test('homestead credit: renter, 23% of rent, 3.2% of resources, 60%', () => {
  const v = mi(base({ w2s: [w2(30000)] }, { housing: 'rent', rentPaid: 12000 }))
  assert.equal(v.homestead.line13, 2760)
  assert.equal(v.homestead.thr, 30000)
  assert.equal(v.homestead.line34, 960)
  assert.equal(v.homestead.line35, 1800)
  assert.equal(v.lines['26'], 1080)
})

test('homestead credit: owner phased out by Table B', () => {
  const v = mi(base({ w2s: [w2(65000)] }, { housing: 'own', propertyTax: 5000, taxableValue: 90000 }))
  assert.equal(v.homestead.tableB, 0.7) // 64,501–65,500... THR 65,000
  assert.equal(v.lines['26'], Math.round(Math.min(1900, Math.round((5000 - Math.round(65000 * 0.032)) * 0.6)) * 0.7))
})
