/**
 * New York IT-201 tests, worked by hand from the 2025 IT-201-I (rate schedules, tax computation
 * worksheets, household credit tables, NYC school tax credits), Form IT-213 and Form IT-215. Tax-table
 * values were checked against rows of the published NYS and NYC tax tables.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { NyInput, TaxReturnInput } from './model.ts'
import { computeNewYork, eliminationThreshold, nyCareDecimal, nyCareLimitation, nycCareLimitation, nycEicRate, nycTax, nysTax, salesTaxChart } from './ny2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 35 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Payer') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput> = {}, ny: Partial<NyInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'NY', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, ny: { ...r.ny, ...ny } }
}
const ny = (ret: TaxReturnInput) => computeNewYork(ret, computeReturn(ret))

test('NYS tax table rows (middle of the row) and the rate schedule from $65,000', () => {
  assert.equal(nysTax(10, 10, 'single'), 0)
  assert.equal(nysTax(20, 20, 'single'), 1)
  assert.equal(nysTax(30, 30, 'single'), 2)
  assert.equal(nysTax(8575, 8575, 'single'), 343)
  assert.equal(nysTax(8625, 8625, 'single'), 346)
  assert.equal(nysTax(8625, 8625, 'mfj'), 345)
  assert.equal(nysTax(70000, 80000, 'single'), 3686) // 600 + 5.5% × 56,100
})

test('NYS tax computation worksheets for New York AGI over $107,650', () => {
  assert.equal(nysTax(112000, 120000, 'single'), 6292) // worksheet 7: 6,152 + (6,720 − 6,152) × 0.247
  assert.equal(nysTax(192000, 200000, 'single'), 11520) // worksheet 7, AGI ≥ 157,650: 6% flat
  assert.equal(nysTax(250000, 258050, 'mfj'), 15000) // worksheet 2: 13,860 + 333 + 807 × 1
  assert.equal(nysTax(100000, 30000000, 'hoh'), 10900) // worksheet 16: 10.9%
})

test('NYC tax table rows and rate schedule', () => {
  assert.equal(nycTax(7625, 'single'), 235)
  assert.equal(nycTax(12025, 'single'), 370)
  assert.equal(nycTax(12125, 'single'), 374)
  assert.equal(nycTax(12125, 'mfj'), 373)
  assert.equal(nycTax(64975, 'single'), 2393)
  assert.equal(nycTax(64975, 'mfj'), 2308)
  assert.equal(nycTax(100000, 'mfj'), 3652) // 3,264 + 3.876% × 10,000
})

test('NYC EIC rate worksheet and sales tax chart', () => {
  assert.equal(nycEicRate(4000), 0.3)
  assert.equal(nycEicRate(6249), 0.275) // .30 − 1,250 × .00002
  assert.equal(nycEicRate(10000), 0.25)
  assert.equal(nycEicRate(30000), 0.15)
  assert.equal(nycEicRate(50000), 0.1)
  assert.equal(salesTaxChart(45000), 10)
  assert.equal(salesTaxChart(400000), 70)
  assert.equal(salesTaxChart(900000), 125)
})

test('single NYC renter: NYS and NYC tax, school tax credits, withholding', () => {
  const v = ny(base({ w2s: [w2(50000)] }, { locality: 'nyc', withholding: 2000, nycWithholding: 1000 }))
  assert.equal(v.lines['33'], 50000)
  assert.equal(v.lines['34'], 8000)
  assert.equal(v.lines['38'], 42000)
  assert.equal(v.lines['39'], 2147) // 600 + 5.5% × 28,125
  assert.equal(v.lines['40'], 0)
  assert.equal(v.lines['47a'], 1508) // 858 + 3.819% × 17,025
  assert.equal(v.lines['69'], 63)
  assert.equal(v.lines['69a'], 89) // 21 + 0.228% × 30,000
  assert.equal(v.lines['62'], 3655)
  assert.equal(v.lines['76'], 3152)
  assert.equal(v.lines['80'], 503)
})

test('head of household with two children: household credit, Empire State child credit, NYS EIC', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(2, 'A Payer'), kid(6, 'B Payer')] }, { withholding: 100 })
  const res = computeReturn(ret)
  const v = computeNewYork(ret, res)
  assert.equal(v.lines['36'], 2000)
  assert.equal(v.lines['38'], 6800)
  assert.equal(v.lines['40'], 90) // table 2, 7,000–20,000, three people
  assert.equal(v.lines['63'], 1330) // 1,000 + 330
  const fed = Math.round(res.eic.credit)
  assert.ok(fed > 0)
  assert.equal(v.lines['65'], Math.round(fed * 0.3) - Math.min(v.lines['39'], v.lines['40']))
  assert.equal(v.lines['70'], 0) // not an NYC resident
})

test('Empire State child credit phases out at 1.65% of federal AGI over the threshold', () => {
  const v = ny(base({ filingStatus: 'mfj', w2s: [w2(140500)], dependents: [kid(10)] }))
  assert.equal(v.escc.reduction, 495) // (140,000 − 110,000) × 1.65%
  assert.equal(v.lines['63'], 0)
})

test('pension exclusion: up to $20,000 for someone 60 or older', () => {
  const r = base({ taxpayer: { ...person, age: 66 }, retirement: [{ id: 'r', owner: 'taxpayer', payer: 'Plan', grossDistribution: 30000, taxableAmount: 30000, federalWithholding: 0, code: '7', ira: false, earlyExceptionCode: '', earlyExceptionAmount: 0 }] })
  const v = ny(r)
  assert.equal(v.lines['29'], 20000)
})

test('Yonkers resident surcharge: 16.75% of net state tax', () => {
  const v = ny(base({ w2s: [w2(60000)] }, { locality: 'yonkers' }))
  assert.equal(v.lines['55'], Math.round(v.lines['46'] * 0.1675))
})

test('IT-216 tables: line 10 decimal, NYS limitation (line 13), NYC limitation (Worksheet 2 line 6)', () => {
  assert.equal(nyCareDecimal(15000), 0.35)
  assert.equal(nyCareDecimal(15001), 0.34)
  assert.equal(nyCareDecimal(24000), 0.3)
  assert.equal(nyCareDecimal(43000), 0.21)
  assert.equal(nyCareDecimal(90000), 0.2)
  assert.equal(nyCareLimitation(25000), 1.1)
  assert.equal(nyCareLimitation(33000), 1.047) // 32,800–33,000
  assert.equal(nyCareLimitation(33001), 1.046)
  assert.equal(nyCareLimitation(45000), 1)
  assert.equal(nyCareLimitation(50100), 1.162)
  assert.equal(nyCareLimitation(55100), 0.927)
  assert.equal(nyCareLimitation(60100), 1.07)
  assert.equal(nyCareLimitation(65000), 0.476)
  assert.equal(nyCareLimitation(65001), 0.6)
  assert.equal(nyCareLimitation(150001), 0.2)
  assert.equal(nycCareLimitation(25000), 0.75)
  assert.equal(nycCareLimitation(25100), 0.735)
  assert.equal(nycCareLimitation(27500), 0.375)
  assert.equal(nycCareLimitation(29900), 0.015)
  assert.equal(nycCareLimitation(30001), 0)
})

test('NYC parent with a 2-year-old in daycare: NYS and NYC child care credits', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(24000)], dependents: [kid(2)], dependentCare: { expenses: 4000, employerBenefits: 0, providers: [] } }, { locality: 'nyc' })
  const v = ny(ret)
  assert.equal(v.care.line5, 3000)
  assert.equal(v.care.line10, 0.3)
  assert.equal(v.care.line11, 900)
  assert.equal(v.care.line13, 1.1)
  assert.equal(v.care.line14, 990)
  assert.equal(v.care.nycCredit, 743) // 990 × 1 × 0.75
  assert.equal(v.lines['64'], 1733)
})

test('NYC income tax elimination credit: partial within $5,000 over the threshold', () => {
  assert.equal(eliminationThreshold('hoh', 1), 31503)
  assert.equal(eliminationThreshold('mfj', 9), 91902)
  assert.equal(eliminationThreshold('single', 9), 88361)
  const v = ny(base({ filingStatus: 'hoh', w2s: [w2(34000)], dependents: [kid(10)] }, { locality: 'nyc' }))
  assert.equal(v.elimination.line3, 2497)
  assert.equal(v.elimination.line5, 0.5006)
  assert.equal(v.elimination.line10, v.lines['54'] - v.lines['70'])
  assert.equal(v.lines['70a'], Math.round(v.elimination.line10 * 0.5006))
  assert.ok(v.lines['70a'] > 0)
})

test('IT-196: no SALT cap, state income tax out, high-income adjustment over $100,000', () => {
  const v = ny(base({ w2s: [w2(120000)], itemized: { ...emptyReturn().itemized, stateLocalIncomeOrSalesTax: 8000, realEstateTax: 12000, mortgageInterest: 15000, charityCash: 3000 } }))
  const it = v.deduction.it196!
  assert.equal(it.lines['40'], 38000)
  assert.equal(it.lines['41'], 8000)
  assert.equal(it.lines['46'], 3000) // 25% × 30,000 × 20,000 / 50,000
  assert.equal(it.lines['49'], 27000)
  assert.equal(v.deduction.method, 'itemized')
  assert.equal(v.lines['34'], 27000)
})
