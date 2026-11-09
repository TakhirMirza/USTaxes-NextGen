/**
 * Engine regression tests. Expected values are worked by hand from the 2025 Form 1040
 * instructions (Tax Table, Tax Computation Worksheet, QDCG worksheet, Schedules SE/8812/1-A).
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn, regularTax, taxFromSchedule } from './compute.ts'
import { emptyAsset, emptyBusiness, emptyDependent, emptyHomeOffice, emptyHsa, emptyRental, emptyReturn, emptyStudent, emptyTransaction, emptyW2, empty1099Div, empty1099R, emptySocialSecurity, normalizeReturn } from './model.ts'
import type { CapitalTransaction, DepreciableAsset, ScheduleCBusiness, TaxReturnInput } from './model.ts'
import { groups8949, holdingTermFromDates, lineFor, scheduleDLines } from './capital.ts'
import { qbiDeduction } from './qbi.ts'
import { assetDepreciation, macrsRate } from './depreciation.ts'
import type { QbiBusinessInput } from './qbi.ts'

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


// ── Home office, rentals, HSA, AMT ────────────────────────────────────────────
const bizWith = (gross: number, supplies: number, homeOffice = emptyHomeOffice()) =>
  ({ ...emptyBusiness(), name: 'Studio', grossReceipts: gross, expenses: { ...emptyBusiness().expenses, supplies }, homeOffice })

test('home office, simplified method: $5 per square foot, limited to profit', () => {
  const a = computeReturn(base({ businesses: [bizWith(30000, 5000, { ...emptyHomeOffice(), method: 'simplified', officeSqFt: 200 })] }))
  assert.equal(a.scheduleC[0].tentativeProfit, 25000)
  assert.equal(a.scheduleC[0].homeOffice.deduction, 1000)
  assert.equal(a.scheduleC[0].netProfit, 24000)
  const b = computeReturn(base({ businesses: [bizWith(1200, 500, { ...emptyHomeOffice(), method: 'simplified', officeSqFt: 400 })] }))
  assert.equal(b.scheduleC[0].homeOffice.deduction, 700)
  assert.equal(b.scheduleC[0].netProfit, 0)
})

test('home office, regular method: Form 8829 ordering and carryover', () => {
  const ho = { ...emptyHomeOffice(), method: 'regular' as const, homeSqFt: 2000, officeSqFt: 200, mortgageInterest: 10000, realEstateTaxes: 4000, insurance: 1000, utilities: 3000, repairs: 1000, depreciation: 2000 }
  const res = computeReturn(base({ businesses: [bizWith(8000, 5000, ho)] }))
  const h = res.scheduleC[0].homeOffice
  // Standard deduction: mortgage interest and taxes move to lines 16–17 and are limited by the profit.
  assert.equal(h.line14, 0)
  assert.equal(h.lines['16b'], 10000)
  assert.equal(h.lines['24'], 1900)
  assert.equal(h.line25, 1900)
  assert.equal(h.depreciationAllowed, 1100)
  assert.equal(h.carryover, 900)
  assert.equal(h.deduction, 3000)
  assert.equal(res.scheduleC[0].netProfit, 0)
})

test('home office, itemizing: mortgage interest and taxes on lines 10–11 are always allowed', () => {
  const ho = { ...emptyHomeOffice(), method: 'regular' as const, homeSqFt: 2000, officeSqFt: 200, mortgageInterest: 10000, realEstateTaxes: 4000, insurance: 1000, utilities: 3000, repairs: 1000, depreciation: 2000 }
  const res = computeReturn(base({
    w2s: [w2(150000, 20000)], deductionChoice: 'itemized',
    itemized: { ...emptyReturn().itemized, mortgageInterest: 18000, realEstateTax: 3600, stateLocalIncomeOrSalesTax: 6000 },
    businesses: [bizWith(8000, 5000, ho)]
  }))
  const h = res.scheduleC[0].homeOffice
  assert.equal(h.lines['10b'], 10000)
  assert.equal(h.line14, 1400)
  assert.equal(h.lines['15'], 1600)
  assert.equal(h.line25, 500)
  assert.equal(h.depreciationAllowed, 1100)
  assert.equal(h.deduction, 3000)
})

test('home office depreciation from the home basis (Form 8829 Part III)', () => {
  const ho = { ...emptyHomeOffice(), method: 'regular' as const, homeSqFt: 2000, officeSqFt: 300, homeBasis: 400000, landValue: 100000, firstUsed: '03/15/2025' }
  const res = computeReturn(base({ businesses: [bizWith(50000, 0, ho)] }))
  const L = res.scheduleC[0].homeOffice.lines
  assert.deepEqual([L['39'], L['40'], L['41'], L['42']], [300000, 45000, 2.033, 915])
  const f = res.form4562.find((x) => x.kind === 'business')!
  assert.deepEqual(f.home, { placed: '03/2025', basis: 45000, deduction: 915 })
  assert.equal(res.scheduleC[0].depreciation, 0, 'home depreciation is not on Schedule C line 13')
  const older = computeReturn(base({ businesses: [bizWith(50000, 0, { ...ho, firstUsed: '06/01/2019' })] }))
  assert.equal(older.scheduleC[0].homeOffice.lines['42'], 1154)
})

test('MACRS, bonus and section 179 on Form 4562', () => {
  const eq = (p: Partial<DepreciableAsset>): DepreciableAsset => ({ ...emptyAsset('7'), description: 'Desk', placedInService: '03/01/2025', cost: 10000, ...p })
  // Half-year 7-year property, bonus elected out: 14.29%.
  assert.equal(assetDepreciation(eq({ bonus: 'none' }), { midQuarter: false, allow179: true }).macrs, 1429)
  // Acquired after January 19, 2025: 100% bonus.
  const full = assetDepreciation(eq({}), { midQuarter: false, allow179: true })
  assert.deepEqual([full.bonusRate, full.bonus, full.macrs], [1, 10000, 0])
  // Acquired before January 20, 2025: 40% bonus, then MACRS on the rest.
  const phased = assetDepreciation(eq({ acquiredBeforeJan20: true }), { midQuarter: false, allow179: true })
  assert.deepEqual([phased.bonus, phased.depreciableBasis, phased.macrs], [4000, 6000, 857])
  // Section 179 first, then bonus on the remainder.
  const mixed = assetDepreciation(eq({ section179: 3000, bonus: '40' }), { midQuarter: false, allow179: true })
  assert.deepEqual([mixed.section179Elected, mixed.bonus, mixed.macrs], [3000, 2800, 600])
  // Prior-year asset: 5-year placed in 2023 is in its third year (19.20%).
  assert.equal(assetDepreciation({ ...emptyAsset('5'), cost: 5000, placedInService: '07/01/2023' }, { midQuarter: false, allow179: true }).macrs, 960)
  // Mid-quarter, 5-year, 4th quarter: 5%.
  assert.equal(macrsRate('5', 1, 11, 'MQ'), 5)
  assert.equal(macrsRate('5', 2, 2, 'MQ'), 26)
  // Residential rental, placed in service in May 2025: 2.273%.
  assert.equal(assetDepreciation({ ...emptyAsset('27.5'), cost: 220000, placedInService: '05/10/2025' }, { midQuarter: false, allow179: false }).macrs, 5001)
})

test('section 179 is limited to business income and carries over', () => {
  const biz = { ...emptyBusiness(), name: 'Shop', grossReceipts: 20000, assets: [{ ...emptyAsset('5'), description: 'Truck', placedInService: '04/01/2025', cost: 50000, section179: 50000 }] }
  const res = computeReturn(base({ businesses: [biz] }))
  assert.equal(res.section179.line9, 50000)
  assert.equal(res.section179.line11, 20000)
  assert.equal(res.section179.line12, 20000)
  assert.equal(res.section179.line13, 30000)
  assert.equal(res.scheduleC[0].depreciation, 20000)
  assert.equal(res.scheduleC[0].netProfit, 0)
  const withWages = computeReturn(base({ w2s: [w2(80000, 8000)], businesses: [biz] }))
  assert.equal(withWages.section179.line12, 50000)
  assert.equal(withWages.scheduleC[0].netProfit, -30000)
  assert.equal(withWages.form4562[0].line22, 50000)
})

test('rental property depreciation from assets adds to Schedule E', () => {
  const p = { ...emptyRental(), address: '1 Oak', rents: 30000, assets: [{ ...emptyAsset('27.5'), description: 'House', cost: 300000, placedInService: '01/15/2020' }, { ...emptyAsset('5'), description: 'Fridge', cost: 1200, placedInService: '08/01/2025' }] }
  const res = computeReturn(base({ rentals: [p] }))
  const rr = res.scheduleE.properties[0]
  assert.equal(rr.assetDepreciation, 10908 + 1200)
  assert.equal(rr.net, 30000 - 12108)
  const f = res.form4562.find((x) => x.kind === 'rental')!
  assert.equal(f.line14, 1200)
  assert.equal(f.line17, 10908)
  assert.ok(f.required)
})

test('older files: a home office amount among expenses becomes the "already figured" method', () => {
  const n = normalizeReturn({ businesses: [{ name: 'Old', grossReceipts: 10000, expenses: { homeOffice: 800 } }] })
  assert.equal(n.businesses[0].homeOffice.method, 'amount')
  assert.equal(n.businesses[0].homeOffice.amount, 800)
  assert.equal(n.businesses[0].expenses.homeOffice, 0)
  assert.equal(computeReturn(n).scheduleC[0].netProfit, 9200)
})

const rental = (rents: number, expenses: number, active = true) =>
  ({ ...emptyRental(), address: '5 Rent Rd', rents, activeParticipation: active, expenses: { ...emptyRental().expenses, repairs: expenses } })

test('rental loss up to $25,000 is allowed with active participation', () => {
  const res = computeReturn(base({ w2s: [w2(80000, 0)], rentals: [rental(12000, 20000)] }))
  assert.equal(res.scheduleE.allowedLoss, 8000)
  assert.equal(res.f1040['8'], -8000)
  assert.equal(res.f1040['11a'], 72000)
})

test('rental loss allowance phases out above $100,000 MAGI', () => {
  const res = computeReturn(base({ w2s: [w2(140000, 0)], rentals: [rental(10000, 40000)] }))
  assert.equal(res.scheduleE.allowance, 5000)
  assert.equal(res.scheduleE.allowedLoss, 5000)
  assert.equal(res.scheduleE.disallowed, 25000)
  const passive = computeReturn(base({ w2s: [w2(60000, 0)], rentals: [rental(10000, 15000, false)] }))
  assert.equal(passive.scheduleE.allowedLoss, 0)
})

test('rental income adds to Schedule 1 and to net investment income', () => {
  const res = computeReturn(base({ w2s: [w2(240000, 0)], rentals: [rental(30000, 10000)] }))
  assert.equal(res.schedule1.rentalIncome, 20000)
  assert.equal(res.schedule2.netInvestmentIncomeTax, Math.round(20000 * 0.038))
})

test('HSA: deduction is the limit minus employer money; non-medical withdrawals are taxed', () => {
  const hsa = { ...emptyHsa(), coverage: 'self' as const, personalContributions: 3000, employerContributions: 1000, distributions: 500, qualifiedExpenses: 200 }
  const res = computeReturn(base({ w2s: [w2(60000, 0)], hsa: { taxpayer: hsa, spouse: emptyHsa() } }))
  assert.equal(res.form8889[0].line12, 3300)
  assert.equal(res.schedule1.adjustments.hsaDeduction, 3000)
  assert.equal(res.schedule1.hsaTaxable, 300)
  assert.equal(res.schedule2.hsaAdditionalTax, 60)
  const over = computeReturn(base({ w2s: [w2(60000, 0)], hsa: { taxpayer: { ...hsa, personalContributions: 4000 }, spouse: emptyHsa() } }))
  assert.equal(over.form8889[0].line13, 3300)
  assert.equal(over.form8889[0].excess, 700)
})

test('HSA: catch-up at 55, and a shared family limit when both spouses have family coverage', () => {
  const older = computeReturn(base({ taxpayer: { ...base().taxpayer, age: 56 }, hsa: { taxpayer: { ...emptyHsa(), coverage: 'self', personalContributions: 6000 }, spouse: emptyHsa() } }))
  assert.equal(older.form8889[0].line8, 5300)
  const fam = { ...emptyHsa(), coverage: 'family' as const, personalContributions: 5000 }
  const both = computeReturn(base({ filingStatus: 'mfj', hsa: { taxpayer: fam, spouse: fam } }))
  assert.equal(both.form8889[0].line3, 4275)
  assert.equal(both.schedule1.adjustments.hsaDeduction, 8550)
})

test('AMT: large incentive stock option exercise triggers the alternative minimum tax', () => {
  const res = computeReturn(base({ w2s: [w2(150000, 0)], amt: { isoBargainElement: 300000, privateActivityBondInterest: 0, otherAdjustments: 0 } }))
  assert.equal(res.f1040['16'], 25067)
  assert.equal(res.form6251.line4, 450000)
  assert.equal(res.form6251.line7, 96550)
  assert.equal(res.f1040['17'], 71483)
  assert.equal(res.f1040['18'], 25067 + 71483)
})

test('AMT: an ordinary W-2 return owes none', () => {
  assert.equal(computeReturn(base({ w2s: [w2(60000, 0)] })).f1040['17'], 0)
})

test('AMT: the senior deduction is added back (Form 6251 line 1a), tips are not', () => {
  const ret = base({ taxpayer: { ...base().taxpayer, age: 70 }, w2s: [w2(60000, 0)], schedule1A: { qualifiedTips: 3000, qualifiedOvertime: 0, carLoanInterest: 0, vehicleVin: '' } })
  const res = computeReturn(ret)
  // line 14 = 17,750 standard + 6,000 senior + 3,000 tips; line 1a removes only the senior part
  assert.equal(res.form6251.line1a, 17750 + 3000)
  assert.equal(res.form6251.line1b, 60000 - 20750)
  assert.equal(res.form6251.line4, 60000 - 20750 + 17750)
})

test('AMT Part III keeps the 15% rate on long-term gains', () => {
  const tx = { ...emptyTransaction(), term: 'long' as const, proceeds: 250000, costBasis: 50000 }
  const res = computeReturn(base({ w2s: [w2(100000, 0)], capitalTransactions: [tx], amt: { isoBargainElement: 200000, privateActivityBondInterest: 0, otherAdjustments: 0 } }))
  const p = res.form6251.part3!
  assert.ok(p)
  assert.equal(p.l13, 200000)
  assert.equal(p.l40, Math.min(p.l38, p.l39))
  assert.equal(res.form6251.line7, p.l40)
  assert.ok(res.f1040['17'] > 0)
})

test('an unknown filing status from an imported file falls back to single', () => {
  const ret = normalizeReturn({ filingStatus: 'married_joint', w2s: [{ wages: 50000 }] })
  assert.equal(ret.filingStatus, 'single')
  assert.ok(computeReturn(ret).f1040['16'] > 0)
})

test('Form 8995-A: wage limit and phase-in for a non-service business', () => {
  const biz = (over: Partial<QbiBusinessInput> = {}): QbiBusinessInput => ({ id: 'a', name: 'A', tin: '', sstb: false, qbi: 200000, w2Wages: 40000, ubia: 0, ...over })
  const mid = qbiDeduction({ fs: 'single', taxableIncomeBeforeQbi: 222300, netCapitalGain: 0, businesses: [biz()], priorLoss: 0, reitPtp: 0, priorReitLoss: 0 })
  assert.equal(mid.form, '8995a')
  const b = mid.businesses[0]
  assert.deepEqual([b.line3, b.line10, b.line11], [40000, 20000, 20000])
  assert.deepEqual(b.phase, { line17: 40000, line18: 20000, line19: 20000, line25: 10000, line26: 30000 })
  assert.equal(mid.deduction, 30000)
  const sstb = qbiDeduction({ fs: 'single', taxableIncomeBeforeQbi: 222300, netCapitalGain: 0, businesses: [biz({ sstb: true })], priorLoss: 0, reitPtp: 0, priorReitLoss: 0 })
  assert.equal(sstb.businesses[0].applicablePct, 0.5)
  assert.equal(sstb.deduction, 15000)
  const over = qbiDeduction({ fs: 'single', taxableIncomeBeforeQbi: 300000, netCapitalGain: 0, businesses: [biz({ sstb: true })], priorLoss: 0, reitPtp: 0, priorReitLoss: 0 })
  assert.equal(over.deduction, 0)
  assert.ok(over.businesses[0].excluded)
})

test('Form 8995-A: losses and the 2024 carryforward reduce profitable businesses', () => {
  const res = qbiDeduction({
    fs: 'single', taxableIncomeBeforeQbi: 300000, netCapitalGain: 0, priorLoss: 10000, reitPtp: 0, priorReitLoss: 0,
    businesses: [{ id: 'a', name: 'A', tin: '', sstb: false, qbi: 100000, w2Wages: 100000, ubia: 0 }, { id: 'b', name: 'B', tin: '', sstb: false, qbi: -20000, w2Wages: 0, ubia: 0 }]
  })
  assert.equal(res.businesses[0].line2, 70000)
  assert.equal(res.businesses[1].line2, 0)
  assert.equal(res.deduction, 14000)
})

test('Form 8995: net loss carries forward and REIT dividends still count', () => {
  const res = qbiDeduction({
    fs: 'single', taxableIncomeBeforeQbi: 100000, netCapitalGain: 0, priorLoss: 60000, reitPtp: 1000, priorReitLoss: 0,
    businesses: [{ id: 'a', name: 'A', tin: '', sstb: false, qbi: 50000, w2Wages: 0, ubia: 0 }]
  })
  assert.equal(res.form, '8995')
  assert.equal(res.lossCarryforward, 10000)
  assert.equal(res.deduction, 200)
})

test('high-income sole proprietor: QBI deduction needs wages above the threshold', () => {
  const ret = (qbi: Partial<ScheduleCBusiness['qbi']>): TaxReturnInput => normalizeReturn({
    filingStatus: 'single', taxpayer: { firstName: 'A', age: 40 },
    businesses: [{ ...emptyBusiness(), id: 'b1', name: 'Shop', grossReceipts: 300000, qbi: { w2Wages: 0, ubia: 0, sstb: false, ...qbi } }]
  })
  const none = computeReturn(ret({}))
  assert.equal(none.qbi.form, '8995a')
  assert.equal(none.qbi.deduction, 0)
  const wages = computeReturn(ret({ w2Wages: 100000 }))
  assert.equal(wages.qbi.businesses[0].line5, 50000)
  assert.equal(wages.qbi.deduction, 50000)
  assert.equal(wages.f1040['13a'], 50000)
  assert.equal(computeReturn(ret({ w2Wages: 100000, sstb: true })).qbi.deduction, 0)
})

test('Form 8949: boxes, wash-sale adjustments and Schedule D lines', () => {
  const tx = (p: Partial<CapitalTransaction>): CapitalTransaction => ({ ...emptyTransaction(), dateAcquired: '01/05/2024', dateSold: '03/10/2025', proceeds: 1000, costBasis: 800, ...p })
  const txs = [
    tx({ term: 'long' }),
    tx({ term: 'short', dateAcquired: '06/01/2025', proceeds: 5000, costBasis: 7000, adjustmentCode: 'W', adjustment: 1500 }),
    tx({ term: 'long', reporting: 'noncovered', proceeds: 3000, costBasis: 1000 }),
    tx({ term: 'short', dateAcquired: '01/02/2025', digitalAsset: true, reporting: 'none', proceeds: 400, costBasis: 100 })
  ]
  assert.deepEqual(groups8949(txs).map((g) => `${g.box}:${g.line}`), ['A:1b', 'I:3', 'E:9'])
  const L = scheduleDLines(txs)
  assert.deepEqual(L['1b'], { proceeds: 5000, basis: 7000, adjustment: 1500, gain: -500 })
  assert.equal(L['8a'].gain, 200)
  const res = computeReturn(base({ capitalTransactions: txs }))
  assert.equal(res.scheduleD.shortTerm, -500 + 300)
  assert.equal(res.scheduleD.longTerm, 200 + 2000)
  assert.equal(holdingTermFromDates('03/10/2024', '03/10/2025'), 'short')
  assert.equal(holdingTermFromDates('03/10/2024', '03/11/2025'), 'long')
  assert.equal(holdingTermFromDates('INHERITED', '03/11/2025'), 'long')
  const wrong = computeReturn(base({ capitalTransactions: [tx({ term: 'short' })] }))
  assert.ok(wrong.issues.some((i) => i.message.includes('long-term holding period')))
})

test('older saved sales keep printing on Schedule D line 1a/8a', () => {
  const ret = normalizeReturn({ capitalTransactions: [{ id: 'x', description: 'XYZ', term: 'long', proceeds: 100, costBasis: 50 }] })
  assert.equal(ret.capitalTransactions[0].reporting, 'covered')
  assert.equal(lineFor(ret.capitalTransactions[0]), '8a')
})

test('Form 5329: early distribution exception and 6% tax on excess HSA contributions', () => {
  const ret = base({
    retirement: [
      { ...empty1099R(), payer: 'IRA Co', grossDistribution: 20000, taxableAmount: 20000, code: '1', ira: true, earlyExceptionCode: '09', earlyExceptionAmount: 10000 },
      { ...empty1099R(), payer: 'Plan', grossDistribution: 5000, taxableAmount: 5000, code: '1' }
    ],
    hsa: { taxpayer: { ...emptyHsa(), coverage: 'self', personalContributions: 5300, yearEndValue: 900 }, spouse: emptyHsa() }
  })
  const res = computeReturn(ret)
  const f = res.form5329[0]
  assert.deepEqual([f.line1, f.line2, f.exceptionCode, f.line3, f.line4], [25000, 10000, '09', 15000, 1500])
  assert.equal(f.line47, 1000)
  assert.equal(f.line49, 54) // 6% of the HSA value (900), smaller than the $1,000 excess
  assert.equal(res.schedule2.earlyDistributionTax, 1500)
  assert.equal(res.schedule2.hsaExcessTax, 54)
  assert.ok(f.required)
  const withdrawn = computeReturn(base({ hsa: { taxpayer: { ...emptyHsa(), coverage: 'self', personalContributions: 5300, excessWithdrawn: true }, spouse: emptyHsa() } }))
  assert.equal(withdrawn.schedule2.hsaExcessTax, 0)
  const plain = computeReturn(base({ retirement: [{ ...empty1099R(), grossDistribution: 4000, taxableAmount: 4000, code: '1' }] }))
  assert.equal(plain.schedule2.earlyDistributionTax, 400)
  assert.equal(plain.form5329[0].required, false)
})
