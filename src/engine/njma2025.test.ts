/**
 * New Jersey NJ-1040 and Massachusetts Form 1 tests, worked by hand from the 2025 instructions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { empty1099Div, empty1099Int, empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { MaInput, NjInput, TaxReturnInput } from './model.ts'
import { computeNewJersey, njChildCreditPer, njTax } from './nj2025.ts'
import { computeMassachusetts, maTax } from './ma2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 40 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: Math.round(wages * 0.062), medicareWithheld: Math.round(wages * 0.0145) })
const kid = (age: number) => ({ ...emptyDependent(), name: 'Kid Payer', relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (state: string, patch: Partial<TaxReturnInput> = {}): TaxReturnInput =>
  ({ ...emptyReturn(), residentState: state, taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch })
const nj = (patch: Partial<TaxReturnInput>, x: Partial<NjInput> = {}) => { const r = base('NJ', patch); const ret = { ...r, nj: { ...r.nj, ...x } }; return computeNewJersey(ret, computeReturn(ret)) }
const ma = (patch: Partial<TaxReturnInput>, x: Partial<MaInput> = {}) => { const r = base('MA', patch); const ret = { ...r, ma: { ...r.ma, ...x } }; return computeMassachusetts(ret, computeReturn(ret)) }

test('NJ tax table and rate schedules', () => {
  assert.equal(njTax(39875, 'single'), 713) // booklet example rows 39,850–39,900
  assert.equal(njTax(39875, 'mfj'), 628)
  assert.equal(njTax(70125, 'mfj'), 1299) // table row; the printed schedule's $1,154.50 would give 1,300
  assert.equal(njTax(99950, 'single'), 4242)
  assert.equal(njTax(99950, 'mfj'), 2749)
  assert.equal(njTax(150000, 'single'), 7429) // 150,000 × 6.37% − 2,126.25
  assert.equal(njChildCreditPer(30000), 1000)
  assert.equal(njChildCreditPer(80001), 0)
})

test('NJ single, $60,000 wages', () => {
  const v = nj({ w2s: [w2(60000)] })
  assert.equal(v.lines['13'], 1000)
  assert.equal(v.lines['29'], 60000)
  assert.equal(v.lines['39'], 59000)
  assert.equal(v.lines['43'], 1769) // 59,025 × 5.525% − 1,492.50
})

test('NJ joint homeowners with two children: exemptions and the Property Tax Deduction', () => {
  const v = nj({ filingStatus: 'mfj', w2s: [w2(60000), w2(40000, 'spouse')], dependents: [kid(4), kid(8)] }, { housing: 'own', propertyTax: 8000 })
  assert.equal(v.lines['13'], 5000)
  assert.equal(v.lines['39'], 95000)
  assert.equal(v.propertyTax.method, 'deduction')
  assert.equal(v.lines['41'], 8000)
  assert.equal(v.lines['42'], 87000)
  assert.equal(v.lines['43'], 2033)
  assert.equal(v.lines['65'], 0) // taxable income over $80,000
})

test('NJ renter: 18% of rent, credit when the deduction saves less than $50', () => {
  const v = nj({ w2s: [w2(25000)] }, { housing: 'rent', rentPaid: 12000 })
  assert.equal(v.lines['40a'], 2160)
  assert.equal(v.propertyTax.method, 'credit')
  assert.equal(v.lines['56'], 50)
})

test('NJ Child Tax Credit: $800 per child 5 or younger at $30,001–$40,000', () => {
  const v = nj({ filingStatus: 'mfj', w2s: [w2(40000)], dependents: [kid(3)] })
  assert.equal(v.lines['42'], 36500)
  assert.equal(v.lines['65'], 800)
})

test('NJ retiree 66: pension exclusion, Social Security not taxed', () => {
  const v = nj({
    taxpayer: { ...person, age: 66, age65OrOlder: true },
    retirement: [{ ...empty1099R(), payer: 'Pension', grossDistribution: 40000, taxableAmount: 40000, code: '7' }],
    socialSecurity: [{ ...emptySocialSecurity(), netBenefits: 24000 }]
  })
  assert.equal(v.lines['20a'], 40000)
  assert.equal(v.lines['28a'], 40000)
  assert.equal(v.lines['29'], 0)
  assert.equal(v.lines['13'], 2000)
  assert.equal(v.lines['43'], 0)
})

test('NJEITC is 40% of the federal credit', () => {
  const ret = base('NJ', { filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(6)] })
  const res = computeReturn(ret)
  assert.equal(computeNewJersey(ret, res).lines['58'], Math.round(res.eic.credit * 0.4))
})

test('MA tax table', () => {
  assert.equal(maTax(9), 0)
  assert.equal(maTax(100), 4)
  assert.equal(maTax(4050), 201)
  assert.equal(maTax(24000), 1199)
  assert.equal(maTax(30000), 1500)
})

test('MA single renter, $60,000 wages', () => {
  const v = ma({ w2s: [w2(60000)] }, { rentPaid: 24000 })
  assert.equal(v.lines['11a'], 2000)
  assert.equal(v.lines['14'], 4000)
  assert.equal(v.lines['17'], 54000)
  assert.equal(v.lines['2g'], 4400)
  assert.equal(v.lines['19'], 49600)
  assert.equal(v.lines['22'], 2480)
})

test('MA No Tax Status and Limited Income Credit', () => {
  assert.equal(ma({ w2s: [w2(7500)] }).lines['28'], 0)
  const v = ma({ w2s: [w2(9000)] })
  assert.equal(v.noTaxStatus, false)
  assert.equal(v.lines['19'], 3911) // 9,000 − 689 − 4,400
  assert.equal(v.lines['22'], 196)
  assert.equal(v.lines['29'], 96) // 196 − 10% × (9,000 − 8,000)
  assert.equal(v.lines['32'], 100)
})

test('MA interest and dividends go to Schedule B at 5%', () => {
  const v = ma({ w2s: [w2(50000)], interest: [{ ...empty1099Int(), payer: 'Bank', interest: 1000 }], dividends: [{ ...empty1099Div(), payer: 'Fund', ordinaryDividends: 2000 }] }, { maBankInterest: 400 })
  assert.equal(v.lines['5'], 400)
  assert.equal(v.scheduleB.interest, 600)
  assert.equal(v.lines['20'], 2600)
  assert.equal(v.lines['22'], Math.round(v.lines['21'] * 0.05))
})

test('MA Child and Family Tax Credit and EITC', () => {
  const ret = base('MA', { filingStatus: 'hoh', w2s: [w2(25000)], dependents: [kid(5)] })
  const res = computeReturn(ret)
  const v = computeMassachusetts(ret, res)
  assert.equal(v.lines['2a'], 6800)
  assert.equal(v.lines['46'], 440)
  assert.equal(v.lines['43'], Math.round(res.eic.credit * 0.4))
})

test('MA Schedule B: short-term losses against interest first (up to $2,000), then long-term gains', () => {
  const ret = base('MA', { w2s: [w2(50000)], interest: [{ ...empty1099Int(), payer: 'Bank', interest: 1000 }] })
  const res = computeReturn(ret)
  const v = computeMassachusetts(ret, { ...res, scheduleD: { ...res.scheduleD, shortTerm: -3000, longTerm: 5000 } })
  const B = v.scheduleB.lines
  assert.equal(B['20'], 1000)
  assert.equal(B['21'], -2000)
  assert.equal(B['22'], 2000)
  assert.equal(B['23'], 0)
  assert.equal(v.lines['20'], 0)
  assert.equal(v.lines['24'], 150) // (5,000 − 2,000) × 5%
})

test('MA Schedule HC: 150% of the poverty level and the 4-month gap rule', () => {
  const r = base('MA', { w2s: [w2(60000)] })
  const gap = { ...r.ma.health.taxpayer, coverage: 'part' as const, months: [true, true, true, true, true, true, false, false, false, false, true, true] }
  const ret = { ...r, ma: { ...r.ma, health: { ...r.ma.health, taxpayer: gap } } }
  const v = computeMassachusetts(ret, computeReturn(ret))
  assert.equal(v.health.fpl150, 22590)
  assert.equal(v.health.penaltyPossible.taxpayer, true)
  const three = { ...gap, months: [true, true, true, true, true, true, true, false, false, false, true, true] }
  const ret2 = { ...r, ma: { ...r.ma, health: { ...r.ma.health, taxpayer: three } } }
  assert.equal(computeMassachusetts(ret2, computeReturn(ret2)).health.penaltyPossible.taxpayer, false)
})

test('MA Schedule D, X and Y', () => {
  const r = base('MA', {
    w2s: [w2(50000)],
    dividends: [{ ...empty1099Div(), payer: 'Fund', ordinaryDividends: 0, capitalGainDistributions: 1000 }],
    retirement: [{ ...empty1099R(), payer: 'IRA', grossDistribution: 5000, taxableAmount: 5000, code: '7', ira: true }]
  })
  const ret = { ...r, ma: { ...r.ma, longTermCarryover: 400, iraBasisRecovered: 1500, commuter: { taxpayer: 700, spouse: 0 }, alimonyPaid: 1200 } }
  const v = computeMassachusetts(ret, computeReturn(ret))
  const D = v.scheduleD.lines
  assert.equal(D['6'], 1000)
  assert.equal(D['8'], -400)
  assert.equal(D['17'], 600)
  assert.equal(D['22'], 30)
  assert.equal(v.lines['24'], 30)
  assert.equal(v.scheduleX['2'], 3500)
  assert.equal(v.lines['9'], 3500)
  assert.equal(v.scheduleY['15'], 550)
  assert.equal(v.scheduleY['3'], 1200)
})
