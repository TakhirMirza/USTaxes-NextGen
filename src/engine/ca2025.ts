/**
 * California Form 540, full-year resident income tax return, tax year 2025.
 *
 * Source: 2025 California 540 Personal Income Tax Booklet (Franchise Tax Board): Form 540 instructions,
 * the tax table and tax rate schedules, the AGI Limitation Worksheet for exemption credits, the
 * Nonrefundable Renter’s Credit Qualification Record, the Behavioral Health Services Tax worksheet,
 * Schedule CA (540) and its Itemized Deductions Worksheet; FTB 3514 and its booklet (California EITC
 * worksheet and table, Young Child Tax Credit). California starts from federal AGI and adjusts it on
 * Schedule CA; it has its own (much smaller) standard deduction and gives exemption credits instead of
 * exemptions. Amounts are whole dollars.
 */
import type { Dependent, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { CA_EITC_TABLE } from './caEitcTable.ts'

export const CA_STANDARD_DEDUCTION = { single: 5706, mfs: 5706, mfj: 11412, hoh: 11412, qss: 11412 } as const
export const CA_DEPENDENT_MIN_STANDARD = 1350
export const CA_EXEMPTION = { personal: 153, blind: 153, senior: 153, dependent: 475 }
/** Federal AGI above which exemption credits and itemized deductions are limited. */
export const CA_AGI_LIMIT = { single: 252203, mfs: 252203, hoh: 378310, mfj: 504411, qss: 504411 } as const
export const CA_RENTERS_CREDIT = { lowLimit: 53994, highLimit: 107988, single: 60, joint: 120 }
export const CA_BHS = { threshold: 1000000, rate: 0.01 }
export const CA_EITC = { maxIncome: 32900, investmentLimit: 4814, agiThreshold: [4661, 6998, 9823, 9823] }
export const CA_YCTC = { max: 1189, threshold: 27425, per100: 21.71, childAge: 6 }
/** FTB 3506: percentage of the federal-style credit, by federal AGI. */
export const CA_CARE_PERCENT: [limit: number, pct: number][] = [[40000, 0.5], [70000, 0.43], [100000, 0.34]]

type Bracket = [over: number, base: number, rate: number]
/** 2025 tax rate schedules X (single, MFS), Y (MFJ, QSS) and Z (head of household). */
const SCHEDULES: Record<'X' | 'Y' | 'Z', Bracket[]> = {
  X: [[0, 0, 0.01], [11079, 110.79, 0.02], [26264, 414.49, 0.04], [41452, 1022.01, 0.06], [57542, 1987.41, 0.08], [72724, 3201.97, 0.093], [371479, 30986.19, 0.103], [445771, 38638.27, 0.113], [742953, 72219.84, 0.123]],
  Y: [[0, 0, 0.01], [22158, 221.58, 0.02], [52528, 828.98, 0.04], [82904, 2044.02, 0.06], [115084, 3974.82, 0.08], [145448, 6403.94, 0.093], [742958, 61972.37, 0.103], [891542, 77276.52, 0.113], [1485906, 144439.65, 0.123]],
  Z: [[0, 0, 0.01], [22173, 221.73, 0.02], [52530, 828.87, 0.04], [67716, 1436.31, 0.06], [83805, 2401.65, 0.08], [98990, 3616.45, 0.093], [505208, 41394.72, 0.103], [606251, 51802.15, 0.113], [1010417, 97472.91, 0.123]]
}

export const CA_COUNTIES = [
  'Alameda', 'Alpine', 'Amador', 'Butte', 'Calaveras', 'Colusa', 'Contra Costa', 'Del Norte', 'El Dorado', 'Fresno', 'Glenn', 'Humboldt',
  'Imperial', 'Inyo', 'Kern', 'Kings', 'Lake', 'Lassen', 'Los Angeles', 'Madera', 'Marin', 'Mariposa', 'Mendocino', 'Merced', 'Modoc', 'Mono',
  'Monterey', 'Napa', 'Nevada', 'Orange', 'Placer', 'Plumas', 'Riverside', 'Sacramento', 'San Benito', 'San Bernardino', 'San Diego',
  'San Francisco', 'San Joaquin', 'San Luis Obispo', 'San Mateo', 'Santa Barbara', 'Santa Clara', 'Santa Cruz', 'Shasta', 'Sierra', 'Siskiyou',
  'Solano', 'Sonoma', 'Stanislaus', 'Sutter', 'Tehama', 'Trinity', 'Tulare', 'Tuolumne', 'Ventura', 'Yolo', 'Yuba'
] as const

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const cents = (n: number): number => Math.round(n * 100) / 100
/** Truncate to two decimals ("do not round"), guarding against floating-point noise. */
const trunc2 = (n: number): number => Math.floor(n * 100 + 1e-6) / 100

export type CaStatus = 1 | 2 | 3 | 4 | 5
export const caStatus = (ret: TaxReturnInput): CaStatus => ({ single: 1, mfj: 2, mfs: 3, hoh: 4, qss: 5 } as const)[ret.filingStatus]
const scheduleFor = (status: CaStatus): 'X' | 'Y' | 'Z' => (status === 2 || status === 5 ? 'Y' : status === 4 ? 'Z' : 'X')

function scheduleTax(income: number, s: 'X' | 'Y' | 'Z'): number {
  const rows = SCHEDULES[s]
  let row = rows[0]
  for (const b of rows) if (income > b[0]) row = b
  return row[1] + cents((income - row[0]) * row[2])
}

/** Line 31: the tax table up to $100,000 (rows figured at their middle; $0 for $1–$50), the rate schedules above. */
export function caTax(taxable: number, status: CaStatus): number {
  const t = pos(r(taxable))
  const s = scheduleFor(status)
  if (t > 100000) return r(scheduleTax(t, s))
  if (t <= 50) return 0
  // Rows are $100 wide ($51–$150, …), except the last one ($99,951–$100,000).
  const mid = Math.min(Math.ceil((t - 50) / 100) * 100, 99975)
  return r(scheduleTax(mid, s))
}

/** California EITC Table: the credit for the $50 row containing `amount`. */
export function caEitcFromTable(amount: number, children: number): number {
  const a = r(amount)
  if (a <= 0 || a > CA_EITC.maxIncome) return 0
  return CA_EITC_TABLE[Math.min(3, children)][Math.floor((a - 1) / 50)] ?? 0
}

/** FTB 3514 qualifying child: the federal tests, except that an ITIN is fine. */
export const caQualifyingChild = (d: Dependent): boolean =>
  d.childRelationship && d.monthsLivedWithYou > 6 && (d.age < 19 || (d.student && d.age < 24) || d.disabled)

export interface CaResult {
  status: CaStatus
  lines: Record<string, number>
  exemptions: { personal: number; blind: number; senior: number; dependents: number; limited: boolean }
  scheduleCA: { subtractions: Record<string, number>; additions: Record<string, number>; notAllowed: Record<string, number> }
  deduction: { method: 'standard' | 'itemized'; standard: number; itemized: number | null; itemizedBeforeLimit: number | null; limitReduction: number }
  taxMethod: 'table' | 'schedule'
  eitc: { children: number; earned: number; investment: number; credit: number; yctc: number; youngChildren: number; reason: string; usedAgi: boolean }
  care: { expenses: number; federalRate: number; percent: number; credit: number; reason: string }
  renters: { eligible: boolean; reason: string }
  issues: string[]
  attach: string[]
}

const isOlder = (p: TaxReturnInput['taxpayer']): boolean => p.age65OrOlder || p.age >= 65

export function computeCalifornia(ret: TaxReturnInput, res: TaxReturnResult): CaResult {
  const d = ret.ca
  const f = res.f1040
  const status = caStatus(ret)
  const fs = ret.filingStatus
  const joint = status === 2
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = r(f['11a'])
  const dependentFiler = ret.canBeClaimedAsDependent

  // ── Exemptions (lines 7–11) ──
  const personal = dependentFiler ? 0 : joint || status === 5 ? 2 : 1
  const blind = dependentFiler ? 0 : (ret.taxpayer.blind ? 1 : 0) + (joint && ret.spouse.blind ? 1 : 0)
  const senior = dependentFiler ? 0 : (isOlder(ret.taxpayer) ? 1 : 0) + (joint && isOlder(ret.spouse) ? 1 : 0)
  const deps = ret.dependents.length
  L['7box'] = personal; L['7'] = personal * CA_EXEMPTION.personal
  L['8box'] = blind; L['8'] = blind * CA_EXEMPTION.blind
  L['9box'] = senior; L['9'] = senior * CA_EXEMPTION.senior
  L['10box'] = deps; L['10'] = deps * CA_EXEMPTION.dependent
  L['11'] = L['7'] + L['8'] + L['9'] + L['10']

  // ── Income: federal AGI and Schedule CA ──
  const w2Wages = r(ret.w2s.filter((w) => joint || w.owner === 'taxpayer').reduce((s, w) => s + w.wages, 0))
  L['12'] = d.stateWages ?? w2Wages
  L['13'] = fagi
  const adj = res.schedule1.adjustments
  const hsaEmployer = r((joint ? [ret.hsa.taxpayer, ret.hsa.spouse] : [ret.hsa.taxpayer]).filter((h) => h.coverage !== 'none').reduce((s, h) => s + pos(h.employerContributions), 0))
  const subtractions: Record<string, number> = {
    stateRefund: r(pos(d.stateRefundInFagi)),
    usInterest: r(pos(d.usObligationInterest)),
    unemployment: r(res.schedule1.unemployment),
    socialSecurity: r(f['6b']),
    hsaDistributions: r(res.schedule1.hsaTaxable),
    other: r(pos(d.otherSubtractions))
  }
  const additions: Record<string, number> = {
    hsaEmployer,
    otherStateBonds: r(pos(d.otherStateBondInterest)),
    other: r(pos(d.otherAdditions))
  }
  // Section C: adjustments to income California does not allow go in column B, which lowers line 27, column B.
  const notAllowed: Record<string, number> = {
    educator: r(adj.educatorExpenses ?? 0),
    hsaDeduction: r(adj.hsaDeduction ?? 0)
  }
  const sum = (o: Record<string, number>): number => Object.values(o).reduce((t, n) => t + n, 0)
  L['14'] = sum(subtractions) - sum(notAllowed)
  L['15'] = L['13'] - L['14']
  L['16'] = sum(additions)
  L['17'] = L['15'] + L['16']

  // ── Deduction (line 18): the larger of California itemized or standard ──
  let standard: number = CA_STANDARD_DEDUCTION[fs]
  if (dependentFiler) standard = Math.min(standard, Math.max(CA_DEPENDENT_MIN_STANDARD, r(res.eic.earnedIncome) + 450))
  const it = ret.itemized
  const sa = res.scheduleA
  // Schedule CA Part II: no SALT cap and no state income tax, so real estate and personal property taxes count in full.
  const anyItemized = it.medical + it.realEstateTax + it.personalPropertyTax + it.mortgageInterest + it.charityCash + it.charityNonCash + it.other > 0
  let itemizedBefore: number | null = null
  let itemized: number | null = null
  let limitReduction = 0
  if (anyItemized) {
    itemizedBefore = r(sa.medical + pos(it.realEstateTax) + pos(it.personalPropertyTax) + sa.interest + sa.charity + sa.other + d.itemizedAdjustment)
    itemized = pos(itemizedBefore)
    const limit = CA_AGI_LIMIT[fs]
    if (fagi > limit) {
      const protectedPart = r(sa.medical)
      const line3 = pos(itemized - protectedPart)
      if (line3 > 0) {
        limitReduction = r(Math.min(line3 * 0.8, (fagi - limit) * 0.06))
        itemized = itemized - limitReduction
      }
    }
  }
  const method: 'standard' | 'itemized' = itemized !== null && (itemized > standard || (fs === 'mfs' && d.spouseItemizes)) ? 'itemized' : 'standard'
  L['18'] = method === 'itemized' ? (itemized ?? 0) : standard
  L['19'] = pos(L['17'] - L['18'])

  // ── Tax ──
  L['31'] = caTax(L['19'], status)
  const taxMethod = L['19'] > 100000 ? 'schedule' : 'table'
  let limited = false
  if (fagi > CA_AGI_LIMIT[fs]) {
    // AGI Limitation Worksheet.
    limited = true
    const e = Math.ceil((fagi - CA_AGI_LIMIT[fs]) / (fs === 'mfs' ? 1250 : 2500)) * 6
    const i = pos(L['7'] + L['8'] + L['9'] - e * (personal + blind + senior))
    const m = pos(L['10'] - e * deps)
    L['32'] = i + m
  } else L['32'] = L['11']
  L['33'] = pos(L['31'] - L['32'])
  L['34'] = 0
  L['35'] = L['33'] + L['34']

  // ── Special credits ──
  // FTB 3506: the federal-style credit (same expense limits and decimal) times a percentage set by federal AGI; care must be in California.
  const careExpenses = res.form2441.expensesUsed
  const carePct = CA_CARE_PERCENT.find(([lim]) => fagi <= lim)?.[1] ?? 0
  let careReason = ''
  if (careExpenses <= 0) careReason = 'No child or dependent care expenses on the federal return.'
  else if (!carePct) careReason = 'Federal AGI is over $100,000.'
  else if (!d.careInCalifornia) careReason = 'The care was not provided in California.'
  // Line 8 and line 10 are whole dollars.
  const careLine8 = r(careExpenses * res.form2441.rate)
  const careCredit = careReason ? 0 : r(careLine8 * carePct)
  L['40'] = careCredit
  L['43'] = r(pos(d.specialCredit.amount))
  L['44'] = 0
  L['45'] = 0
  // Renter’s credit.
  let rentReason = ''
  const lowLimit = status === 1 || status === 3
  if (!d.rentedHome) rentReason = 'You did not pay rent on your California home for at least half of 2025.'
  else if (L['17'] > (lowLimit ? CA_RENTERS_CREDIT.lowLimit : CA_RENTERS_CREDIT.highLimit)) rentReason = `California AGI is over $${(lowLimit ? CA_RENTERS_CREDIT.lowLimit : CA_RENTERS_CREDIT.highLimit).toLocaleString('en-US')}.`
  else if (dependentFiler) rentReason = 'Not available if you lived more than half the year with the person who can claim you as a dependent.'
  else if (d.homeownerExemption) rentReason = 'Not available if you (or your spouse) claimed the homeowner’s property tax exemption.'
  const rentersEligible = !rentReason
  L['46'] = rentersEligible ? (status === 1 || status === 3 ? CA_RENTERS_CREDIT.single : CA_RENTERS_CREDIT.joint) : 0
  L['47'] = L['40'] + L['43'] + L['44'] + L['45'] + L['46']
  L['48'] = pos(L['35'] - L['47'])

  // ── Other taxes ──
  L['61'] = 0
  L['62'] = L['19'] > CA_BHS.threshold ? r((L['19'] - CA_BHS.threshold) * CA_BHS.rate) : 0
  L['63'] = r(pos(d.otherTaxes))
  L['64'] = L['48'] + L['61'] + L['62'] + L['63']

  // ── FTB 3514: California EITC and Young Child Tax Credit ──
  const qualifying = ret.dependents.filter(caQualifyingChild)
  const children = Math.min(3, qualifying.length)
  const earned = r(res.eic.earnedIncome)
  const investment = r(res.eic.investmentIncome)
  let eitcReason = ''
  if (fs === 'mfs' && !d.separatedSpouse) eitcReason = 'Married filing separately (allowed only if you are separated from your spouse; see FTB 3514).'
  else if (investment > CA_EITC.investmentLimit) eitcReason = `Investment income is over $${CA_EITC.investmentLimit.toLocaleString('en-US')}.`
  else if (earned <= 0) eitcReason = 'No earned income.'
  else if (earned > CA_EITC.maxIncome || fagi > CA_EITC.maxIncome) eitcReason = `Earned income or federal AGI is over $${CA_EITC.maxIncome.toLocaleString('en-US')}.`
  else if (children === 0 && ![ret.taxpayer, ...(joint ? [ret.spouse] : [])].some((p) => p.age >= 18)) eitcReason = 'Without a qualifying child, you (or your spouse) must be at least 18.'
  else if (dependentFiler) eitcReason = 'Not available to someone who can be claimed as a dependent.'
  let eitc = 0
  let usedAgi = false
  if (!eitcReason) {
    const part1 = caEitcFromTable(earned, children)
    eitc = part1
    if (fagi !== earned && fagi >= CA_EITC.agiThreshold[children]) {
      const byAgi = caEitcFromTable(fagi, children)
      if (byAgi < part1) { eitc = byAgi; usedAgi = true }
    }
    if (eitc === 0) eitcReason = 'Your income is in a row of the EITC table with no credit.'
  }
  L['75'] = eitc
  // YCTC: a qualifying child under 6 and eligible for the California EITC.
  const youngChildren = qualifying.filter((x) => x.age < CA_YCTC.childAge).length
  let yctc = 0
  if (youngChildren > 0 && eitc > 0) {
    if (earned <= CA_YCTC.threshold) yctc = CA_YCTC.max
    else {
      const l27 = trunc2(trunc2((earned - CA_YCTC.threshold) / 100) * CA_YCTC.per100)
      const c = CA_YCTC.max - l27
      yctc = c <= 0 ? 0 : c < 1 ? 1 : r(c)
    }
  }
  L['76'] = yctc
  L['77'] = 0

  // ── Payments ──
  L['71'] = r(pos(d.withholding))
  L['72'] = r(pos(d.estimatedPayments) + pos(d.extensionPayments))
  L['73'] = 0
  L['74'] = 0
  L['78'] = L['71'] + L['72'] + L['73'] + L['74'] + L['75'] + L['76'] + L['77']

  // ── Use tax, ISR penalty, overpaid tax or tax due ──
  L['91'] = r(pos(d.useTax))
  L['92'] = d.fullYearCoverage ? 0 : r(pos(d.isrPenalty))
  L['93'] = pos(L['78'] - L['91'])
  L['94'] = pos(L['91'] - L['78'])
  L['95'] = pos(L['93'] - L['92'])
  L['96'] = pos(L['92'] - L['93'])
  L['97'] = pos(L['95'] - L['64'])
  L['98'] = Math.min(r(pos(d.creditForward)), L['97'])
  L['99'] = L['97'] - L['98']
  L['100'] = pos(L['64'] - L['95'])
  L['110'] = r(pos(d.contribution.amount))
  L['112'] = 0
  L['113'] = 0
  if (L['99'] > 0 && L['99'] >= L['110']) {
    L['111'] = 0
    L['115'] = L['99'] - L['110'] - L['112'] - L['113']
  } else {
    L['111'] = L['94'] + L['96'] + L['100'] + L['110'] - L['99']
    L['115'] = 0
  }
  L['114'] = L['111'] + L['112'] + L['113']

  // ── Notes ──
  if (L['14'] !== 0 || L['16'] > 0 || method === 'itemized') attach.push('Schedule CA (540), California adjustments')
  if (L['40'] > 0) attach.push('FTB 3506, Child and Dependent Care Expenses Credit')
  if (L['43'] > 0) attach.push(`The form for credit code ${d.specialCredit.code || '(code)'}`)
  if (!d.fullYearCoverage) attach.push('FTB 3853, Health Coverage Exemptions and Individual Shared Responsibility Penalty')
  if (additions.hsaEmployer + notAllowed.hsaDeduction > 0) issues.push('California does not recognize HSAs: your HSA deduction and employer HSA contributions are added back on Schedule CA.')
  if (subtractions.hsaDistributions > 0) issues.push('Taxable HSA distributions on your federal return are subtracted for California (the earnings were taxed as they were earned).')
  if (notAllowed.educator > 0) issues.push('California does not allow the educator expense deduction; it is added back on Schedule CA.')
  if (method === 'itemized') issues.push(`California itemized deductions (${(itemized ?? 0).toLocaleString('en-US')}) beat the California standard deduction: no SALT cap, but state income tax is left out${limitReduction ? `, and ${limitReduction.toLocaleString('en-US')} is cut for federal AGI over the limit` : ''}.`)
  if (res.deduction.used === 'itemized' && method === 'standard') issues.push('You itemized federally, but the California standard deduction is larger here.')
  if (limited) issues.push('Federal AGI is over the limit, so exemption credits are reduced (AGI Limitation Worksheet).')
  if (L['62'] > 0) issues.push('Taxable income over $1,000,000: the 1% Behavioral Health Services Tax applies (line 62).')
  if (L['17'] > (status === 2 || status === 5 ? 463745 : status === 3 ? 231868 : 347808)) issues.push('With California AGI this high, your credits may be limited by tentative minimum tax; see Schedule P (540).')
  if (L['12'] === w2Wages && d.stateWages === null && ret.w2s.length > 0) issues.push('Line 12 uses W-2 box 1. If box 16 (state wages) differs, enter it.')
  if (eitc > 0 || yctc > 0) attach.push('FTB 3514, California Earned Income Tax Credit')
  if ((eitc > 0 || yctc > 0) && (!d.birthDate.taxpayer || (joint && !d.birthDate.spouse))) issues.push('The California EITC requires your date of birth (and your spouse’s, if joint) on Form 540.')
  if (eitc > 0 && qualifying.some((x) => !d.dependentBirthDates[x.id])) issues.push('FTB 3514 asks for each qualifying child’s date of birth.')
  if (d.useTax === 0) issues.push('Line 91 (use tax) is 0. If you bought taxable items from out-of-state sellers that did not charge California tax, see the use tax worksheet in the booklet.')
  if (L['100'] > 0 && L['72'] === 0 && L['100'] > 500) issues.push('If you owe more than $500, the FTB may charge an underpayment penalty (FTB 5805); it figures it if you leave line 113 blank.')

  return {
    status, lines: L,
    exemptions: { personal, blind, senior, dependents: deps, limited },
    scheduleCA: { subtractions, additions, notAllowed },
    deduction: { method, standard, itemized, itemizedBeforeLimit: itemizedBefore, limitReduction },
    taxMethod,
    eitc: { children, earned, investment, credit: eitc, yctc, youngChildren, reason: eitcReason, usedAgi },
    care: { expenses: r(careExpenses), federalRate: res.form2441.rate, percent: carePct, credit: careCredit, reason: careReason },
    renters: { eligible: rentersEligible, reason: rentReason },
    issues, attach
  }
}
