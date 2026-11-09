/**
 * Engine regression tests. Expected values are worked by hand from the 2025 Form 1040
 * instructions (Tax Table, Tax Computation Worksheet, QDCG worksheet, Schedules SE/8812/1-A).
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn, regularTax, taxFromSchedule } from './compute.ts'
import { emptyBusiness, emptyDependent, emptyReturn, emptyStudent, emptyTransaction, emptyW2, empty1099Div, empty1099R, emptySocialSecurity, normalizeReturn } from './model.ts'
import type { TaxReturnInput } from './model.ts'

const base = (patch: Partial<TaxReturnInput> = {}): TaxReturnInput => ({
  ...emptyReturn(),
  taxpayer: { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 40, age65OrOlder: false, blind: false },
  spouse: { ...emptyReturn().spouse, firstName: 'Test', lastName: 'Spouse', age: 40, age65OrOlder: false, blind: false },
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
  assert.equal(res.f1040['11a'], 60000)
  assert.equal(res.f1040['12e'], 15750)
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
  assert.equal(res.f1040['27a'], 7152)
  assert.equal(res.f1040['34'], 11552)
})

test('Schedule C → SE tax, half-SE adjustment and QBI deduction', () => {
  const biz = { ...emptyBusiness(), name: 'Consulting', grossReceipts: 50000 }
  const res = computeReturn(base({ businesses: [biz] }))
  assert.equal(res.schedule2.selfEmploymentTax, 7065)
  assert.equal(res.schedule1.adjustments.deductibleHalfOfSeTax, 3533)
  assert.equal(res.f1040['11a'], 46467)
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
  assert.equal(res.f1040['7a'], -3000)
  assert.equal(res.scheduleD.carryoverShort, 7000)
})

test('senior gets additional standard deduction and $6,000 Schedule 1-A deduction', () => {
  const res = computeReturn(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'S', lastName: 'R', age: 66, age65OrOlder: false, blind: false }, w2s: [w2(50000, 0)] }))
  assert.equal(res.f1040['12e'], 17750)
  assert.equal(res.f1040['13b'], 6000)
  assert.equal(res.f1040['16'], 2915)
})

test('tips deduction phases out $100 per $1,000 above $150,000', () => {
  const res = computeReturn(base({ w2s: [w2(160000, 0)], schedule1A: { qualifiedTips: 20000, qualifiedOvertime: 0, carLoanInterest: 0, vehicleVin: '' } }))
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

const kid = (age: number, patch = {}) => ({ ...emptyDependent(), name: `Kid ${age}`, age, ...patch })

test('EIC without children for a 30-year-old', () => {
  const res = computeReturn(base({ taxpayer: { ...base().taxpayer, age: 30 }, w2s: [w2(10000, 300)] }))
  assert.equal(res.f1040['27a'], 649)
  assert.equal(res.f1040['34'], 949)
})

test('EIC phases out with one child', () => {
  const res = computeReturn(base({ filingStatus: 'hoh', w2s: [w2(30000, 0)], dependents: [kid(8)] }))
  assert.equal(res.eic.credit, 3261)
})

test('no EIC without children outside ages 25–64, or with high investment income', () => {
  assert.equal(computeReturn(base({ taxpayer: { ...base().taxpayer, age: 22 }, w2s: [w2(10000, 0)] })).eic.credit, 0)
  const rich = computeReturn(base({ filingStatus: 'hoh', w2s: [w2(20000, 0)], dependents: [kid(8)], interest: [{ id: 'i', payer: 'B', interest: 12000, taxExemptInterest: 0, federalWithholding: 0 }] }))
  assert.equal(rich.eic.credit, 0)
})

test('dependent age and SSN decide Child Tax Credit vs other-dependent credit', () => {
  const res = computeReturn(base({ filingStatus: 'mfj', w2s: [w2(120000, 0)], dependents: [kid(5), kid(17), kid(10, { hasSsn: false })] }))
  assert.equal(res.schedule8812.qualifyingChildren, 1)
  assert.equal(res.schedule8812.creditBeforePhaseout, 2200 + 500 + 500)
})

test('Social Security benefits: worksheet taxes part of the benefits', () => {
  const pension = { ...empty1099R(), payer: 'Plan', grossDistribution: 20000, taxableAmount: 20000, code: '7' }
  const ss = { ...emptySocialSecurity(), netBenefits: 24000 }
  const res = computeReturn(base({ taxpayer: { ...base().taxpayer, age: 67 }, retirement: [pension], socialSecurity: [ss] }))
  assert.equal(res.f1040['5b'], 20000)
  assert.equal(res.f1040['6a'], 24000)
  assert.equal(res.f1040['6b'], 3500)
  assert.equal(res.f1040['11a'], 23500)
  assert.equal(res.f1040['12e'], 17750)
  assert.equal(res.f1040['13b'], 6000)
  assert.equal(res.f1040['15'], 0)
})

test('Social Security is untaxed when other income is low', () => {
  const res = computeReturn(base({ socialSecurity: [{ ...emptySocialSecurity(), netBenefits: 20000 }] }))
  assert.equal(res.f1040['6b'], 0)
})

test('early IRA distribution adds the 10% additional tax', () => {
  const ira = { ...empty1099R(), payer: 'Broker', grossDistribution: 10000, taxableAmount: 10000, federalWithholding: 2000, code: '1', ira: true }
  const res = computeReturn(base({ w2s: [w2(40000, 0)], retirement: [ira] }))
  assert.equal(res.f1040['4b'], 10000)
  assert.equal(res.schedule2.earlyDistributionTax, 1000)
  assert.equal(res.f1040['25b'], 2000)
})

test('child care credit: $3,000 limit at the 20% rate', () => {
  const res = computeReturn(base({ filingStatus: 'mfj', w2s: [w2(50000, 0), w2(50000, 0, 'spouse')], dependents: [kid(5)], dependentCare: { expenses: 5000, employerBenefits: 0, providers: [] } }))
  assert.equal(res.form2441.credit, 600)
  assert.equal(res.schedule3.dependentCare, 600)
  assert.equal(res.f1040['20'], 600)
})

test('child care credit rate is 35% at low income', () => {
  const res = computeReturn(base({ filingStatus: 'hoh', w2s: [w2(14000, 0)], dependents: [kid(3)], dependentCare: { expenses: 2000, employerBenefits: 0, providers: [] } }))
  assert.equal(res.form2441.rate, 0.35)
  assert.equal(res.form2441.credit, 700)
})

test('American Opportunity Credit: $2,500 with 40% refundable', () => {
  const res = computeReturn(base({ w2s: [w2(50000, 0)], students: [{ ...emptyStudent(), name: 'Me', qualifiedExpenses: 4000 }] }))
  assert.equal(res.form8863.aotc, 2500)
  assert.equal(res.f1040['29'], 1000)
  assert.equal(res.schedule3.education, 1500)
})

test('Lifetime Learning Credit phases out between $80,000 and $90,000', () => {
  const res = computeReturn(base({ w2s: [w2(85000, 0)], students: [{ ...emptyStudent(), name: 'Me', qualifiedExpenses: 10000, aotcEligible: false }] }))
  assert.equal(res.form8863.llc, 1000)
})

test('version-1 saved files map the old qualifying-child checkbox to an age', () => {
  const n = normalizeReturn({ dependents: [{ id: 'a', name: 'A', qualifyingChild: true }, { id: 'b', name: 'B', qualifyingChild: false }], taxpayer: { age65OrOlder: true } })
  assert.equal(n.dependents[0].age, 10)
  assert.equal(n.dependents[1].age, 17)
  assert.equal(n.taxpayer.age, 65)
})

test('Schedule 1-A tips: reduction uses whole thousands (rounded down)', () => {
  const res = computeReturn(base({ w2s: [w2(160500, 0)], schedule1A: { qualifiedTips: 20000, qualifiedOvertime: 0, carLoanInterest: 0, vehicleVin: '' } }))
  assert.equal(res.schedule1A.tipOtReduction, 1000)
  assert.equal(res.schedule1A.tips, 19000)
})

test('Schedule 1-A car loan: reduction rounds the thousands up', () => {
  const res = computeReturn(base({ w2s: [w2(100500, 0)], schedule1A: { qualifiedTips: 0, qualifiedOvertime: 0, carLoanInterest: 5000, vehicleVin: '' } }))
  assert.equal(res.schedule1A.carReduction, 200)
  assert.equal(res.schedule1A.carLoanInterest, 4800)
})

test('Schedule 1-A seniors: each spouse is reduced by 6% of the excess', () => {
  const old = { age: 70, age65OrOlder: true }
  const res = computeReturn(base({ filingStatus: 'mfj', taxpayer: { ...base().taxpayer, ...old }, spouse: { ...base().spouse, ...old }, w2s: [w2(160000, 0)] }))
  assert.equal(res.schedule1A.seniorEach, 5400)
  assert.equal(res.schedule1A.senior, 10800)
})

test('Form 2441 Part III: excluded benefits use up the expense limit', () => {
  const res = computeReturn(base({ filingStatus: 'mfj', w2s: [w2(50000, 0), w2(50000, 0, 'spouse')], dependents: [kid(5)], dependentCare: { expenses: 7000, employerBenefits: 5000, providers: [] } }))
  assert.equal(res.form2441.partIII?.line25, 5000)
  assert.equal(res.form2441.partIII?.line26, 0)
  assert.equal(res.form2441.partIII?.line29, 0)
  assert.equal(res.form2441.credit, 0)
  assert.equal(res.f1040['1e'], 0)
})

test('Form 2441 Part III: benefits over $5,000 are taxable on line 1e', () => {
  const res = computeReturn(base({ filingStatus: 'mfj', w2s: [w2(50000, 0), w2(50000, 0, 'spouse')], dependents: [kid(5), kid(3)], dependentCare: { expenses: 9000, employerBenefits: 6000, providers: [] } }))
  assert.equal(res.f1040['1e'], 1000)
  assert.equal(res.f1040['1z'], 101000)
  assert.equal(res.form2441.partIII?.line31, 1000)
  assert.equal(res.form2441.credit, 200)
})

test('education phase-out fraction is rounded to three decimals', () => {
  const res = computeReturn(base({ w2s: [w2(83333, 0)], students: [{ ...emptyStudent(), name: 'Me', qualifiedExpenses: 10000, aotcEligible: false }] }))
  assert.equal(res.form8863Detail.phaseoutFraction, 0.667)
  assert.equal(res.form8863.llc, 1334)
})

test('Saver’s Credit: 50% of up to $2,000 at low AGI, limited by tax', () => {
  const ret = base({ w2s: [w2(22000, 500)], savings: { taxpayer: { iraContributions: 1000, electiveDeferrals: 1500, distributions: 0 }, spouse: { iraContributions: 0, electiveDeferrals: 0, distributions: 0 } } })
  const res = computeReturn(ret)
  assert.equal(res.form8880.rate, 0.5)
  assert.equal(res.form8880.tentative, 1000)
  // Tax Table row $6,250–$6,300 gives $628, so the credit is limited to that
  assert.equal(res.f1040['16'], 628)
  assert.equal(res.schedule3.saversCredit, 628)
  assert.equal(res.f1040['22'], 0)
})

test('Saver’s Credit: distributions reduce contributions; students are not eligible', () => {
  const s = (ira: number, dist: number) => ({ iraContributions: ira, electiveDeferrals: 0, distributions: dist })
  const res = computeReturn(base({ filingStatus: 'mfj', w2s: [w2(50000, 0)], savings: { taxpayer: s(3000, 500), spouse: s(2000, 0) }, spouse: { ...base().spouse, fullTimeStudent: true } }))
  assert.equal(res.form8880.people[0].line6, 2000)
  assert.equal(res.form8880.people[1].line6, 0)
  assert.equal(res.form8880.rate, 0.2)
  assert.equal(res.form8880.credit, 400)
})

test('Form 2210: no penalty under $1,000 or when 2024 safe harbor is met', () => {
  const small = computeReturn(base({ w2s: [w2(60000, 4500)] }))
  assert.equal(small.form2210.penalty, 0)
  const safe = computeReturn(base({ w2s: [w2(60000, 2000)], priorYear: { tax: 1800, agi: 50000, noLiability: false } }))
  assert.equal(safe.form2210.applies, false)
  assert.equal(safe.f1040['38'], 0)
})

test('Form 2210: no estimates paid — penalty on each quarter at 7%', () => {
  const biz = { ...emptyBusiness(), name: 'Shop', grossReceipts: 80000 }
  const res = computeReturn(base({ businesses: [biz], priorYear: { tax: 9000, agi: 60000, noLiability: false } }))
  const p = res.form2210
  assert.equal(p.line9, 9000)
  // 2,250 per quarter, each unpaid until April 15, 2026
  const days = [365, 304, 212, 90]
  const expected = Math.round(days.reduce((t, d) => t + 2250 * d / 365 * 0.07, 0))
  assert.equal(p.penalty, expected)
  assert.equal(res.f1040['38'], expected)
  assert.equal(res.f1040['37'], res.f1040['24'] - res.f1040['33'] + expected)
})

test('Form 2210: on-time quarterly estimates avoid the penalty; a late start does not', () => {
  const biz = { ...emptyBusiness(), name: 'Shop', grossReceipts: 80000 }
  const prior = { tax: 9000, agi: 60000, noLiability: false }
  const onTime = computeReturn(base({ businesses: [biz], priorYear: prior, payments: { estimatedTaxPayments: 9000, estimatedByQuarter: [2250, 2250, 2250, 2250], otherWithholding: 0 } }))
  assert.equal(onTime.form2210.penalty, 0)
  const late = computeReturn(base({ businesses: [biz], priorYear: prior, payments: { estimatedTaxPayments: 9000, estimatedByQuarter: [0, 0, 4500, 4500], otherWithholding: 0 } }))
  // 9/15 payment clears Q1 (153 days) and Q2 (92 days); Q3 then stays short until 1/15 (122 days)
  const expected = Math.round(2250 * (153 + 92 + 122) / 365 * 0.07)
  assert.equal(late.form2210.penalty, expected)
})

test('normalizeReturn spreads an old yearly estimate total across four quarters', () => {
  const n = normalizeReturn({ payments: { estimatedTaxPayments: 1000, otherWithholding: 0 } })
  assert.deepEqual(n.payments.estimatedByQuarter, [250, 250, 250, 250])
})

test('example household computes without errors and uses the new credits', async () => {
  const { exampleReturn } = await import('../app/example.ts')
  const res = computeReturn(exampleReturn())
  assert.equal(res.issues.filter((i) => i.level === 'error').length, 0)
  assert.ok(res.schedule3.dependentCare > 0)
  assert.ok(res.schedule3.saversCredit > 0)
  assert.ok(res.eic.credit > 0)
  assert.equal(res.form2210.penalty, 0)
  assert.ok(res.f1040['34'] > 0)
})
