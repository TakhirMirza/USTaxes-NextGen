/**
 * Form 1040 (tax year 2025) calculation engine.
 *
 * One pure function: TaxReturnInput → TaxReturnResult. Every Form 1040 line and supporting
 * schedule is derived here, in IRS order, with whole-dollar rounding at each line.
 */
import type { Dependent, HomeOffice, HsaAccount, Owner, Person, ScheduleCBusiness, TaxReturnInput } from './model.ts'
import * as R from './rules2025.ts'
import { qbiDeduction } from './qbi.ts'
import { gainOf, holdingTermFromDates, isAggregated, parseDate, withDefaults } from './capital.ts'
import { NONRES_FIRST_YEAR, assetDepreciation, form4562For, isPersonalProperty, midQuarterApplies, section179 } from './depreciation.ts'
import type { AssetResult, Form4562Result, Section179Result } from './depreciation.ts'
import { form4797 } from './sales.ts'
import { k1Activity, k1Totals } from './k1.ts'
import { form8582 } from './passive.ts'
import type { Form8582Result, PassiveActivity } from './passive.ts'
import type { K1Totals } from './k1.ts'
import type { Form4797Result } from './sales.ts'
import type { QbiResult } from './qbi.ts'
import type { FilingStatus } from './rules2025.ts'

export type IssueLevel = 'error' | 'warning' | 'info'
export interface Issue {
  level: IssueLevel
  step: 'about' | 'income' | 'deductions' | 'credits' | 'review'
  message: string
}

export interface HomeOfficeResult {
  method: HomeOffice['method']; businessPct: number
  /** Form 8829 lines by number; two-column lines use '10b', '16b' and so on (column (b), indirect). */
  lines: Record<string, number>
  /** Line 8 */ line8: number
  /** Line 14: mortgage interest and taxes on lines 10–11 (only when itemizing). */ line14: number
  /** Line 27: allowable operating expenses. */ line25: number
  /** Line 33 */ depreciationAllowed: number
  /** Lines 43 + 44 */ carryover: number
  /** Line 36 / Schedule C line 30 */ deduction: number
  /** Home first used for business in 2025: its depreciation goes on Form 4562 line 19j. */ firstUsedThisYear: boolean
  firstUsedMonth: number
}
export interface ScheduleCResult {
  id: string; name: string; owner: Owner; grossIncome: number
  /** Line 13: depreciation and section 179 (Form 4562 line 22, less any home depreciation on line 19j). */ depreciation: number
  section179: number
  assets: AssetResult[]
  /** Line 28, total expenses before business use of home. */ totalExpenses: number
  /** Line 29. */ tentativeProfit: number
  homeOffice: HomeOfficeResult
  /** Line 31. */ netProfit: number
}
export interface Form5329Result {
  owner: Owner
  /** Part I */ line1: number; line2: number; exceptionCode: string; line3: number; line4: number
  /** Part VII */ line42: number; line43: number; line44: number; line45: number; line46: number; line47: number; line48: number; line49: number
  /** False when only the full 10% tax is owed: it then goes straight on Schedule 2 line 8. */ required: boolean
}
export interface RentalResult { id: string; address: string; income: number; expenses: number; net: number; personalUseWarning: boolean; assetDepreciation: number; assets: AssetResult[]; /** Line 22: deductible loss (positive). */ line22: number }
export interface ScheduleSEResult { owner: Owner; netEarnings: number; socialSecurityTax: number; medicareTax: number; total: number }

export interface TaxReturnResult {
  /** Form 1040 lines, keyed by line number. */
  f1040: Record<string, number>
  schedule1: { businessIncome: number; otherGains: number; rentalIncome: number; unemployment: number; hsaTaxable: number; otherIncome: number; additionalIncome: number; adjustments: Record<string, number>; totalAdjustments: number }
  schedule1A: {
    magi: number
    tipsCapped: number; tipOtExcess: number; tipOtReduction: number; tips: number
    overtimeCapped: number; overtime: number
    carCapped: number; carExcess: number; carReduction: number; carLoanInterest: number
    seniorExcess: number; seniorEach: number; seniorTaxpayer: number; seniorSpouse: number; senior: number
    total: number
  }
  scheduleA: { medical: number; taxes: number; saltBeforeCap: number; saltCap: number; interest: number; charity: number; other: number; total: number }
  scheduleB: { interest: number; ordinaryDividends: number; required: boolean }
  scheduleC: ScheduleCResult[]
  scheduleD: { shortTerm: number; longTerm: number; net: number; allowedLoss: number; carryoverShort: number; carryoverLong: number; preferentialGain: number }
  scheduleSE: ScheduleSEResult[]
  /** total = Part II (line 21, Form 1040 line 23); amt is Part I (line 1040 line 17). */
  schedule2: { amt: number; selfEmploymentTax: number; additionalMedicareTax: number; netInvestmentIncomeTax: number; earlyDistributionTax: number; hsaExcessTax: number; hsaAdditionalTax: number; total: number }
  scheduleE: { properties: RentalResult[]; gross: number; priorCarryover: number; magi: number; allowance: number; allowedLoss: number; disallowed: number; net: number; line24: number; line25: number }
  form8582: Form8582Result
  form5329: Form5329Result[]
  form4797: Form4797Result
  k1: K1Totals
  /** Schedule D line 19: unrecaptured section 1250 gain. */ scheduleD19: number
  section179: Section179Result
  form4562: Form4562Result[]
  form8889: { owner: Owner; coverage: string; months: number; line2: number; line3: number; line7: number; line8: number; line9: number; line12: number; line13: number; line14: number; line15: number; line16: number; line17b: number; excess: number }[]
  form6251: Form6251Result
  schedule3: { dependentCare: number; education: number; saversCredit: number; excessSocialSecurity: number }
  form2441: {
    qualifyingPersons: number; expensesUsed: number; rate: number; credit: number
    line3: number; line4: number; line5: number
    partIII: { line12: number; line16: number; line17: number; line18: number; line19: number; line20: number; line21: number; line25: number; line26: number; line27: number; line28: number; line29: number; line30: number; line31: number } | null
  }
  form8880: {
    people: { owner: Owner; ira: number; deferrals: number; line3: number; distributions: number; line5: number; line6: number; eligible: boolean }[]
    line7: number; rate: number; tentative: number; limit: number; credit: number
  }
  form2210: PenaltyResult
  form8863Detail: { phaseoutFraction: number; aotcTentative: number; llcTentative: number; llcExpenses: number }
  form8863: { aotc: number; aotcRefundable: number; llc: number; nonrefundableAllowed: number }
  eic: { qualifyingChildren: number; earnedIncome: number; investmentIncome: number; credit: number; notEligibleBecause: string[] }
  schedule8812: { qualifyingChildren: number; otherDependents: number; creditBeforePhaseout: number; phaseoutReduction: number; nonrefundable: number; refundable: number }
  qbi: QbiResult
  deduction: { standard: number; itemized: number; used: 'standard' | 'itemized' }
  summary: {
    totalIncome: number
    agi: number
    taxableIncome: number
    totalTax: number
    totalPayments: number
    refund: number
    amountOwed: number
    effectiveRate: number
    marginalRate: number
  }
  issues: Issue[]
}

const r = (n: number): number => Math.round(n)
const is65 = (p: Person): boolean => p.age >= 65 || p.age65OrOlder
const pos = (n: number): number => Math.max(0, n)
const sum = (values: readonly number[]): number => values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
const isJoint = (fs: FilingStatus): boolean => fs === 'mfj'
/** Reduction "for each $1,000 or fraction thereof" of excess. */
const stepPhaseout = (excess: number, perThousand: number): number => (excess > 0 ? Math.ceil(excess / 1000) * perThousand : 0)

/** Exact tax from the rate schedule (Tax Computation Worksheet). */
export function taxFromSchedule(taxableIncome: number, fs: FilingStatus): number {
  const brackets = R.BRACKETS[fs]
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const [lower, rate] = brackets[i]
    const upper = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity
    if (taxableIncome <= lower) break
    tax += (Math.min(taxableIncome, upper) - lower) * rate
  }
  return tax
}

/**
 * Tax as the IRS Tax Table computes it for taxable income under $100,000
 * (tax on the midpoint of the $5/$10/$25/$50 row), and the Tax Computation Worksheet above that.
 */
export function regularTax(taxableIncome: number, fs: FilingStatus): number {
  const ti = pos(taxableIncome)
  if (ti <= 0) return 0
  if (ti >= 100000) return r(taxFromSchedule(ti, fs))
  let mid: number
  if (ti < 5) mid = 2.5
  else if (ti < 15) mid = 10
  else if (ti < 25) mid = 20
  else if (ti < 3000) mid = Math.floor(ti / 25) * 25 + 12.5
  else mid = Math.floor(ti / 50) * 50 + 25
  return r(taxFromSchedule(mid, fs))
}

/** Qualified Dividends and Capital Gain Tax Worksheet (Form 1040 instructions, line 16). */
export function qualifiedDividendsTax(taxableIncome: number, qualifiedDividends: number, capitalGain: number, fs: FilingStatus): number {
  const l1 = pos(taxableIncome)
  const l4 = pos(qualifiedDividends) + pos(capitalGain)
  const l5 = pos(l1 - l4)
  const l7 = Math.min(l1, R.CAPITAL_GAIN_ZERO_TOP[fs])
  const l8 = Math.min(l5, l7)
  const l9 = l7 - l8
  const l10 = Math.min(l1, l4)
  const l12 = l10 - l9
  const l14 = Math.min(l1, R.CAPITAL_GAIN_FIFTEEN_TOP[fs])
  const l16 = pos(l14 - (l5 + l9))
  const l17 = Math.min(l12, l16)
  const l18 = l17 * 0.15
  const l20 = l10 - (l9 + l17)
  const l21 = l20 * 0.20
  const l22 = regularTax(l5, fs)
  const l23 = l18 + l21 + l22
  return r(Math.min(l23, regularTax(l1, fs)))
}

/**
 * Schedule D Tax Worksheet (2025 Instructions for Schedule D), used instead of the Qualified Dividends
 * and Capital Gain Tax Worksheet when there is unrecaptured section 1250 gain (Schedule D line 19).
 * No Form 4952 and no 28% rate gain here, so lines 3, 4 and Schedule D line 18 are zero.
 */
export function scheduleDTaxWorksheet(taxableIncome: number, qualifiedDividends: number, line15: number, line16: number, line19: number, fs: FilingStatus): number {
  const l1 = pos(taxableIncome)
  const l2 = pos(qualifiedDividends)
  const l6 = l2
  const l7 = pos(Math.min(line15, line16))
  const l9 = l7
  const l10 = l6 + l9
  const l11 = pos(line19)
  const l12 = Math.min(l9, l11)
  const l13 = l10 - l12
  const l14 = pos(l1 - l13)
  const l15 = R.CAPITAL_GAIN_ZERO_TOP[fs]
  const l16 = Math.min(l1, l15)
  const l17 = Math.min(l14, l16)
  const l18 = pos(l1 - l10)
  const top24 = (R.BRACKETS[fs].find(([, rate]) => rate === 0.32) ?? [l1])[0]
  const l19 = Math.min(l1, top24)
  const l20 = Math.min(l14, l19)
  const l21 = Math.max(l18, l20)
  const l22 = l16 - l17
  const l23 = Math.min(l1, l13)
  const l24 = l22
  const l25 = pos(l23 - l24)
  const l26 = R.CAPITAL_GAIN_FIFTEEN_TOP[fs]
  const l27 = Math.min(l1, l26)
  const l28 = l21 + l22
  const l29 = pos(l27 - l28)
  const l30 = Math.min(l25, l29)
  const l31 = l30 * 0.15
  const l32 = l24 + l30
  const l33 = pos(l23 - l32)
  const l34 = l33 * 0.20
  const l35 = Math.min(l9, pos(line19))
  const l36 = l10 + l21
  const l38 = pos(l36 - l1)
  const l39 = pos(l35 - l38)
  const l40 = l39 * 0.25
  const l41 = l21 + l22 + l30 + l33 + l39
  const l42 = pos(l1 - l41)
  const l43 = l42 * 0.28
  const l44 = regularTax(l21, fs)
  const l45 = l31 + l34 + l40 + l43 + l44
  return r(Math.min(l45, regularTax(l1, fs)))
}

/**
 * Business use of home. Simplified method: $5 × up to 300 sq ft, limited to tentative profit.
 * Regular method follows Form 8829 Part II: mortgage interest and real estate taxes (business share) are
 * always deductible; operating expenses, then depreciation, only up to the remaining profit; the rest carries over.
 */
export function homeOfficeDeduction(h: HomeOffice, tentativeProfit: number, itemizing = false): HomeOfficeResult {
  const none: HomeOfficeResult = { method: h.method, businessPct: 0, lines: {}, line8: r(tentativeProfit), line14: 0, line25: 0, depreciationAllowed: 0, carryover: 0, deduction: 0, firstUsedThisYear: false, firstUsedMonth: 0 }
  if (h.method === 'simplified') {
    const sqft = Math.min(pos(h.officeSqFt), R.HOME_OFFICE_SIMPLIFIED_MAX_SQFT)
    return { ...none, deduction: r(Math.min(sqft * R.HOME_OFFICE_SIMPLIFIED_RATE, pos(tentativeProfit))) }
  }
  if (h.method === 'amount') return { ...none, deduction: r(pos(h.amount)) }
  if (h.method !== 'regular' || h.homeSqFt <= 0 || h.officeSqFt <= 0) return none
  const pct = Math.min(1, h.officeSqFt / h.homeSqFt)
  const L: Record<string, number> = {}
  L['1'] = r(h.officeSqFt); L['2'] = r(h.homeSqFt); L['3'] = pct; L['7'] = pct
  L['8'] = r(tentativeProfit)
  // Itemizers deduct the business part of mortgage interest and taxes on lines 10–11 (always allowed);
  // with the standard deduction they move to lines 16–17 and are limited by the profit.
  L['10b'] = itemizing ? r(pos(h.mortgageInterest)) : 0
  L['11b'] = itemizing ? r(pos(h.realEstateTaxes)) : 0
  L['12b'] = L['10b'] + L['11b']
  L['13'] = r(L['12b'] * pct)
  L['14'] = L['13']
  L['15'] = pos(L['8'] - L['14'])
  L['16b'] = itemizing ? 0 : r(pos(h.mortgageInterest))
  L['17b'] = itemizing ? 0 : r(pos(h.realEstateTaxes))
  L['18b'] = r(pos(h.insurance)); L['19b'] = r(pos(h.rent)); L['20b'] = r(pos(h.repairs)); L['21b'] = r(pos(h.utilities)); L['22b'] = r(pos(h.other))
  L['23b'] = L['16b'] + L['17b'] + L['18b'] + L['19b'] + L['20b'] + L['21b'] + L['22b']
  L['24'] = r(L['23b'] * pct)
  L['25'] = r(pos(h.priorOperatingCarryover ?? 0))
  L['26'] = L['24'] + L['25']
  L['27'] = Math.min(L['15'], L['26'])
  L['28'] = L['15'] - L['27']
  // Part III — depreciation of the home (39-year, mid-month).
  const first = parseDate(h.firstUsed ?? '')
  const firstUsedThisYear = !!first && first.getUTCFullYear() === 2025
  const firstUsedMonth = first ? first.getUTCMonth() + 1 : 0
  if ((h.homeBasis ?? 0) > 0) {
    L['37'] = r(h.homeBasis); L['38'] = r(pos(h.landValue ?? 0)); L['39'] = pos(L['37'] - L['38'])
    L['40'] = r(L['39'] * pct)
    L['41'] = first && first.getUTCFullYear() > 2025 ? 0 : firstUsedThisYear ? NONRES_FIRST_YEAR[firstUsedMonth - 1] : 2.564
    L['42'] = r(L['40'] * L['41'] / 100)
  } else {
    L['42'] = r(pos(h.depreciation))
  }
  L['30'] = L['42']
  L['31'] = r(pos(h.priorExcessCarryover ?? 0))
  L['32'] = L['30'] + L['31']
  L['33'] = Math.min(L['28'], L['32'])
  L['34'] = L['14'] + L['27'] + L['33']
  L['36'] = L['34']
  L['43'] = pos(L['26'] - L['27'])
  L['44'] = pos(L['32'] - L['33'])
  return {
    method: h.method, businessPct: pct, lines: L, line8: L['8'], line14: L['14'], line25: L['27'], depreciationAllowed: L['33'],
    carryover: L['43'] + L['44'], deduction: L['36'], firstUsedThisYear, firstUsedMonth
  }
}

function scheduleC(b: ScheduleCBusiness, assets: AssetResult[], section179Allowed: number, itemizing: boolean): ScheduleCResult {
  const grossIncome = b.grossReceipts - b.returnsAndAllowances - b.costOfGoodsSold + b.otherIncome
  const depreciation = r(sum(assets.map((a) => a.depreciation)) + section179Allowed)
  const totalExpenses = sum(Object.entries(b.expenses).filter(([k]) => k !== 'homeOffice').map(([, v]) => v)) + depreciation
  const tentativeProfit = r(grossIncome - totalExpenses)
  const homeOffice = homeOfficeDeduction(b.homeOffice, tentativeProfit, itemizing)
  return {
    id: b.id, name: b.name || 'Business', owner: b.owner, grossIncome: r(grossIncome), depreciation, section179: section179Allowed, assets,
    totalExpenses: r(totalExpenses), tentativeProfit, homeOffice, netProfit: tentativeProfit - homeOffice.deduction
  }
}

/** Child Tax Credit child: under 17, SSN, lived with you more than half the year, child-type relationship. */
export const ctcChild = (d: Dependent): boolean => d.age < 17 && d.hasSsn && d.childRelationship && d.monthsLivedWithYou > 6
/** EIC qualifying child: relationship, residency, and under 19 / under 24 student / any age disabled. */
export const eicChild = (d: Dependent): boolean =>
  d.childRelationship && d.hasSsn && d.monthsLivedWithYou > 6 && (d.age < 19 || (d.student && d.age < 24) || d.disabled)
/** Form 2441 qualifying person: dependent under 13, or disabled, who lived with you more than half the year. */
export const careQualifyingPerson = (d: Dependent): boolean => d.monthsLivedWithYou > 6 && (d.age <= R.CARE_QUALIFYING_CHILD_MAX_AGE || d.disabled)

/** EIC from the IRS table: credit on the midpoint of the $50 row containing `amount`. */
export function eicFromTable(amount: number, children: number, phaseoutStart: number): number {
  if (amount <= 0) return 0
  const mid = Math.floor(amount / 50) * 50 + 25
  const k = Math.min(3, Math.max(0, children))
  const credit = Math.min(mid * R.EIC_CREDIT_RATE[k], R.EIC_MAX_CREDIT[k]) - pos(mid - phaseoutStart) * R.EIC_PHASEOUT_RATE[k]
  return r(pos(credit))
}

export interface Form6251Result {
  line1a: number; line1b: number; line2a: number; line2g: number; line2i: number; line3: number; line4: number
  line5: number; line6: number; line7: number; line9: number; line10: number; amt: number
  /** Part III lines 12–40, present when qualified dividends or capital gains are involved. */
  part3: Record<string, number> | null
}

/** Form 6251 (2025) Parts I–III for the adjustments this app knows about. */
export function alternativeMinimumTax(a: {
  fs: FilingStatus; line11b: number; line14: number; seniorDeduction: number; itemized: boolean; saltDeducted: number
  standardDeduction: number; amtInput: TaxReturnInput['amt']; qualifiedDividends: number; preferentialGain: number
  taxableIncome: number; regularTax: number
}): Form6251Result {
  const line1a = r(a.line14 - a.seniorDeduction)
  const line1b = r(a.line11b - line1a)
  const line2a = r(a.itemized ? a.saltDeducted : a.standardDeduction)
  const line2g = r(pos(a.amtInput.privateActivityBondInterest))
  const line2i = r(pos(a.amtInput.isoBargainElement))
  const line3 = r(a.amtInput.otherAdjustments)
  const line4 = line1b + line2a + line2g + line2i + line3
  const line5 = r(pos(R.AMT_EXEMPTION[a.fs] - pos(line4 - R.AMT_PHASEOUT_START[a.fs]) * R.AMT_PHASEOUT_RATE))
  const line6 = pos(line4 - line5)
  const t28 = R.AMT_28_THRESHOLD[a.fs]
  const flat = (x: number): number => r(x <= t28 ? x * R.AMT_RATE_LOW : x * R.AMT_RATE_HIGH - t28 * (R.AMT_RATE_HIGH - R.AMT_RATE_LOW))
  let line7 = flat(line6)
  let part3: Record<string, number> | null = null
  const qdcg4 = r(pos(a.qualifiedDividends) + pos(a.preferentialGain))
  if (qdcg4 > 0 && line6 > 0) {
    const qdcg5 = pos(r(a.taxableIncome) - qdcg4)
    const l12 = line6
    const l13 = qdcg4
    const l15 = l13
    const l16 = Math.min(l12, l15)
    const l17 = l12 - l16
    const l18 = flat(l17)
    const l19 = R.CAPITAL_GAIN_ZERO_TOP[a.fs]
    const l20 = qdcg5
    const l21 = pos(l19 - l20)
    const l22 = Math.min(l12, l13)
    const l23 = Math.min(l21, l22)
    const l24 = l22 - l23
    const l25 = R.CAPITAL_GAIN_FIFTEEN_TOP[a.fs]
    const l26 = l21
    const l27 = qdcg5
    const l28 = l26 + l27
    const l29 = pos(l25 - l28)
    const l30 = Math.min(l24, l29)
    const l31 = r(l30 * 0.15)
    const l32 = l23 + l30
    const l33 = l22 - l32
    const l34 = r(l33 * 0.20)
    const l38 = l18 + l31 + l34
    const l39 = flat(l12)
    const l40 = Math.min(l38, l39)
    part3 = { l12, l13, l15, l16, l17, l18, l19, l20, l21, l22, l23, l24, l25, l26, l27, l28, l29, l30, l31, l32, l33, l34, l38, l39, l40 }
    line7 = l40
  }
  const line9 = line7
  const line10 = r(a.regularTax)
  return { line1a, line1b, line2a, line2g, line2i, line3, line4, line5, line6, line7, line9, line10, amt: pos(line9 - line10), part3 }
}

export interface PenaltyResult {
  applies: boolean
  /** Why no penalty is due, when applies is false. */
  reason: string
  line4: number; line5: number; line6: number; line7: number; line8: number | null; line9: number
  installments: { due: string; required: number; paid: number; underpaid: number }[]
  penalty: number
  priorYearMissing: boolean
}

const dayNumber = (iso: string): number => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000)

/**
 * Form 2210 Part I and the regular-method Penalty Worksheet. Withholding is treated as paid in four
 * equal parts on the installment due dates; each estimate as paid on its due date. Payments go to the
 * oldest unpaid installment first. Any underpayment still open is charged through April 15, 2026.
 */
export function estimatedTaxPenalty(a: {
  fs: FilingStatus; currentTax: number; withholding: number
  estimates: readonly number[]; prior: TaxReturnInput['priorYear']
}): PenaltyResult {
  const line4 = r(a.currentTax)
  const line5 = r(line4 * R.PENALTY_CURRENT_YEAR_SHARE)
  const line6 = r(a.withholding)
  const line7 = line4 - line6
  const enteredPrior = a.prior.tax !== null && a.prior.tax > 0 ? a.prior.tax : null
  const base = { line4, line5, line6, line7, installments: [], penalty: 0, priorYearMissing: enteredPrior === null && !a.prior.noLiability }
  const priorTax = a.prior.noLiability ? 0 : enteredPrior
  const line8 = priorTax === null ? null : r(priorTax * (a.prior.agi > R.PENALTY_HIGH_AGI[a.fs] ? R.PENALTY_HIGH_AGI_SHARE : 1))
  const line9 = line8 === null ? line5 : Math.min(line5, line8)
  if (line4 < R.PENALTY_MIN_BALANCE || line7 < R.PENALTY_MIN_BALANCE) return { ...base, applies: false, reason: 'Tax after withholding is under $1,000.', line8, line9 }
  if (a.prior.noLiability) return { ...base, applies: false, reason: 'You had no tax liability for 2024.', line8, line9 }
  if (line6 >= line9) return { ...base, applies: false, reason: 'Your withholding covers the required annual payment.', line8, line9 }
  const required = line9 / 4
  const open: { amount: number; due: number }[] = []
  const installments: PenaltyResult['installments'] = []
  let carry = 0
  let penalty = 0
  const charge = (amount: number, from: number, to: number): void => { penalty += amount * Math.max(0, to - from) / 365 * R.PENALTY_RATE }
  R.INSTALLMENT_DUE_DATES.forEach((due, i) => {
    const day = dayNumber(due)
    let available = line6 / 4 + pos(a.estimates[i] ?? 0) + carry
    const paidThisPeriod = line6 / 4 + pos(a.estimates[i] ?? 0)
    while (open.length && available > 0) {
      const u = open[0]
      const use = Math.min(u.amount, available)
      charge(use, u.due, day)
      u.amount -= use
      available -= use
      if (u.amount <= 0.004) open.shift()
    }
    const short = Math.max(0, required - available)
    carry = Math.max(0, available - required)
    if (short > 0) open.push({ amount: short, due: day })
    installments.push({ due, required: r(required), paid: r(paidThisPeriod), underpaid: r(short) })
  })
  const end = dayNumber(R.RETURN_DUE_DATE)
  for (const u of open) charge(u.amount, u.due, end)
  const rounded = r(penalty)
  return { ...base, applies: rounded > 0, reason: rounded > 0 ? '' : 'Your payments were on time and large enough.', line8, line9, installments, penalty: rounded }
}

export function computeReturn(input: TaxReturnInput): TaxReturnResult {
  // Form 8829 depends on whether you itemize: mortgage interest and real estate taxes go on lines 10–11
  // only for itemizers. Figure it with the standard deduction first, then again if the return itemizes.
  const first = computeCore(input, false)
  const needsSecondPass = first.deduction.used === 'itemized' &&
    input.businesses.some((b) => b.homeOffice.method === 'regular' && b.homeOffice.mortgageInterest + b.homeOffice.realEstateTaxes > 0)
  if (!needsSecondPass) return first
  const second = computeCore(input, true)
  return second.deduction.used === 'itemized' ? second : first
}

function computeCore(input: TaxReturnInput, homeItemizing: boolean): TaxReturnResult {
  const fs = input.filingStatus
  const joint = isJoint(fs)
  const issues: Issue[] = []
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const ownedBy = (o: Owner): boolean => owners.includes(o)

  // ── Validation ────────────────────────────────────────────────────────────
  if (!input.taxpayer.firstName.trim() || !input.taxpayer.lastName.trim()) issues.push({ level: 'warning', step: 'about', message: 'Enter your first and last name.' })
  if (joint && (!input.spouse.firstName.trim() || !input.spouse.lastName.trim())) issues.push({ level: 'warning', step: 'about', message: 'Enter your spouse’s name for a joint return.' })
  const ssnOk = (v: string): boolean => /^\d{9}$/.test(v.replace(/\D/g, ''))
  if (!ssnOk(input.taxpayer.ssn)) issues.push({ level: 'warning', step: 'about', message: 'Enter your 9-digit Social Security number. The IRS forms need it.' })
  if (joint && !ssnOk(input.spouse.ssn)) issues.push({ level: 'warning', step: 'about', message: 'Enter your spouse’s Social Security number.' })
  if (input.dependents.some((d) => !ssnOk(d.ssn))) issues.push({ level: 'warning', step: 'about', message: 'Enter a Social Security number for each dependent.' })
  for (const [who, p] of [['Your', input.taxpayer], ['Your spouse’s', input.spouse]] as const) {
    const pin = p.ipPin.replace(/\D/g, '')
    if (pin && pin.length !== 6 && (who === 'Your' || joint)) issues.push({ level: 'warning', step: 'about', message: `${who} Identity Protection PIN must be 6 digits.` })
  }
  if (input.designee.enabled && (!input.designee.name.trim() || input.designee.pin.replace(/\D/g, '').length !== 5)) issues.push({ level: 'warning', step: 'review', message: 'A third party designee needs a name and a 5-digit PIN of their choice.' })
  if (!input.contact.street.trim() || !input.contact.city.trim() || !input.contact.zip.trim()) issues.push({ level: 'warning', step: 'about', message: 'Enter your home address for the IRS forms.' })
  if (input.digitalAssets === null) issues.push({ level: 'warning', step: 'income', message: 'Answer the digital assets question. Form 1040 requires a Yes or No.' })
  if (fs === 'hoh' && input.dependents.length === 0) issues.push({ level: 'warning', step: 'about', message: 'Head of household usually requires a qualifying person. Add a dependent or check your filing status.' })
  if (fs === 'qss' && input.dependents.length === 0) issues.push({ level: 'warning', step: 'about', message: 'Qualifying surviving spouse status requires a dependent child.' })
  input.w2s.forEach((w, i) => {
    if (!ownedBy(w.owner)) issues.push({ level: 'error', step: 'income', message: `W-2 #${i + 1} belongs to your spouse, but this is not a joint return. It is excluded.` })
    if (!w.employer.trim()) issues.push({ level: 'warning', step: 'income', message: `W-2 #${i + 1}: enter the employer name.` })
    if (w.federalWithholding > w.wages && w.wages > 0) issues.push({ level: 'warning', step: 'income', message: `W-2 #${i + 1}: federal withholding (box 2) is larger than wages (box 1). Double-check the form.` })
  })
  input.dividends.forEach((d, i) => {
    if (d.qualifiedDividends > d.ordinaryDividends) issues.push({ level: 'error', step: 'income', message: `1099-DIV #${i + 1}: qualified dividends (1b) cannot exceed ordinary dividends (1a). Qualified amount was capped.` })
  })
  input.businesses.forEach((b, i) => {
    const who = b.name.trim() || `Business ${i + 1}`
    if (!/^\d{6}$/.test(b.businessCode)) issues.push({ level: 'warning', step: 'income', message: `${who}: enter the 6-digit principal business code from the Schedule C instructions (box B).` })
    if (b.required1099s === null) issues.push({ level: 'warning', step: 'income', message: `${who}: answer whether you made payments that require Forms 1099 (Schedule C, line I).` })
    const depreciatesVehicle = (b.assets ?? []).some((a) => a.listed === 'auto' || a.listed === 'heavy')
    if (depreciatesVehicle && b.expenses.carAndTruck > 0) issues.push({ level: 'info', step: 'income', message: `${who}: you depreciate a vehicle, so car and truck expenses must be actual costs (gas, insurance, repairs), not the standard mileage rate.` })
    if (!depreciatesVehicle && b.expenses.carAndTruck > 0 && (!b.vehicle.placedInService.trim() || b.vehicle.businessMiles <= 0)) issues.push({ level: 'warning', step: 'income', message: `${who}: car and truck expenses need the vehicle details (Schedule C, Part IV).` })
    if (b.costOfGoodsSold > 0) issues.push({ level: 'info', step: 'income', message: `${who}: cost of goods sold is printed on Schedule C line 4 and 42. Fill in the inventory lines 33–41 on the printed form by hand.` })
    if (b.homeOffice.method === 'amount' && b.homeOffice.amount > 0) issues.push({ level: 'info', step: 'income', message: `${who}: you entered the home office deduction directly. Attach your own Form 8829 or simplified-method worksheet, or switch to a method the app figures.` })
    if (b.homeOffice.method === 'regular' && (b.homeOffice.mortgageInterest > 0 || b.homeOffice.realEstateTaxes > 0) && input.deductionChoice !== 'standard') issues.push({ level: 'info', step: 'deductions', message: `${who}: if you itemize, enter only the personal part of mortgage interest and real estate taxes on Schedule A; the business part is on Form 8829.` })
    if (b.homeOffice.method === 'simplified' && b.homeOffice.officeSqFt > R.HOME_OFFICE_SIMPLIFIED_MAX_SQFT) issues.push({ level: 'info', step: 'income', message: `${who}: the simplified method counts at most ${R.HOME_OFFICE_SIMPLIFIED_MAX_SQFT} square feet.` })
    if (!b.materiallyParticipated) issues.push({ level: 'warning', step: 'income', message: `${who}: if you did not materially participate, passive activity loss limits (Form 8582) may apply. They are not figured here.` })
  })
  input.businesses.forEach((b, i) => { if (!ownedBy(b.owner)) issues.push({ level: 'error', step: 'income', message: `Business #${i + 1} belongs to your spouse, but this is not a joint return. It is excluded.` }) })

  const w2s = input.w2s.filter((w) => ownedBy(w.owner))
  const businesses = input.businesses.filter((b) => ownedBy(b.owner))
  const medicareWages = (w: (typeof w2s)[number]): number => (w.medicareWages > 0 ? w.medicareWages : w.wages)
  const ssWages = (w: (typeof w2s)[number]): number => (w.socialSecurityWages > 0 ? w.socialSecurityWages : w.wages)

  // ── Income ────────────────────────────────────────────────────────────────
  const line1a = r(sum(w2s.map((w) => w.wages)))
  const line2a = r(sum(input.interest.map((i) => i.taxExemptInterest)))
  const k1In = (input.k1s ?? []).filter((k) => ownedBy(k.owner))
  ;(input.k1s ?? []).forEach((k, i) => { if (!ownedBy(k.owner)) issues.push({ level: 'error', step: 'income', message: `K-1 #${i + 1} belongs to your spouse, but this is not a joint return. It is excluded.` }) })
  const k1Portfolio = k1Totals(k1In)
  const line2b = r(sum(input.interest.map((i) => i.interest))) + k1Portfolio.interest
  const line3b = r(sum(input.dividends.map((d) => d.ordinaryDividends))) + k1Portfolio.ordinaryDividends
  const line3a = r(sum(input.dividends.map((d) => Math.min(d.qualifiedDividends, d.ordinaryDividends)))) + k1Portfolio.qualifiedDividends

  // Schedule D
  const stTx = sum(input.capitalTransactions.filter((t) => t.term === 'short').map(gainOf))
  const ltTx = sum(input.capitalTransactions.filter((t) => t.term === 'long').map(gainOf))
  input.capitalTransactions.map(withDefaults).forEach((t, i) => {
    const label = t.description.trim() || `Sale ${i + 1}`
    const byDates = holdingTermFromDates(t.dateAcquired, t.dateSold)
    if (byDates && byDates !== t.term) issues.push({ level: 'warning', step: 'income', message: `${label}: the dates show a ${byDates}-term holding period, but it is marked ${t.term}-term.` })
    const sold = parseDate(t.dateSold)
    if (sold && sold.getUTCFullYear() !== 2025) issues.push({ level: 'warning', step: 'income', message: `${label}: the sale date is not in 2025.` })
    if ((t.adjustment || 0) !== 0 && !t.adjustmentCode.trim()) issues.push({ level: 'warning', step: 'income', message: `${label}: enter the Form 8949 code for the adjustment (for example W for a wash sale).` })
    if (!isAggregated(t) && (!t.dateSold.trim() || !t.dateAcquired.trim())) issues.push({ level: 'warning', step: 'income', message: `${label}: Form 8949 needs the dates acquired and sold (VARIOUS or INHERITED are allowed for the acquired date).` })
  })
  const capGainDistributions = sum(input.dividends.map((d) => d.capitalGainDistributions))
  const shortTerm = r(stTx - input.capitalLossCarryover.shortTerm + k1Portfolio.shortTermGain)
  const f4797 = form4797(input.propertySales ?? [], input.prior1231Losses ?? 0, k1Portfolio.section1231)
  f4797.issues.forEach((m) => issues.push({ level: 'warning', step: 'income', message: m }))
  if (f4797.unrecaptured1250 > 0) issues.push({ level: 'info', step: 'income', message: `Unrecaptured section 1250 gain of $${f4797.unrecaptured1250.toLocaleString()} (depreciation on buildings) is taxed at up to 25% using the Schedule D Tax Worksheet.` })
  if (f4797.line12 > 0) issues.push({ level: 'info', step: 'income', message: `$${f4797.line12.toLocaleString()} of the section 1231 gain is ordinary income because of 1231 losses in the last five years (Form 4797 line 12).` })
  const longTerm = r(ltTx + capGainDistributions - input.capitalLossCarryover.longTerm + f4797.scheduleDGain + k1Portfolio.longTermGain)
  const netCapital = shortTerm + longTerm
  const lossLimit = R.CAPITAL_LOSS_LIMIT[fs]
  const line7 = netCapital >= 0 ? netCapital : -Math.min(-netCapital, lossLimit)
  let carryoverShort = 0
  let carryoverLong = 0
  if (netCapital < -lossLimit) {
    // Capital Loss Carryover Worksheet (simplified ordering: short-term loss absorbs the allowed amount first)
    const stLoss = pos(-shortTerm) - pos(longTerm)
    const usedByShort = Math.min(pos(stLoss), lossLimit)
    carryoverShort = pos(stLoss - usedByShort)
    const ltLoss = pos(-longTerm) - pos(shortTerm)
    carryoverLong = pos(ltLoss - (lossLimit - usedByShort))
    issues.push({ level: 'info', step: 'income', message: `Your net capital loss exceeds the $${lossLimit.toLocaleString()} limit. About $${(carryoverShort + carryoverLong).toLocaleString()} carries over to 2026.` })
  }
  const preferentialGain = pos(Math.min(longTerm, netCapital))

  // Depreciation (Form 4562) and the section 179 election
  const rentalsOwned = input.rentals.filter((p) => ownedBy(p.owner))
  const midQuarter = midQuarterApplies([...businesses.flatMap((b) => b.assets ?? []), ...rentalsOwned.flatMap((p) => p.assets ?? [])])
  if (midQuarter) issues.push({ level: 'info', step: 'income', message: 'More than 40% of the equipment placed in service in 2025 was placed in service in October–December, so the mid-quarter convention applies to it (Form 4562, column (e) “MQ”).' })
  const bizAssets = new Map(businesses.map((b) => [b.id, (b.assets ?? []).map((a) => assetDepreciation(a, { midQuarter, allow179: true }))]))
  const rentAssets = new Map(rentalsOwned.map((p) => [p.id, (p.assets ?? []).map((a) => assetDepreciation(a, { midQuarter, allow179: false }))]))
  ;[...bizAssets.values(), ...rentAssets.values()].flat().forEach((a) => a.issues.forEach((m) => issues.push({ level: 'warning', step: 'income', message: m })))
  const profitBefore179 = (b: ScheduleCBusiness): number =>
    b.grossReceipts - b.returnsAndAllowances - b.costOfGoodsSold + b.otherIncome -
    sum(Object.entries(b.expenses).filter(([k]) => k !== 'homeOffice').map(([, v]) => v)) - sum((bizAssets.get(b.id) ?? []).map((a) => a.depreciation))
  const electedBy = businesses.map((b) => sum((bizAssets.get(b.id) ?? []).map((a) => a.section179Elected)))
  const s179 = section179({
    costOfProperty: sum([...bizAssets.values()].flat().filter((a) => a.currentYear && isPersonalProperty(a.propertyClass)).map((a) => a.businessBasis)),
    elected: sum(electedBy), carryover: input.section179Carryover ?? 0,
    businessIncome: sum(w2s.map((w) => w.wages)) + sum(businesses.map(profitBefore179)), mfs: fs === 'mfs'
  })
  const electedTotal = sum(electedBy)
  const s179Alloc = businesses.map((_, i) => electedTotal > 0 ? r(s179.line12 * electedBy[i] / electedTotal) : i === 0 ? s179.line12 : 0)
  if (s179Alloc.length) s179Alloc[0] += s179.line12 - sum(s179Alloc)
  if (s179.line13 > 0) issues.push({ level: 'info', step: 'income', message: `Section 179 deduction of $${s179.line13.toLocaleString()} is limited by business income and carries over to 2026 (Form 4562 line 13).` })

  // Schedule C
  const scheduleCResults = businesses.map((b, i) => scheduleC(b, bizAssets.get(b.id) ?? [], s179Alloc[i] ?? 0, homeItemizing))
  const businessIncome = sum(scheduleCResults.map((b) => b.netProfit))

  // Schedule SE
  const scheduleSE: ScheduleSEResult[] = owners.map((owner) => {
    const profit = sum(scheduleCResults.filter((b) => b.owner === owner).map((b) => b.netProfit)) + k1Portfolio.seEarnings[owner]
    const earnings = profit * R.SE_NET_EARNINGS_FACTOR
    if (earnings < R.SE_MINIMUM_NET_EARNINGS) return { owner, netEarnings: 0, socialSecurityTax: 0, medicareTax: 0, total: 0 }
    const wagesForSS = sum(w2s.filter((w) => w.owner === owner).map(ssWages))
    const ssBase = Math.min(earnings, pos(R.SOCIAL_SECURITY_WAGE_BASE - wagesForSS))
    const socialSecurityTax = r(ssBase * R.SOCIAL_SECURITY_RATE_SE)
    const medicareTax = r(earnings * R.MEDICARE_RATE_SE)
    return { owner, netEarnings: r(earnings), socialSecurityTax, medicareTax, total: socialSecurityTax + medicareTax }
  }).filter((s) => s.netEarnings > 0)
  const seTax = sum(scheduleSE.map((s) => s.total))
  const halfSeTax = r(seTax / 2)

  // Earned income per person (wages + net SE earnings less the deductible half of SE tax)
  const earnedOf = (o: Owner): number => {
    const wages = sum(w2s.filter((w) => w.owner === o).map((w) => w.wages))
    const se = scheduleSE.find((x) => x.owner === o)
    return wages + (se ? se.netEarnings - se.total / 2 : 0)
  }
  const earnedIncome = r(sum(owners.map(earnedOf)))

  // Form 2441 Part III — dependent care benefits. Benefits above the exclusion are taxable wages (line 1e).
  const care = input.dependentCare
  const earnedTaxpayer = r(earnedOf('taxpayer'))
  const earnedSpouse = joint ? r(earnedOf('spouse')) : earnedTaxpayer
  const p3 = { line12: 0, line16: 0, line17: 0, line18: 0, line19: 0, line20: 0, line21: 0, line25: 0, line26: 0 }
  if (care.employerBenefits > 0) {
    p3.line12 = r(care.employerBenefits)
    p3.line16 = r(care.expenses)
    p3.line17 = Math.min(p3.line12, p3.line16)
    p3.line18 = earnedTaxpayer
    p3.line19 = earnedSpouse
    p3.line20 = Math.max(0, Math.min(p3.line17, p3.line18, p3.line19))
    p3.line21 = R.CARE_BENEFIT_EXCLUSION_LIMIT[fs]
    p3.line25 = Math.min(p3.line20, p3.line21)
    p3.line26 = pos(p3.line12 - p3.line25)
    if (p3.line26 > 0) issues.push({ level: 'info', step: 'credits', message: `$${p3.line26.toLocaleString()} of your dependent care benefits is taxable and was added to Form 1040 line 1e.` })
  }
  const line1e = p3.line26
  const line1z = line1a + line1e

  // Retirement distributions (1099-R → lines 4a/4b, 5a/5b)
  input.retirement.forEach((d, i) => {
    if (!ownedBy(d.owner)) issues.push({ level: 'error', step: 'income', message: `1099-R #${i + 1} belongs to your spouse, but this is not a joint return. It is excluded.` })
    if (d.taxableAmount > d.grossDistribution && d.grossDistribution > 0) issues.push({ level: 'warning', step: 'income', message: `1099-R #${i + 1}: the taxable amount (box 2a) is larger than the gross distribution (box 1).` })
    const code = d.code.trim().toUpperCase()
    if (code.includes('G')) issues.push({ level: 'info', step: 'income', message: `1099-R #${i + 1} is a direct rollover (code G). It is usually not taxable; box 2a should be $0.` })
    if (code === '') issues.push({ level: 'warning', step: 'income', message: `1099-R #${i + 1}: enter the distribution code from box 7.` })
  })
  const retirement = input.retirement.filter((d) => ownedBy(d.owner))
  const iraForms = retirement.filter((d) => d.ira)
  const pensionForms = retirement.filter((d) => !d.ira)
  const line4a = r(sum(iraForms.map((d) => d.grossDistribution)))
  const line4b = r(sum(iraForms.map((d) => d.taxableAmount)))
  const line5a = r(sum(pensionForms.map((d) => d.grossDistribution)))
  const line5b = r(sum(pensionForms.map((d) => d.taxableAmount)))
  // Form 8889 — Health savings accounts (one per person with coverage)
  const hsaOwners = owners.filter((o) => input.hsa[o].coverage !== 'none')
  const hsaFamilyBoth = joint && input.hsa.taxpayer.coverage === 'family' && input.hsa.spouse.coverage === 'family'
  const hsaResults = hsaOwners.map((o) => {
    const h: HsaAccount = input.hsa[o]
    const p = o === 'spouse' ? input.spouse : input.taxpayer
    const months = Math.min(12, Math.max(0, Math.round(h.monthsCovered || 0)))
    const base = h.coverage === 'family' ? R.HSA_LIMIT_FAMILY : R.HSA_LIMIT_SELF
    let line3 = r(base * months / 12)
    if (hsaFamilyBoth) line3 = r(line3 / 2)
    const line7 = p.age >= R.HSA_CATCH_UP_AGE ? r(R.HSA_CATCH_UP * months / 12) : 0
    const line8 = line3 + line7
    const line9 = r(pos(h.employerContributions))
    const line12 = pos(line8 - line9)
    const line2 = r(pos(h.personalContributions))
    const line13 = Math.min(line2, line12)
    const excess = pos(line2 - line12) + pos(line9 - line8)
    const line14 = r(pos(h.distributions))
    const line16 = pos(line14 - r(pos(h.qualifiedExpenses)))
    const line17b = h.exceptionApplies ? 0 : r(line16 * R.HSA_ADDITIONAL_TAX_RATE)
    return { owner: o, coverage: h.coverage, months, line2, line3, line7, line8, line9, line12, line13, line14, line15: r(pos(h.qualifiedExpenses)), line16, line17b, excess }
  })
  hsaResults.forEach((x) => {
    const p = x.owner === 'spouse' ? input.spouse : input.taxpayer
    const name = p.firstName || (x.owner === 'spouse' ? 'Your spouse' : 'You')
    if (x.excess > 0) issues.push({ level: 'warning', step: 'deductions', message: `${name}: HSA contributions are $${x.excess.toLocaleString()} over the 2025 limit. Withdraw the excess by the filing deadline or a 6% excise tax applies each year (Form 5329).` })
    if (x.line16 > 0) issues.push({ level: 'info', step: 'deductions', message: `${name}: $${x.line16.toLocaleString()} of HSA distributions was not used for medical expenses, so it is taxable${x.line17b ? ` plus a 20% additional tax of $${x.line17b.toLocaleString()}` : ''}.` })
  })
  if (hsaFamilyBoth) issues.push({ level: 'info', step: 'deductions', message: 'Both spouses have family HSA coverage, so the family limit is split equally between you. You may agree to a different split on Form 8889.' })
  if (input.filingStatus !== 'mfj' && input.hsa.spouse.coverage !== 'none') issues.push({ level: 'info', step: 'deductions', message: 'Your spouse’s HSA is ignored on a separate or single return.' })
  const hsaDeduction = sum(hsaResults.map((x) => x.line13))
  const hsaTaxable = sum(hsaResults.map((x) => x.line16))
  const hsaAdditionalTax = sum(hsaResults.map((x) => x.line17b))

  // Form 5329 — Part I (early distributions) and Part VII (excess HSA contributions), one per person
  const form5329: Form5329Result[] = owners.map((o) => {
    const early = retirement.filter((d) => d.owner === o && d.code.trim().toUpperCase().includes('1'))
    const line1 = r(sum(early.map((d) => pos(d.taxableAmount))))
    const line2 = r(sum(early.map((d) => Math.min(pos(d.earlyExceptionAmount ?? 0), pos(d.taxableAmount)))))
    const codes = [...new Set(early.filter((d) => (d.earlyExceptionAmount ?? 0) > 0).map((d) => (d.earlyExceptionCode ?? '').trim()).filter(Boolean))]
    const line3 = pos(line1 - line2)
    const line4 = r(line3 * R.EARLY_DISTRIBUTION_RATE)
    const h: HsaAccount = input.hsa[o]
    const x = hsaResults.find((y) => y.owner === o)
    const line42 = r(pos(h.priorExcess ?? 0))
    const line43 = line42 > 0 && x ? pos(x.line8 - x.line2 - x.line9) : 0
    const line44 = line42 > 0 && x ? x.line16 : 0
    const line45 = line43 + line44
    const line46 = pos(line42 - line45)
    const line47 = x && !h.excessWithdrawn ? x.excess : 0
    const line48 = line46 + line47
    const value = pos(h.yearEndValue ?? 0)
    const line49 = r(Math.min(line48, value > 0 ? value : line48) * R.EXCESS_CONTRIBUTION_RATE)
    return {
      owner: o, line1, line2, exceptionCode: codes.length === 1 ? codes[0].padStart(2, '0') : codes.length > 1 ? '12' : '', line3, line4,
      line42, line43, line44, line45, line46, line47, line48, line49,
      required: line2 > 0 || line48 > 0
    }
  }).filter((f) => f.line1 > 0 || f.line48 > 0)
  const earlyDistributionTax = sum(form5329.map((f) => f.line4))
  const hsaExcessTax = sum(form5329.map((f) => f.line49))
  form5329.forEach((f) => {
    const name = (f.owner === 'spouse' ? input.spouse.firstName : input.taxpayer.firstName) || (f.owner === 'spouse' ? 'Your spouse' : 'You')
    if (f.line4 > 0) issues.push({ level: 'warning', step: 'income', message: `${name}: a 10% additional tax of $${f.line4.toLocaleString()} applies to early retirement distributions (code 1).${f.line2 > 0 ? '' : ' If an exception applies (disability, first home, medical costs and others), enter it on the 1099-R.'}` })
    if (f.line49 > 0) issues.push({ level: 'warning', step: 'deductions', message: `${name}: 6% excise tax of $${f.line49.toLocaleString()} on excess HSA contributions (Form 5329, Part VII).` })
    if (f.line48 > 0 && !(input.hsa[f.owner].yearEndValue > 0)) issues.push({ level: 'info', step: 'deductions', message: `${name}: enter the HSA value on December 31, 2025. The 6% tax applies to the smaller of the excess or that value.` })
  })
  input.retirement.forEach((d, i) => {
    if ((d.earlyExceptionAmount ?? 0) > 0 && !/^\d{1,2}$/.test((d.earlyExceptionCode ?? '').trim())) issues.push({ level: 'warning', step: 'income', message: `1099-R #${i + 1}: choose the Form 5329 exception that applies to the early distribution.` })
  })

  // Schedule E Part I — rental real estate and royalties
  const rentalsIn = input.rentals.filter((p) => ownedBy(p.owner))
  input.rentals.forEach((p, i) => {
    if (!ownedBy(p.owner)) issues.push({ level: 'error', step: 'income', message: `Rental #${i + 1} belongs to your spouse, but this is not a joint return. It is excluded.` })
  })
  const rentalResults: RentalResult[] = rentalsIn.map((p) => {
    const income = r(p.rents + p.royalties)
    const assets = rentAssets.get(p.id) ?? []
    const assetDepreciation = r(sum(assets.map((a) => a.depreciation)))
    const expenses = r(sum(Object.values(p.expenses))) + assetDepreciation
    const personalUseWarning = p.personalUseDays > Math.max(14, 0.1 * p.fairRentalDays)
    return { id: p.id, address: p.address || 'Rental property', income, expenses, net: income - expenses, personalUseWarning, assetDepreciation, assets, line22: 0 }
  })
  rentalResults.filter((x) => x.personalUseWarning).forEach((x) => issues.push({ level: 'warning', step: 'income', message: `${x.address}: personal use was more than 14 days or 10% of rental days, so it counts as a residence. Expenses must be split and limited (Pub. 527); this app does not do that split.` }))
  rentalsIn.filter((p) => p.fairRentalDays > 0 && p.fairRentalDays < 15).forEach((p) => issues.push({ level: 'info', step: 'income', message: `${p.address || 'A property'}: rented fewer than 15 days, so the rent is generally not taxable and expenses are not deductible. Check whether it belongs on Schedule E.` }))
  if (rentalsIn.length && input.rentalForms1099.required === null) issues.push({ level: 'warning', step: 'income', message: 'Answer whether your rentals required you to file Forms 1099 (Schedule E, line A).' })
  const unemployment = r(input.unemployment)
  const otherIncome = r(input.otherIncome)
  // Form 8582 — passive activities: rentals (royalties and self-rentals are not passive) and K-1s
  // in which you did not materially participate.
  const passiveRental = (p: (typeof rentalsIn)[number]): boolean => p.type !== 'royalties' && p.type !== 'selfrental'
  const activities: PassiveActivity[] = [
    ...rentalsIn.filter(passiveRental).map((p) => ({
      id: p.id, name: p.address || 'Rental property', group: (p.activeParticipation ? 'rental' : 'other') as PassiveActivity['group'],
      net: rentalResults.find((x) => x.id === p.id)?.net ?? 0, prior: r(pos(p.priorUnallowed ?? 0)), reportedOn: 'Sch. E, line 22'
    })),
    ...k1In.filter((k) => !k.materialParticipation).map((k) => ({
      id: k.id, name: k.entityName.trim() || 'Schedule K-1', group: (k.rentalActiveParticipation ? 'rental' : 'other') as PassiveActivity['group'],
      net: k1Activity(k), prior: r(pos(k.priorPassiveCarryover)), reportedOn: 'Sch. E, line 28'
    }))
  ]
  // MAGI for the $25,000 allowance: AGI without passive losses, taxable Social Security, IRA,
  // student loan interest, or the deductible half of SE tax.
  const passiveNetAll = sum(activities.map((x) => x.net))
  const nonpassiveK1 = sum(k1In.filter((k) => k.materialParticipation).map((k) => k1Activity(k) + (k.kind === 'partnership' ? pos(k.guaranteedPayments) : 0))) +
    sum(k1In.filter((k) => !k.materialParticipation && k.kind === 'partnership').map((k) => pos(k.guaranteedPayments)))
  const nonpassiveRental = sum(rentalResults.filter((x) => !activities.some((a) => a.id === x.id)).map((x) => x.net))
  const magiPassive = line1z + line2b + line3b + line4b + line5b + line7 + businessIncome + f4797.line18b + nonpassiveK1 + nonpassiveRental + pos(passiveNetAll) +
    unemployment + otherIncome + hsaTaxable - (Math.min(pos(input.adjustments.educatorExpenses), joint ? 600 : 300) + hsaDeduction)
  const f8582 = form8582(activities, fs, magiPassive)
  const passiveBy = new Map(f8582.activities.map((x) => [x.id, x]))
  // Schedule E Part I, line 22: the deductible loss of each property.
  rentalResults.forEach((x) => {
    const a = passiveBy.get(x.id)
    x.line22 = a ? (a.b + a.c > 0 ? a.allowed : 0) : (x.net < 0 ? -x.net : 0)
  })
  const rentalLine24 = sum(rentalResults.map((x) => pos(x.net)))
  const rentalLine25 = sum(rentalResults.map((x) => x.line22))
  const rentalNet = rentalLine24 - rentalLine25
  const rentalDisallowed = sum(rentalResults.map((x) => passiveBy.get(x.id)?.unallowed ?? 0))
  if (f8582.unallowed > 0) issues.push({ level: 'info', step: 'income', message: `$${f8582.unallowed.toLocaleString()} of passive losses is not allowed this year and carries to 2026 (Form 8582).` })
  if (fs === 'mfs' && f8582.line1d < 0) issues.push({ level: 'info', step: 'income', message: 'Married filing separately: the $25,000 rental loss allowance is $0 if you lived with your spouse at any time in 2025 ($12,500 if you lived apart all year — not figured here).' })
  // Schedule E Part II — K-1 income
  const k1 = k1Totals(k1In, new Map([...passiveBy].map(([id, a]) => [id, { allowed: a.allowed, unallowed: a.unallowed }])))
  k1.issues.forEach((m) => issues.push({ level: 'warning', step: 'income', message: m }))
  const scheduleE41 = rentalNet + k1.line32

  // Schedule 1, Part I
  const otherGains = f4797.line18b
  const additionalIncome = r(businessIncome + otherGains + scheduleE41 + unemployment + hsaTaxable + otherIncome)
  const line8 = additionalIncome

  // Schedule 1, Part II (adjustments other than student loan interest)
  const a = input.adjustments
  const educatorCap = joint ? 600 : 300
  const educator = Math.min(pos(a.educatorExpenses), educatorCap)
  if (a.educatorExpenses > educatorCap) issues.push({ level: 'info', step: 'deductions', message: `Educator expenses are limited to $${educatorCap}.` })
  const seHealthLimit = pos(businessIncome - halfSeTax)
  const seHealth = Math.min(pos(a.selfEmployedHealthInsurance), seHealthLimit)
  if (a.selfEmployedHealthInsurance > seHealthLimit) issues.push({ level: 'info', step: 'deductions', message: 'Self-employed health insurance is limited to your net business profit minus half of SE tax.' })
  if (a.selfEmployedHealthInsurance > 0 && businesses.length === 0) issues.push({ level: 'warning', step: 'deductions', message: 'Self-employed health insurance requires self-employment income.' })
  const hsa = hsaDeduction
  const ira = pos(a.iraDeduction)
  const adjustmentsBeforeSli = educator + hsa + halfSeTax + seHealth + ira

  // Social Security Benefits Worksheet (lines 6a/6b)
  const ssForms = input.socialSecurity.filter((x) => ownedBy(x.owner))
  const line6a = r(sum(ssForms.map((x) => x.netBenefits)))
  let line6b = 0
  if (line6a > 0) {
    const half = line6a / 2
    const otherIncomeForSs = line1z + line2b + line3b + line4b + line5b + line7 + line8
    const combined = half + otherIncomeForSs + line2a - adjustmentsBeforeSli
    if (fs === 'mfs') {
      line6b = r(Math.min(pos(combined) * 0.85, line6a * 0.85))
      issues.push({ level: 'info', step: 'income', message: 'Married filing separately: Social Security was figured as if you lived with your spouse in 2025. If you lived apart all year, the $25,000 base applies instead.' })
    } else {
      const overBase = pos(combined - R.SS_BASE_AMOUNT[fs])
      if (overBase > 0) {
        const tier = R.SS_ADJUSTED_BASE[fs] - R.SS_BASE_AMOUNT[fs]
        const l11 = pos(overBase - tier)
        const l13 = Math.min(overBase, tier) / 2
        const l16 = Math.min(half, l13) + l11 * 0.85
        line6b = r(Math.min(l16, line6a * 0.85))
      }
    }
    if (a.iraDeduction > 0) issues.push({ level: 'info', step: 'deductions', message: 'With Social Security benefits and an IRA deduction, check the IRA limit with the Pub. 590-A worksheets.' })
  }

  const line9 = r(line1z + line2b + line3b + line4b + line5b + line6b + line7 + line8)

  // Student loan interest phases out on MAGI (AGI figured without this deduction)
  const magiBeforeSli = line9 - adjustmentsBeforeSli
  let studentLoan = 0
  const sliRange = R.STUDENT_LOAN_PHASEOUT[fs]
  if (a.studentLoanInterest > 0) {
    if (!sliRange) issues.push({ level: 'warning', step: 'deductions', message: 'Student loan interest cannot be deducted when married filing separately.' })
    else {
      const base = Math.min(a.studentLoanInterest, R.STUDENT_LOAN_INTEREST_MAX)
      const fraction = Math.min(1, pos(magiBeforeSli - sliRange[0]) / (sliRange[1] - sliRange[0]))
      studentLoan = r(base * (1 - fraction))
    }
  }
  const adjustments = { educatorExpenses: r(educator), hsaDeduction: r(hsa), deductibleHalfOfSeTax: halfSeTax, selfEmployedHealthInsurance: r(seHealth), iraDeduction: r(ira), studentLoanInterest: studentLoan }
  const line10 = r(sum(Object.values(adjustments)))
  const line11 = r(line9 - line10)
  const agi = line11
  const magi = agi

  // ── Deductions ────────────────────────────────────────────────────────────
  const people = joint ? [input.taxpayer, input.spouse] : [input.taxpayer]
  const boxes = sum(people.map((p) => (is65(p) ? 1 : 0) + (p.blind ? 1 : 0)))
  const addlEach = fs === 'single' || fs === 'hoh' ? R.ADDITIONAL_STD_UNMARRIED : R.ADDITIONAL_STD_MARRIED
  let basicStd = R.STANDARD_DEDUCTION[fs]
  if (input.canBeClaimedAsDependent) {
    const earned = line1a + pos(businessIncome - halfSeTax)
    basicStd = Math.min(basicStd, Math.max(R.DEPENDENT_STD_MIN, earned + R.DEPENDENT_STD_EARNED_ADDON))
  }
  const standard = basicStd + boxes * addlEach

  const it = input.itemized
  const medical = r(pos(it.medical - agi * R.MEDICAL_AGI_FLOOR))
  const saltBeforeCap = r(it.stateLocalIncomeOrSalesTax + it.realEstateTax + it.personalPropertyTax)
  const saltCap = Math.max(R.SALT_FLOOR[fs], R.SALT_CAP[fs] - pos(magi - R.SALT_PHASEDOWN_THRESHOLD[fs]) * R.SALT_PHASEDOWN_RATE)
  const taxes = r(Math.min(saltBeforeCap, saltCap))
  const charity = r(it.charityCash + it.charityNonCash)
  if (it.charityCash > agi * 0.6 && it.charityCash > 0) issues.push({ level: 'warning', step: 'deductions', message: 'Cash gifts above 60% of AGI are limited; the excess carries forward. This return does not apply that limit.' })
  if (it.charityNonCash > 500) issues.push({ level: 'info', step: 'deductions', message: 'Noncash gifts over $500 require Form 8283 with your return.' })
  const itemizedTotal = r(medical + taxes + it.mortgageInterest + charity + it.other)

  let used: 'standard' | 'itemized'
  if (input.deductionChoice === 'standard') used = 'standard'
  else if (input.deductionChoice === 'itemized') used = 'itemized'
  else used = itemizedTotal > standard ? 'itemized' : 'standard'
  if (fs === 'mfs' && input.deductionChoice === 'auto') issues.push({ level: 'info', step: 'deductions', message: 'If your spouse itemizes on a separate return, you must itemize too. Choose “Itemize” in that case.' })
  if (input.deductionChoice !== 'auto' && used === 'itemized' && itemizedTotal < standard) issues.push({ level: 'info', step: 'deductions', message: 'Your itemized deductions are lower than the standard deduction.' })
  const line12 = used === 'itemized' ? itemizedTotal : standard

  // Schedule 1-A
  const s = input.schedule1A
  const marriedNotJoint = fs === 'mfs'
  if (marriedNotJoint && (s.qualifiedTips > 0 || s.qualifiedOvertime > 0)) issues.push({ level: 'warning', step: 'deductions', message: 'Married taxpayers must file jointly to deduct tips or overtime.' })
  // Tips (lines 4–13) and overtime (lines 14–21): reduced $100 per FULL $1,000 of MAGI over the threshold
  const tipOtExcess = marriedNotJoint ? 0 : pos(magi - R.TIPS_OVERTIME_PHASEOUT_START[fs])
  const tipOtReduction = Math.floor(tipOtExcess / 1000) * R.TIPS_OVERTIME_PHASEOUT_PER_1000
  const tipsCapped = marriedNotJoint ? 0 : r(Math.min(pos(s.qualifiedTips), R.TIPS_MAX))
  const overtimeCapped = marriedNotJoint ? 0 : r(Math.min(pos(s.qualifiedOvertime), R.OVERTIME_MAX[fs]))
  const tips = pos(tipsCapped - tipOtReduction)
  const overtime = pos(overtimeCapped - tipOtReduction)
  // Car loan interest (lines 22–30): reduced $200 per $1,000 or fraction of MAGI over the threshold
  const carCapped = r(Math.min(pos(s.carLoanInterest), R.CAR_LOAN_INTEREST_MAX))
  const carExcess = pos(magi - R.CAR_LOAN_PHASEOUT_START[fs])
  const carReduction = stepPhaseout(carExcess, R.CAR_LOAN_PHASEOUT_PER_1000)
  const carLoan = pos(carCapped - carReduction)
  // Seniors (lines 31–37): $6,000 per qualifying person, each reduced by 6% of MAGI over the threshold
  const seniorExcess = pos(magi - R.SENIOR_PHASEOUT_START[fs])
  const seniorEach = r(pos(R.SENIOR_DEDUCTION - seniorExcess * R.SENIOR_PHASEOUT_RATE))
  const seniorTaxpayer = !marriedNotJoint && is65(input.taxpayer) ? seniorEach : 0
  const seniorSpouse = joint && is65(input.spouse) ? seniorEach : 0
  const senior = seniorTaxpayer + seniorSpouse
  if (marriedNotJoint && is65(input.taxpayer)) issues.push({ level: 'info', step: 'deductions', message: 'The $6,000 senior deduction is not available when married filing separately.' })
  if (s.carLoanInterest > 0) issues.push({ level: 'info', step: 'deductions', message: 'Car loan interest qualifies only for a new personal-use vehicle assembled in the U.S., bought after 2024. Keep the VIN for Schedule 1-A.' })
  const line13b = tips + overtime + carLoan + senior

  // QBI deduction (Form 8995 or 8995-A)
  const tiBeforeQbi = pos(agi - line12 - line13b)
  const netCapitalGainForQbi = line3a + preferentialGain
  const positiveProfit = sum(scheduleCResults.map((b) => pos(b.netProfit)))
  const qbiInputs = input.businesses.map((b) => {
    const c = scheduleCResults.find((x) => x.id === b.id)
    const profit = c?.netProfit ?? 0
    // Deductions attributable to the business: its share of half the SE tax (by owner) and of SE health insurance.
    const ownerSe = scheduleSE.find((x) => x.owner === b.owner)?.total ?? 0
    const ownerProfit = sum(scheduleCResults.filter((x) => x.owner === b.owner).map((x) => pos(x.netProfit)))
    const seShare = profit > 0 && ownerProfit > 0 ? (ownerSe / 2) * (profit / ownerProfit) : 0
    const healthShare = profit > 0 && positiveProfit > 0 ? seHealth * (profit / positiveProfit) : 0
    const person = b.owner === 'spouse' ? input.spouse : input.taxpayer
    return {
      id: b.id, name: b.name || 'Business', tin: b.ein || person.ssn, sstb: b.qbi.sstb,
      qbi: r(profit - seShare - healthShare), w2Wages: pos(b.qbi.w2Wages), ubia: pos(b.qbi.ubia)
    }
  })
  const k1Qbi = k1In.filter((k) => k.qbi.income !== 0).map((k) => ({
    id: k.id, name: k.entityName.trim() || 'Schedule K-1', tin: k.ein, sstb: k.qbi.sstb, qbi: r(k.qbi.income), w2Wages: pos(k.qbi.w2Wages), ubia: pos(k.qbi.ubia)
  }))
  const qbi = qbiDeduction({
    fs, taxableIncomeBeforeQbi: tiBeforeQbi, netCapitalGain: netCapitalGainForQbi, businesses: [...qbiInputs, ...k1Qbi],
    priorLoss: input.qbiCarryforward.business, priorReitLoss: input.qbiCarryforward.reitPtp,
    reitPtp: sum(input.dividends.map((d) => pos(d.section199ADividends)))
  })
  const line13a = qbi.deduction
  if (qbi.form === '8995a') {
    if (qbi.businesses.some((b) => b.sstb && b.excluded)) issues.push({ level: 'info', step: 'review', message: 'Specified service businesses get no QBI deduction at this taxable income (Form 8995-A, Schedule A).' })
    if (qbi.businesses.some((b) => !b.excluded && b.line2 > 0 && b.line4 === 0 && b.line7 === 0)) issues.push({ level: 'warning', step: 'income', message: 'Your taxable income is above the QBI threshold, so the deduction depends on W-2 wages paid and property (UBIA) for each business. Enter them under the business if it had employees or property; otherwise the deduction may be limited or zero.' })
  }
  if (qbi.lossCarryforward > 0) issues.push({ level: 'info', step: 'review', message: `Qualified business loss of $${qbi.lossCarryforward.toLocaleString()} carries forward to 2026 (Form 8995 line 16).` })
  if (input.rentals.some((x) => x.rents > 0)) issues.push({ level: 'info', step: 'income', message: 'Rental income is not included in the QBI deduction. A rental that qualifies as a trade or business (for example under the Rev. Proc. 2019-38 safe harbor) needs to be added by hand.' })
  const line14 = line12 + line13a + line13b
  const line15 = pos(line11 - line14)

  // ── Tax ───────────────────────────────────────────────────────────────────
  const usesWorksheet = line3a + preferentialGain > 0
  const scheduleD19 = longTerm > 0 && netCapital > 0 ? f4797.unrecaptured1250 : 0
  const line16 = scheduleD19 > 0
    ? scheduleDTaxWorksheet(line15, line3a, longTerm, netCapital, scheduleD19, fs)
    : usesWorksheet ? qualifiedDividendsTax(line15, line3a, preferentialGain, fs) : regularTax(line15, fs)
  // Form 6251 — Alternative minimum tax (Schedule 2 line 2 → Form 1040 line 17)
  const amtResult = alternativeMinimumTax({
    fs, line11b: line11, line14, seniorDeduction: senior, itemized: used === 'itemized', saltDeducted: taxes,
    standardDeduction: line12, amtInput: input.amt, qualifiedDividends: line3a, preferentialGain, taxableIncome: line15, regularTax: line16
  })
  const line17 = amtResult.amt
  if (line17 > 0) issues.push({ level: 'warning', step: 'review', message: `Alternative minimum tax of $${line17.toLocaleString()} applies (Form 6251).` })
  const line18 = line16 + line17

  // Form 2441 Parts II and III (lines 27–31) — Child and Dependent Care Credit (Schedule 3 line 2)
  const carePersons = input.dependents.filter(careQualifyingPerson).length
  const f2441 = { line3: 0, line4: earnedTaxpayer, line5: earnedSpouse, line6: 0, rate: 0, line9a: 0, line27: 0, line28: 0, line29: 0, line30: 0, line31: 0 }
  if (care.expenses > 0 || care.employerBenefits > 0) {
    if (carePersons === 0) issues.push({ level: 'warning', step: 'credits', message: 'Child care expenses need a qualifying person: a dependent under 13, or a dependent who is disabled.' })
    else if (fs === 'mfs') issues.push({ level: 'warning', step: 'credits', message: 'The child care credit is generally not available when married filing separately.' })
    else {
      const limit = carePersons >= 2 ? R.CARE_EXPENSE_LIMIT_TWO_PLUS : R.CARE_EXPENSE_LIMIT_ONE
      if (care.employerBenefits > 0) {
        f2441.line27 = limit
        f2441.line28 = p3.line25
        f2441.line29 = pos(limit - p3.line25)
        f2441.line30 = r(pos(care.expenses - p3.line25))
        f2441.line31 = Math.min(f2441.line29, f2441.line30)
        f2441.line3 = f2441.line31
      } else {
        f2441.line3 = r(Math.min(care.expenses, limit))
      }
      f2441.line6 = pos(Math.min(f2441.line3, f2441.line4, f2441.line5))
      f2441.rate = Math.max(R.CARE_MIN_RATE, R.CARE_MAX_RATE - 0.01 * Math.ceil(pos(agi - R.CARE_RATE_STEP_START) / R.CARE_RATE_STEP))
      f2441.line9a = r(f2441.line6 * f2441.rate)
      if (joint && Math.min(earnedTaxpayer, earnedSpouse) <= 0) issues.push({ level: 'info', step: 'credits', message: 'Both spouses need earned income for the child care credit, unless one was a full-time student or disabled (not figured here).' })
      const providerTotal = sum(care.providers.map((p) => p.amountPaid))
      if (care.providers.length === 0) issues.push({ level: 'warning', step: 'credits', message: 'Form 2441 requires the name, address and SSN or EIN of each care provider. Add them under Child and dependent care.' })
      else if (Math.abs(providerTotal - care.expenses) > 1) issues.push({ level: 'info', step: 'credits', message: `Amounts paid to care providers (${'$'}${r(providerTotal).toLocaleString()}) differ from the care expenses you entered (${'$'}${r(care.expenses).toLocaleString()}).` })
      if (care.providers.some((p) => p.householdEmployee)) issues.push({ level: 'info', step: 'credits', message: 'A care provider who is your household employee may require Schedule H (household employment taxes), which this app does not prepare.' })
    }
  }
  const careCredit = f2441.line9a
  const careRate = f2441.rate
  const careExpensesUsed = f2441.line6

  // Form 8863 — Education credits
  input.students.filter((st) => st.qualifiedExpenses > 0).forEach((st, i) => {
    const who = st.name.trim() || `Student ${i + 1}`
    if (!ssnOk(st.ssn)) issues.push({ level: 'warning', step: 'credits', message: `${who}: enter the student’s Social Security number for Form 8863.` })
    if (!st.institution.trim()) issues.push({ level: 'warning', step: 'credits', message: `${who}: enter the school’s name for Form 8863.` })
    if (st.aotcEligible && !/^\d{9}$/.test(st.institutionEin.replace(/\D/g, ''))) issues.push({ level: 'warning', step: 'credits', message: `${who}: the American Opportunity Credit requires the school’s EIN from Form 1098-T.` })
  })
  let aotcTentative = 0
  let llcExpenses = 0
  for (const st of input.students) {
    const x = pos(st.qualifiedExpenses)
    if (st.aotcEligible) aotcTentative += Math.min(x, R.AOTC_FULL_EXPENSES) + R.AOTC_PARTIAL_RATE * Math.min(pos(x - R.AOTC_FULL_EXPENSES), R.AOTC_PARTIAL_EXPENSES)
    else llcExpenses += x
  }
  const llcTentative = Math.min(llcExpenses, R.LLC_EXPENSE_LIMIT) * R.LLC_RATE
  let aotc = 0
  let llc = 0
  let eduFraction = 0
  if (aotcTentative + llcTentative > 0) {
    const range = R.EDUCATION_PHASEOUT[fs]
    if (!range) issues.push({ level: 'warning', step: 'credits', message: 'Education credits are not available when married filing separately.' })
    else if (input.canBeClaimedAsDependent) issues.push({ level: 'warning', step: 'credits', message: 'If someone can claim you as a dependent, they claim your education credits instead.' })
    else {
      const fraction = Math.min(1, Math.max(0, Math.round(((range[1] - magi) / (range[1] - range[0])) * 1000) / 1000))
      eduFraction = fraction
      aotc = r(aotcTentative * fraction)
      llc = r(llcTentative * fraction)
    }
  }
  const aotcRefundable = r(aotc * R.AOTC_REFUNDABLE_SHARE)
  if (aotcRefundable > 0 && input.taxpayer.age > 0 && input.taxpayer.age < 24) issues.push({ level: 'info', step: 'credits', message: 'Students under 24 may not get the refundable part of the AOTC (Form 8863 line 7). Check that rule if it applies to you.' })

  // Nonrefundable credits in IRS order: Schedule 3 (care, education), then Schedule 8812
  let remaining = line18
  const take = (amount: number): number => { const used = Math.min(amount, remaining); remaining -= used; return used }
  const careAllowed = take(careCredit)
  const educationAllowed = take(aotc - aotcRefundable + llc)

  // Form 8880 — Saver's Credit (Schedule 3 line 4)
  const saverPeople: { owner: Owner; person: Person }[] = joint
    ? [{ owner: 'taxpayer', person: input.taxpayer }, { owner: 'spouse', person: input.spouse }]
    : [{ owner: 'taxpayer', person: input.taxpayer }]
  const saverLines = saverPeople.map(({ owner, person }) => {
    const s = input.savings[owner]
    const line3 = pos(s.iraContributions) + pos(s.electiveDeferrals)
    const line5 = pos(line3 - pos(s.distributions))
    const eligible = !input.canBeClaimedAsDependent && !person.fullTimeStudent && (person.age === 0 || person.age >= R.SAVERS_MIN_AGE)
    return { owner, ira: r(pos(s.iraContributions)), deferrals: r(pos(s.electiveDeferrals)), line3: r(line3), distributions: r(pos(s.distributions)), line5: r(line5), line6: eligible ? r(Math.min(line5, R.SAVERS_CONTRIBUTION_LIMIT)) : 0, eligible }
  })
  const saverLine7 = sum(saverLines.map((x) => x.line6))
  const [lim50, lim20, lim10] = R.SAVERS_RATE_LIMITS[fs]
  const saverRate = agi <= lim50 ? 0.5 : agi <= lim20 ? 0.2 : agi <= lim10 ? 0.1 : 0
  const saverTentative = r(saverLine7 * saverRate)
  const saverLimit = remaining
  const saverAllowed = take(saverTentative)
  if (saverLines.some((x) => x.line3 > 0)) {
    if (input.canBeClaimedAsDependent) issues.push({ level: 'info', step: 'credits', message: 'The Saver’s Credit is not available if someone can claim you as a dependent.' })
    saverLines.filter((x) => x.line3 > 0 && !x.eligible).forEach((x) => {
      const p = x.owner === 'spouse' ? input.spouse : input.taxpayer
      if (p.fullTimeStudent) issues.push({ level: 'info', step: 'credits', message: `${p.firstName || (x.owner === 'spouse' ? 'Your spouse' : 'You')}: full-time students cannot take the Saver’s Credit.` })
    })
    if (saverRate === 0) issues.push({ level: 'info', step: 'credits', message: `Your AGI is above $${lim10.toLocaleString()}, so the Saver’s Credit does not apply.` })
    if (saverPeople.some(({ person }) => person.age === 0)) issues.push({ level: 'info', step: 'about', message: 'Enter your age: the Saver’s Credit requires age 18 or older.' })
  }
  const schedule3Part1 = careAllowed + educationAllowed + saverAllowed

  // Schedule 8812
  const qualifyingChildren = input.dependents.filter(ctcChild).length
  const otherDependents = input.dependents.length - qualifyingChildren
  const creditBeforePhaseout = qualifyingChildren * R.CTC_PER_CHILD + otherDependents * R.ODC_PER_DEPENDENT
  const phaseoutReduction = Math.min(creditBeforePhaseout, stepPhaseout(magi - R.CTC_PHASEOUT_START[fs], R.CTC_PHASEOUT_PER_1000))
  const creditAfterPhaseout = creditBeforePhaseout - phaseoutReduction
  const nonrefundable = take(creditAfterPhaseout)
  const unused = creditAfterPhaseout - nonrefundable
  let refundable = 0
  if (qualifyingChildren > 0 && unused > 0) {
    refundable = r(Math.min(unused, qualifyingChildren * R.ACTC_REFUNDABLE_MAX_PER_CHILD, pos(earnedIncome - R.ACTC_EARNED_INCOME_FLOOR) * R.ACTC_EARNED_INCOME_RATE))
    if (qualifyingChildren >= 3) issues.push({ level: 'info', step: 'credits', message: 'With 3 or more children, the refundable child credit may be larger under the Social Security tax method (Schedule 8812, Part II-B), which is not calculated here.' })
  }
  input.dependents.forEach((d) => {
    if (d.age > 0 && d.age < 17 && !d.hasSsn) issues.push({ level: 'info', step: 'about', message: `${d.name || 'A dependent'} has no SSN valid for employment, so the $500 credit for other dependents applies instead of the Child Tax Credit.` })
  })
  const line19 = nonrefundable
  const line20 = schedule3Part1
  const line21 = line19 + line20
  const line22 = pos(line18 - line21)

  // Schedule 2, Part II
  const threshold = R.HIGH_INCOME_THRESHOLD[fs]
  const totalMedicareWages = sum(w2s.map(medicareWages))
  const seEarnings = sum(scheduleSE.map((x) => x.netEarnings))
  const addlMedicare = r(pos(totalMedicareWages - threshold) * R.ADDITIONAL_MEDICARE_RATE + pos(seEarnings - pos(threshold - totalMedicareWages)) * R.ADDITIONAL_MEDICARE_RATE)
  // Gains on business property used in an active trade are not investment income; rental property gains are.
  const netInvestmentIncome = pos(line2b + line3b + line7 - Math.min(f4797.scheduleDGain, pos(line7)) + rentalNet + f4797.rentalNet + k1.passiveNet)
  const niit = r(Math.min(netInvestmentIncome, pos(magi - threshold)) * R.NIIT_RATE)
  const schedule2Total = seTax + addlMedicare + niit + earlyDistributionTax + hsaExcessTax + hsaAdditionalTax
  const line23 = schedule2Total
  const line24 = line22 + line23

  // Earned Income Credit
  const eicChildren = Math.min(3, input.dependents.filter(eicChild).length)
  const investmentIncome = line2a + line2b + line3b + pos(line7)
  let eic = 0
  const eicReasons: string[] = []
  if (earnedIncome <= 0) eicReasons.push('no earned income')
  if (fs === 'mfs') eicReasons.push('married filing separately (allowed only if you lived apart from your spouse for the last 6 months of 2025)')
  if (input.canBeClaimedAsDependent) eicReasons.push('someone can claim you as a dependent')
  if (investmentIncome > R.EIC_INVESTMENT_INCOME_LIMIT) eicReasons.push(`investment income is over $${R.EIC_INVESTMENT_INCOME_LIMIT.toLocaleString()}`)
  if (eicChildren === 0) {
    const ages = (joint ? [input.taxpayer, input.spouse] : [input.taxpayer]).map((p) => p.age)
    const inRange = ages.some((age) => age >= R.EIC_NO_CHILD_MIN_AGE && age <= R.EIC_NO_CHILD_MAX_AGE)
    if (ages.every((age) => age === 0)) eicReasons.push('age not entered')
    else if (!inRange) eicReasons.push('without a qualifying child, you (or your spouse) must be 25 to 64')
  }
  if (eicReasons.length === 0) {
    const start = (joint ? R.EIC_PHASEOUT_START_JOINT : R.EIC_PHASEOUT_START_OTHER)[eicChildren]
    const byEarned = eicFromTable(earnedIncome, eicChildren, start)
    eic = agi < start ? byEarned : Math.min(byEarned, eicFromTable(agi, eicChildren, start))
  } else if (earnedIncome > 0 && agi < 68675 && eicReasons.includes('age not entered')) {
    issues.push({ level: 'warning', step: 'about', message: 'Enter your age so the Earned Income Credit can be checked.' })
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  const line25a = r(sum(w2s.map((w) => w.federalWithholding)))
  const line25b = r(sum(input.interest.map((i) => i.federalWithholding)) + sum(input.dividends.map((d) => d.federalWithholding)) +
    sum(retirement.map((d) => d.federalWithholding)) + sum(ssForms.map((x) => x.federalWithholding)) + input.payments.otherWithholding)
  const addlMedicareWithheld = r(pos(sum(w2s.map((w) => w.medicareWithheld)) - totalMedicareWages * R.MEDICARE_EMPLOYEE_RATE))
  const line25c = addlMedicareWithheld
  const line25d = line25a + line25b + line25c
  const line26 = r(sum(input.payments.estimatedByQuarter) || input.payments.estimatedTaxPayments)
  const line27 = eic
  const line28 = refundable
  const line29 = aotcRefundable
  // Excess Social Security withheld (Schedule 3 line 11), per person with 2+ employers
  const maxSsTax = r(R.SOCIAL_SECURITY_WAGE_BASE * 0.062 * 100) / 100
  const excessSs = r(sum(owners.map((o) => {
    const forms = w2s.filter((w) => w.owner === o)
    if (forms.length < 2) return 0
    return pos(sum(forms.map((w) => w.socialSecurityWithheld)) - maxSsTax)
  })))
  const line31 = excessSs
  const line32 = line27 + line28 + line29 + line31
  const line33 = line25d + line26 + line32

  // Form 2210 — Underpayment of estimated tax (Part I and the Penalty Worksheet)
  const penalty = estimatedTaxPenalty({
    fs,
    currentTax: line22 + line23 - (line27 + line28 + line29),
    withholding: line25d + line31,
    estimates: input.payments.estimatedByQuarter,
    prior: input.priorYear
  })
  const line38 = penalty.penalty
  if (penalty.applies && penalty.penalty > 0) issues.push({ level: 'warning', step: 'review', message: `Estimated tax penalty of $${penalty.penalty.toLocaleString()} (Form 2210) is included. Paying more through withholding or quarterly estimates avoids it next year.` })
  if (penalty.priorYearMissing && penalty.applies) issues.push({ level: 'warning', step: 'credits', message: 'Enter your 2024 tax under “Tax you already paid”. It can lower or remove the estimated tax penalty.' })

  const balance = line33 - line24
  const line34 = balance > 0 ? pos(balance - line38) : 0
  const line37 = balance > 0 ? pos(line38 - balance) : pos(-balance) + line38

  // ── Coverage notes ────────────────────────────────────────────────────────
  if (eic > 0) issues.push({ level: 'info', step: 'credits', message: 'Earned Income Credit is included. Attach Schedule EIC for each qualifying child, and confirm each child lived with you in the U.S. for more than half of 2025.' })
  if (scheduleSE.length && businesses.length) issues.push({ level: 'info', step: 'income', message: 'Schedule C is figured from the totals you enter. Inventory (Part III) is not itemized; enter equipment under Depreciation so it goes through Form 4562.' })
  if (w2s.some((w) => w.wages > 0 && (w.medicareWages === 0 || w.socialSecurityWages === 0))) issues.push({ level: 'info', step: 'income', message: 'For W-2s where box 3 or box 5 is blank, box 1 wages were used instead.' })
  if (input.dependents.some((d) => !d.name.trim())) issues.push({ level: 'warning', step: 'about', message: 'Enter a name for each dependent.' })

  const marginalRate = (() => {
    const b = R.BRACKETS[fs]
    let rate = 0
    for (const [lower, rt] of b) if (line15 > lower) rate = rt
    return rate
  })()

  return {
    f1040: {
      '1a': line1a, '1e': line1e, '1z': line1z, '2a': line2a, '2b': line2b, '3a': line3a, '3b': line3b,
      '4a': line4a, '4b': line4b, '5a': line5a, '5b': line5b, '6a': line6a, '6b': line6b,
      '7a': line7, '8': line8, '9': line9, '10': line10, '11a': line11, '11b': line11, '12e': line12, '13a': line13a, '13b': line13b,
      '14': line14, '15': line15, '16': line16, '17': line17, '18': line18, '19': line19, '20': line20,
      '21': line21, '22': line22, '23': line23, '24': line24, '25a': line25a, '25b': line25b, '25c': line25c,
      '25d': line25d, '26': line26, '27a': line27, '28': line28, '29': line29, '31': line31, '32': line32, '33': line33,
      '34': line34, '37': line37, '38': line38
    },
    schedule1: { businessIncome: r(businessIncome), otherGains, rentalIncome: scheduleE41, unemployment, hsaTaxable, otherIncome, additionalIncome, adjustments, totalAdjustments: line10 },
    schedule1A: {
      magi, tipsCapped, tipOtExcess, tipOtReduction, tips, overtimeCapped, overtime,
      carCapped, carExcess, carReduction, carLoanInterest: carLoan,
      seniorExcess, seniorEach, seniorTaxpayer, seniorSpouse, senior, total: line13b
    },
    scheduleA: { medical, taxes, saltBeforeCap, saltCap: r(saltCap), interest: r(it.mortgageInterest), charity, other: r(it.other), total: itemizedTotal },
    scheduleB: { interest: line2b, ordinaryDividends: line3b, required: line2b > 1500 || line3b > 1500 },
    scheduleC: scheduleCResults,
    scheduleD: { shortTerm, longTerm, net: netCapital, allowedLoss: line7 < 0 ? -line7 : 0, carryoverShort, carryoverLong, preferentialGain },
    scheduleSE,
    schedule2: { amt: line17, selfEmploymentTax: seTax, additionalMedicareTax: addlMedicare, netInvestmentIncomeTax: niit, earlyDistributionTax, hsaExcessTax, hsaAdditionalTax, total: schedule2Total },
    schedule3: { dependentCare: careAllowed, education: educationAllowed, saversCredit: saverAllowed, excessSocialSecurity: line31 },
    form2441: {
      qualifyingPersons: carePersons, expensesUsed: careExpensesUsed, rate: careRate, credit: careCredit,
      line3: f2441.line3, line4: f2441.line4, line5: f2441.line5,
      partIII: care.employerBenefits > 0 ? { ...p3, line27: f2441.line27, line28: f2441.line28, line29: f2441.line29, line30: f2441.line30, line31: f2441.line31 } : null
    },
    scheduleE: { properties: rentalResults, gross: r(sum(rentalResults.map((x) => x.net))), priorCarryover: r(sum(rentalsIn.map((p) => pos(p.priorUnallowed ?? 0)))), magi: r(magiPassive), allowance: f8582.line9, allowedLoss: rentalLine25, disallowed: rentalDisallowed, net: rentalNet, line24: rentalLine24, line25: rentalLine25 },
    form8582: f8582,
    form8889: hsaResults,
    form5329,
    form4797: f4797,
    k1,
    scheduleD19,
    section179: s179,
    form4562: [
      ...scheduleCResults.map((c) => form4562For({
        id: c.id, kind: 'business', name: c.name, assets: c.assets, section179Allowed: c.section179, source: input.businesses.find((b) => b.id === c.id)?.assets,
        home: c.homeOffice.firstUsedThisYear && c.homeOffice.lines['42'] > 0 && (c.homeOffice.lines['37'] ?? 0) > 0
          ? { month: c.homeOffice.firstUsedMonth, basis: c.homeOffice.lines['40'], deduction: c.homeOffice.lines['42'] } : null
      })),
      ...rentalResults.map((p) => form4562For({ id: p.id, kind: 'rental', name: p.address, assets: p.assets, section179Allowed: 0, source: input.rentals.find((x) => x.id === p.id)?.assets }))
    ].filter((f) => f.line22 > 0 || f.required),
    form6251: amtResult,
    form8880: { people: saverLines, line7: saverLine7, rate: saverRate, tentative: saverTentative, limit: saverLimit, credit: saverAllowed },
    form2210: penalty,
    form8863Detail: { phaseoutFraction: eduFraction, aotcTentative: r(aotcTentative), llcTentative: r(llcTentative), llcExpenses: r(Math.min(llcExpenses, R.LLC_EXPENSE_LIMIT)) },
    form8863: { aotc, aotcRefundable, llc, nonrefundableAllowed: educationAllowed },
    eic: { qualifyingChildren: eicChildren, earnedIncome, investmentIncome, credit: eic, notEligibleBecause: eic > 0 ? [] : eicReasons },
    schedule8812: { qualifyingChildren, otherDependents, creditBeforePhaseout, phaseoutReduction, nonrefundable, refundable },
    qbi,
    deduction: { standard, itemized: itemizedTotal, used },
    summary: {
      totalIncome: line9, agi, taxableIncome: line15, totalTax: line24, totalPayments: line33,
      refund: line34, amountOwed: line37,
      effectiveRate: line9 > 0 ? line24 / line9 : 0,
      marginalRate
    },
    issues
  }
}
