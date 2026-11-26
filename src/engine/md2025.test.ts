/**
 * Maryland Form 502 tests, worked by hand from the 2025 Resident Tax Booklet: tax table (middle of each
 * $50 row), Tax Rate Schedules I and II, local tax chart, exemption chart, pension exclusion, two-income
 * subtraction, itemized deduction phaseout and the earned income credits.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptyTransaction, emptyW2 } from './model.ts'
import type { MarylandInput, TaxReturnInput } from './model.ts'
import { computeMaryland, mdCounty, mdExemptionEach, mdLocalTax, mdTax } from './md2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 40 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const base = (patch: Partial<TaxReturnInput> = {}, md: Partial<MarylandInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'MD', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, maryland: { ...r.maryland, subdivisionCode: '1600', ...md } }
}
const md = (ret: TaxReturnInput) => computeMaryland(ret, computeReturn(ret))

test('tax table rows are figured at their middle; schedules above $100,000', () => {
  assert.equal(mdTax(30, 1), 0)
  assert.equal(mdTax(60, 1), 1)
  assert.equal(mdTax(120, 1), 3)
  assert.equal(mdTax(1120, 1), 24)
  assert.equal(mdTax(3025, 1), 91)
  assert.equal(mdTax(3075, 2), 94)
  assert.equal(mdTax(9020, 1), 376)
  assert.equal(mdTax(125000, 1), 5948) // 5,947.50
  assert.equal(mdTax(225750, 2), 10989) // 10,947.50 + 5.5% × 750
})

test('local tax: flat county rate, Anne Arundel brackets, Frederick tiers', () => {
  assert.equal(mdLocalTax(53450, mdCounty('1600'), 1).tax, 1710)
  assert.equal(mdLocalTax(60000, mdCounty('0200'), 1).tax, 1644) // 50,000 × 2.7% + 10,000 × 2.94%
  assert.equal(mdLocalTax(60000, mdCounty('1104'), 1).tax, 1776) // City of Frederick → county: 2.96% on all
  assert.equal(mdLocalTax(60000, mdCounty('1100'), 2).tax, 1650) // joint: 2.75%
})

test('exemption chart', () => {
  assert.equal(mdExemptionEach(100000, 1), 3200)
  assert.equal(mdExemptionEach(110000, 1), 1600)
  assert.equal(mdExemptionEach(160000, 2), 1600)
  assert.equal(mdExemptionEach(210000, 2), 0)
  assert.equal(mdExemptionEach(20000, 6), 0)
})

test('single Montgomery County wage earner', () => {
  const v = md(base({ w2s: [w2(60000)] }, { withholding: 4000 }))
  assert.equal(v.status, 1)
  assert.equal(v.lines['16'], 60000)
  assert.equal(v.lines['17'], 3350)
  assert.equal(v.lines['19'], 3200)
  assert.equal(v.lines['20'], 53450)
  assert.equal(v.lines['21'], 2488) // row 53,450–53,500: 90 + 4.75% × 50,475
  assert.equal(v.lines['28'], 1710)
  assert.equal(v.lines['34'], 4198)
  assert.equal(v.lines['47'], 198)
})

test('itemized deduction: state income tax removed and 7.5% phaseout over $200,000', () => {
  const v = md(base({
    filingStatus: 'mfj', w2s: [w2(150000), w2(100000, 'spouse')], deductionChoice: 'itemized',
    itemized: { ...emptyReturn().itemized, stateLocalIncomeOrSalesTax: 15000, realEstateTax: 8000, mortgageInterest: 20000 }
  }))
  assert.equal(v.deduction.federalItemized, 43000)
  assert.equal(v.lines['17b'], 15000)
  assert.equal(v.lines['17c'], 3750)
  assert.equal(v.lines['17'], 24250)
  assert.equal(v.lines['19'], 0)
  assert.equal(v.lines['14'], 1200)
  assert.equal(v.lines['20'], 250000 - 1200 - 24250)
  assert.equal(v.deduction.method, 'itemized')
})

test('pension exclusion, Social Security subtraction, 65+ exemption and senior credit', () => {
  const ret = base({
    taxpayer: { ...person, age: 70, age65OrOlder: true },
    retirement: [{ ...empty1099R(), payer: 'Pension', grossDistribution: 50000, taxableAmount: 50000, code: '7', ira: false }],
    socialSecurity: [{ id: 'ss', owner: 'taxpayer', netBenefits: 20000, federalWithholding: 0 } as never]
  })
  const res = computeReturn(ret)
  const v = computeMaryland(ret, res)
  assert.equal(v.lines['10a'], 21200) // 41,200 − 20,000 of Social Security
  assert.equal(v.lines['11'], Math.round(res.f1040['6b']))
  assert.equal(v.lines['19'], 3200 + 1000)
  assert.equal(v.credits.senior, 1000)
  assert.ok(v.attach.some((a) => a.includes('502R')))
})

test('IRA distributions do not get the pension exclusion', () => {
  const v = md(base({
    taxpayer: { ...person, age: 70, age65OrOlder: true },
    retirement: [{ ...empty1099R(), payer: 'IRA', grossDistribution: 30000, taxableAmount: 30000, code: '7', ira: true }]
  }))
  assert.equal(v.lines['10a'], 0)
})

test('earned income credits, poverty level credit and the Maryland child tax credit', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [{ ...emptyDependent(), name: 'Kid', relationship: 'Son', age: 4, ssn: '123456789' }] })
  const res = computeReturn(ret)
  const v = computeMaryland(ret, res)
  const eic = Math.round(res.eic.credit)
  assert.ok(eic > 0)
  assert.equal(v.eic.worksheet, '18A')
  assert.equal(v.lines['22'], Math.round(eic * 0.5))
  assert.equal(v.lines['27'], 0)
  assert.equal(v.lines['44'], Math.max(0, Math.round(eic * 0.45) - v.lines['21']))
  assert.equal(v.credits.childTaxCredit, 250) // 500 − 50 × 5 (AGI $20,000)
  assert.equal(v.lines['29'], Math.round(eic * 0.32))
})

test('single without a child: 100% of the federal EIC, the excess refundable', () => {
  const ret = base({ w2s: [w2(12000)], taxpayer: { ...person, age: 30 } })
  const res = computeReturn(ret)
  const v = computeMaryland(ret, res)
  assert.equal(v.eic.worksheet, '18A.1')
  assert.equal(v.lines['22'], Math.round(res.eic.credit))
  assert.equal(v.lines['44'], Math.max(0, Math.round(res.eic.credit) - v.lines['21']))
})

test('additional 2% tax on net capital gain income over $350,000 AGI', () => {
  const v = md(base({ w2s: [w2(400000)], capitalTransactions: [{ ...emptyTransaction(), description: 'Stock', term: 'long', dateAcquired: '01/01/2020', dateSold: '06/01/2025', proceeds: 150000, costBasis: 50000 }] }))
  assert.equal(v.lines['20a'], 100000)
  assert.equal(v.lines['21b'], 2000)
})

test('Form 502CG: excluded gains on lines 2–7 reduce line 9 (Form 502 line 20a)', async () => {
  const r0 = base({ w2s: [w2(400000)], capitalTransactions: [{ ...emptyTransaction(), description: 'Stock', term: 'long', dateAcquired: '01/01/2020', dateSold: '06/01/2025', proceeds: 150000, costBasis: 50000 }] })
  const ret = { ...r0, maryland: { ...r0.maryland, cg: { ...r0.maryland.cg, '3': 30000, k1: 5000 } } }
  const res = computeReturn(ret)
  const v = computeMaryland(ret, res)
  assert.equal(v.cg!['1'], 100000)
  assert.equal(v.cg!['8'], 30000)
  assert.equal(v.cg!['9'], 70000)
  assert.equal(v.lines['20a'], 70000)
  const { buildMarylandPacket } = await import('../pdf/md2025.ts')
  const p = buildMarylandPacket(ret, res, v)
  const f = p.forms.find((x) => x.id === 'md502cg')!
  assert.equal(f.values['Text Box 73'], undefined)
  assert.equal(f.values['Text Box 72'], '30000')
  assert.equal(f.values['Text Box 78'], '70000')
  assert.ok(!p.notIncluded.some((x) => x.startsWith('Form 502CG')))
})

test('dependent taxpayer: status 6, no exemption', () => {
  const v = md(base({ canBeClaimedAsDependent: true, w2s: [w2(8000)] }))
  assert.equal(v.status, 6)
  assert.equal(v.lines['19'], 0)
})
