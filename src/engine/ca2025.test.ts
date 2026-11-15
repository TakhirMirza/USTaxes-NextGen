/**
 * California Form 540 tests, worked by hand from the 2025 540 Booklet (tax table, rate schedules,
 * AGI Limitation Worksheet, Itemized Deductions Worksheet, renter's credit) and the FTB 3514 booklet
 * (EITC table and worksheet, Young Child Tax Credit).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { CaInput, TaxReturnInput } from './model.ts'
import { caEitcFromTable, caTax, computeCalifornia } from './ca2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 35 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Payer') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput> = {}, ca: Partial<CaInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'CA', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, ca: { ...r.ca, ...ca } }
}
const ca = (ret: TaxReturnInput) => computeCalifornia(ret, computeReturn(ret))

test('tax table rows at their middle, the last $50 row, and the rate schedules', () => {
  assert.equal(caTax(50, 1), 0)
  assert.equal(caTax(51, 1), 1)
  assert.equal(caTax(13000, 1), 149) // row 12,951–13,050
  assert.equal(caTax(26300, 1), 416) // row 26,251–26,350
  assert.equal(caTax(33000, 2), 438)
  assert.equal(caTax(40100, 4), 580)
  assert.equal(caTax(100000, 1), 5736) // row 99,951–100,000
  assert.equal(caTax(125000, 2), 4768) // booklet example, Schedule Y
  assert.equal(caTax(1000000, 1), 103837) // 72,219.84 + 12.3% × 257,047
})

test('EITC table lookups', () => {
  assert.equal(caEitcFromTable(25, 0), 2)
  assert.equal(caEitcFromTable(4700, 0), 302)
  assert.equal(caEitcFromTable(7000, 1), 2016)
  assert.equal(caEitcFromTable(9825, 2), 3339)
  assert.equal(caEitcFromTable(30000, 1), 88)
  assert.equal(caEitcFromTable(32900, 3), 1)
  assert.equal(caEitcFromTable(32901, 3), 0)
  assert.equal(caEitcFromTable(0, 1), 0)
})

test('head of household renter with a 4-year-old: CalEITC, YCTC, credits limited to tax', () => {
  const v = ca(base({ filingStatus: 'hoh', w2s: [w2(30000)], dependents: [kid(4)] }, { withholding: 500, rentedHome: true }))
  assert.equal(v.lines['17'], 30000)
  assert.equal(v.lines['18'], 11412)
  assert.equal(v.lines['19'], 18588)
  assert.equal(v.lines['31'], 186) // 1% of 18,600
  assert.equal(v.lines['32'], 628) // 153 + 475
  assert.equal(v.lines['33'], 0)
  assert.equal(v.lines['46'], 120)
  assert.equal(v.lines['48'], 0)
  assert.equal(v.lines['75'], 88)
  assert.equal(v.lines['76'], 630) // 1,189 − 25.75 × 21.71 = 629.97
  assert.equal(v.lines['78'], 1218)
  assert.equal(v.lines['115'], 1218)
})

test('single, no children: standard deduction, exemption credit, renter’s credit $60', () => {
  const v = ca(base({ w2s: [w2(50000)] }, { withholding: 1400, rentedHome: true }))
  assert.equal(v.lines['19'], 44294)
  assert.equal(v.lines['31'], 1193) // 1,022.01 + 6% × (44,300 − 41,452)
  assert.equal(v.lines['32'], 153)
  assert.equal(v.lines['46'], 60)
  assert.equal(v.lines['48'], 980)
  assert.equal(v.lines['75'], 0)
  assert.equal(v.lines['115'], 420)
})

test('renter’s credit stops at California AGI over $53,994 (single)', () => {
  const v = ca(base({ w2s: [w2(54000)] }, { rentedHome: true }))
  assert.equal(v.lines['46'], 0)
  assert.match(v.renters.reason, /53,994/)
})

test('high income joint itemizer: no SALT cap, itemized and exemption credits limited', () => {
  const ret = base({
    filingStatus: 'mfj', w2s: [w2(600000)], dependents: [kid(10, 'A Payer'), kid(12, 'B Payer')],
    itemized: { ...emptyReturn().itemized, stateLocalIncomeOrSalesTax: 40000, realEstateTax: 20000, mortgageInterest: 30000, charityCash: 10000 }
  })
  const v = ca(ret)
  assert.equal(v.deduction.itemizedBeforeLimit, 60000)
  assert.equal(v.deduction.limitReduction, 5735) // 6% × 95,589 (less than 80% of 60,000)
  assert.equal(v.lines['18'], 54265)
  assert.equal(v.lines['19'], 545735)
  assert.equal(v.lines['31'], 43631) // 6,403.94 + 9.3% × 400,287
  assert.equal(v.lines['32'], 482) // e = 39 × 6 = 234; personal 306 − 468 → 0; dependents 950 − 468
  assert.equal(v.lines['33'], 43149)
  assert.equal(v.deduction.method, 'itemized')
})

test('Behavioral Health Services Tax: 1% over $1,000,000 of taxable income', () => {
  const v = ca(base({ w2s: [w2(1105706)] }))
  assert.equal(v.lines['19'], 1100000)
  assert.equal(v.lines['62'], 1000)
})

test('Schedule CA: unemployment, Social Security and state refund subtracted; HSA added back', () => {
  const ret = base({ w2s: [w2(40000)], unemployment: 5000 }, { stateRefundInFagi: 300, otherStateBondInterest: 200 })
  const v = ca(ret)
  assert.equal(v.scheduleCA.subtractions.unemployment, 5000)
  assert.equal(v.scheduleCA.subtractions.stateRefund, 300)
  assert.equal(v.scheduleCA.additions.otherStateBonds, 200)
  assert.equal(v.lines['14'], 5300)
  assert.equal(v.lines['16'], 200)
  assert.equal(v.lines['17'], 40000 + 5000 - 5300 + 200)
})

test('child care credit: federal-style credit × 43% for federal AGI over $40,000, care in California', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(60000)], dependents: [kid(5)], dependentCare: { expenses: 4000, employerBenefits: 0, providers: [] } })
  const res = computeReturn(ret)
  const v = computeCalifornia(ret, res)
  assert.equal(res.form2441.expensesUsed, 3000)
  assert.equal(res.form2441.rate, 0.2)
  assert.equal(v.lines['40'], 258) // 3,000 × 0.20 × 0.43
  const out = computeCalifornia({ ...ret, ca: { ...ret.ca, careInCalifornia: false } }, res)
  assert.equal(out.lines['40'], 0)
})

test('AGI limit on the EITC: smaller of the earned-income and AGI lookups', () => {
  // Earned income $10,000 (1,147... row 9,951–10,000 → 1,162), AGI $10,800 with interest (row 10,751–10,800 → 931).
  const ret = base({ w2s: [w2(10000)], dependents: [kid(8)], interest: [{ id: 'i', payer: 'Bank', interest: 800, taxExemptInterest: 0, federalWithholding: 0 }] })
  const v = ca(ret)
  assert.equal(v.eitc.earned, 10000)
  assert.equal(v.lines['75'], 931)
  assert.equal(v.eitc.usedAgi, true)
})
