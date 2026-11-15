/**
 * Georgia Form 500 tests, worked by hand from the 2025 IT-511 booklet.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2, empty1099Int } from './model.ts'
import type { GaInput, TaxReturnInput } from './model.ts'
import { computeGeorgia, gaLowIncomePer } from './ga2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 35 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number) => ({ ...emptyDependent(), name: 'Kid Payer', relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput> = {}, ga: Partial<GaInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'GA', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, ga: { ...r.ga, ...ga } }
}
const ga = (ret: TaxReturnInput) => computeGeorgia(ret, computeReturn(ret))

test('low income credit table', () => {
  assert.equal(gaLowIncomePer(5999), 26)
  assert.equal(gaLowIncomePer(6000), 20)
  assert.equal(gaLowIncomePer(9999), 14)
  assert.equal(gaLowIncomePer(14999), 8)
  assert.equal(gaLowIncomePer(19999), 5)
  assert.equal(gaLowIncomePer(20000), 0)
})

test('single: $12,000 standard deduction and 5.19%', () => {
  const ret = base({ w2s: [w2(60000)] })
  const id = ret.w2s[0].id
  const v = ga({ ...ret, ga: { ...ret.ga, w2: { [id]: { ein: '12-3456789', stateId: '1234567AB', stateIncome: null, stateTax: 2500 } } } })
  assert.equal(v.lines['10'], 60000)
  assert.equal(v.lines['11'], 12000)
  assert.equal(v.lines['13'], 48000)
  assert.equal(v.lines['16'], 2491) // 48,000 × 5.19% = 2,491.20
  assert.equal(v.lines['24'], 2500)
  assert.equal(v.lines['30'], 9)
  assert.equal(v.lines['46'], 9)
  assert.equal(v.statements[0].wages, 60000)
})

test('joint with two children and an unborn dependent: $4,000 each', () => {
  const v = ga(base({ filingStatus: 'mfj', w2s: [w2(50000), w2(30000, 'spouse')], dependents: [kid(4), kid(8)] }, { unbornDependents: 1 }))
  assert.equal(v.lines['11'], 24000)
  assert.equal(v.lines['7c'], 3)
  assert.equal(v.lines['14'], 12000)
  assert.equal(v.lines['15c'], 44000)
  assert.equal(v.lines['16'], 2284) // 44,000 × 5.19% = 2,283.60
  assert.equal(v.lines['29'], 2284)
  assert.equal(v.lines['45'], 2284)
})

test('retiree 66: retirement exclusion up to $65,000 and Social Security subtracted', () => {
  const ret = base({
    taxpayer: { ...person, age: 66, age65OrOlder: true },
    retirement: [{ ...empty1099R(), payer: 'Pension Fund', grossDistribution: 30000, taxableAmount: 30000, code: '7' }],
    interest: [{ ...empty1099Int(), payer: 'Bank', interest: 2000 }],
    socialSecurity: [{ ...emptySocialSecurity(), netBenefits: 24000 }]
  }, { birthDate: { taxpayer: '03/02/1959', spouse: '' } })
  const res = computeReturn(ret)
  const v = computeGeorgia(ret, res)
  assert.equal(v.retirement.taxpayer.lines['14'], 32000)
  assert.equal(v.schedule1['7a'], 32000)
  assert.equal(v.schedule1['8'], Math.round(res.f1040['6b']))
  assert.equal(v.lines['10'], Math.round(res.f1040['11a']) - 32000 - Math.round(res.f1040['6b']))
})

test('age 63: exclusion limited to $35,000, earned income up to $5,000', () => {
  const v = ga(base({
    taxpayer: { ...person, age: 63 },
    w2s: [w2(20000)],
    retirement: [{ ...empty1099R(), payer: 'IRA', grossDistribution: 40000, taxableAmount: 40000, code: '7', ira: true }]
  }))
  const p = v.retirement.taxpayer.lines
  assert.equal(p['5'], 5000)
  assert.equal(p['11'], 40000)
  assert.equal(p['15'], 45000)
  assert.equal(p['16'], 35000)
  assert.equal(v.schedule1['7a'], 35000)
})

test('military retirement under 62: $17,500, or $35,000 with Georgia earned income over $17,500', () => {
  const mil = { ...empty1099R(), payer: 'DFAS', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const low = ga(base({ taxpayer: { ...person, age: 50 }, w2s: [w2(10000)], retirement: [mil] }, { militaryRetirement: { taxpayer: 30000, spouse: 0 } }))
  assert.equal(low.schedule1['7b'], 17500)
  const high = ga(base({ taxpayer: { ...person, age: 50 }, w2s: [w2(40000)], retirement: [mil] }, { militaryRetirement: { taxpayer: 30000, spouse: 0 } }))
  assert.equal(high.schedule1['7b'], 30000)
  assert.equal(high.schedule1['7a'], 0)
})

test('low income credit: $5 per exemption under $20,000', () => {
  const v = ga(base({ w2s: [w2(19000)] }))
  assert.equal(v.lines['16'], 363) // 7,000 × 5.19% = 363.30
  assert.equal(v.lines['17a'], 1)
  assert.equal(v.lines['17b'], 5)
  assert.equal(v.lines['17'], 5)
  assert.equal(v.lines['23'], 358)
})

test('itemizers: federal Schedule A and the $300 Eligible Itemizer Tax Credit', () => {
  const ret = base({ w2s: [w2(90000)], itemized: { ...emptyReturn().itemized, mortgageInterest: 18000, realEstateTax: 4000 } })
  const res = computeReturn(ret)
  assert.equal(res.deduction.used, 'itemized')
  const v = computeGeorgia(ret, res)
  assert.equal(v.lines['11'], 0)
  assert.equal(v.lines['12a'], Math.round(res.deduction.itemized))
  assert.equal(v.lines['19'], 300)
  const tax = Math.round((90000 - v.lines['12c']) * 0.0519)
  assert.equal(v.lines['16'], tax)
  assert.equal(v.lines['23'], tax - 300)
})

test('child and dependent care: IND-CR 202 is 50% of the federal credit', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(45000)], dependents: [kid(4)] })
  const res = computeReturn(ret)
  const v = computeGeorgia({ ...ret }, { ...res, schedule3: { ...res.schedule3, dependentCare: 600 } })
  assert.equal(v.indCr.care, 300)
  assert.equal(v.lines['20'], 300)
})
