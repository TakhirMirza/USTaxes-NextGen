/**
 * Wisconsin Form 1, full-year resident income tax return, tax year 2025.
 *
 * Source: 2025 Form 1 (I-010) and its instructions: the Standard Deduction Table (pages 35–37, see
 * wiStandard2025.ts), exemptions of $700 per person and dependent plus $250 at 65 or older (line 10), the tax
 * table and Tax Computation Worksheet (3.5% / 4.4% / 5.3% / 7.65%, with the 4.4% bracket ending at $50,480 single
 * and head of household, $67,300 joint, $33,650 separate), the itemized deduction credit (Schedule 1, 5%), school
 * property tax credit tables (line 16: 12% of property taxes, or of 20%/25% of rent, at most $300), married couple
 * credit (Schedule 2: 3% of the smaller earned income up to $16,000), and the earned income credit (4%, 11% or 34%
 * of the federal credit). Schedule SB items included: taxable Social Security, the 30% long-term capital gain
 * exclusion, and the subtractions entered. Schedule AD: the capital loss limit of $500. Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { WI_STANDARD_TABLE } from './wiStandard2025.ts'

export type WiStatus = 'single' | 'mfj' | 'mfs' | 'hoh'
const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

const BRACKETS: Record<WiStatus, number[]> = { single: [14680, 50480, 323290], hoh: [14680, 50480, 323290], mfj: [19580, 67300, 431060], mfs: [9790, 33650, 215530] }
const RATES = [0.035, 0.044, 0.053, 0.0765]
export const WI_DONATION_LINES = ['1a', '1b', '1c', '1d', '1e', '1f', '1g', '1h'] as const

function bracketTax(income: number, status: WiStatus): number {
  const tops = BRACKETS[status]
  let tax = 0
  let low = 0
  for (let i = 0; i < RATES.length; i++) {
    const top = i < tops.length ? tops[i] : Infinity
    if (income > low) tax += (Math.min(income, top) - low) * RATES[i]
    low = top
  }
  return tax
}

/** Line 12: the tax table below $100,000 ($100 rows at their midpoint; $0–20, $20–40, $40–100 rows), then the worksheet. */
export function wiTax(taxable: number, status: WiStatus): number {
  const t = pos(r(taxable))
  if (t >= 100000) return r(bracketTax(t, status))
  if (t < 20) return 0
  if (t < 40) return r(bracketTax(30, status))
  if (t < 100) return r(bracketTax(70, status))
  return r(bracketTax(Math.floor(t / 100) * 100 + 50, status))
}

/** Line 8: the Standard Deduction Table for Wisconsin income (line 7). */
export function wiStandardDeduction(income: number, status: WiStatus): number {
  const col = { single: 2, mfj: 3, mfs: 4, hoh: 5 }[status]
  const x = Math.max(0, income)
  const row = WI_STANDARD_TABLE.find((t) => x >= t[0] && x < t[1])
  return row ? row[col] : 0
}

/** Line 16a: renter’s school property tax credit ($100 rows; 20% of rent with heat, 25% without, times 12%). */
export function wiRenterCredit(rent: number, heatIncluded: boolean): number {
  const x = r(pos(rent))
  if (x <= 0) return 0
  if (x >= 12500) return 300
  const mid = Math.floor(x / 100) * 100 + 50
  return Math.min(300, r(mid * (heatIncluded ? 0.2 : 0.25) * 0.12))
}

/** Line 16b: homeowner’s school property tax credit ($25 rows, 12%). */
export function wiHomeownerCredit(taxes: number): number {
  const x = r(pos(taxes))
  if (x < 1) return 0
  if (x >= 2500) return 300
  const lo = x < 25 ? 1 : Math.floor(x / 25) * 25
  const hi = x < 25 ? 25 : lo + 25
  return Math.min(300, r(((lo + hi) / 2) * 0.12))
}

export interface WiResult {
  status: WiStatus
  lines: Record<string, number>
  /** Schedule 1 (itemized deduction credit) and Schedule 2 (married couple credit). */
  sch1: Record<string, number>
  sch2: Record<string, number>
  /** Schedule SB and AD amounts that make up lines 6 and 4. */
  sb: Record<string, number>
  ad: Record<string, number>
  exemptions: { filers: number; dependents: number; age65: number }
  eicPercent: number
  statements: { owner: Owner; employer: string; ein: string; stateId: string; wages: number; tax: number }[]
  issues: string[]
  attach: string[]
}

export function computeWisconsin(ret: TaxReturnInput, res: TaxReturnResult): WiResult {
  const d = ret.wi
  const f = res.f1040
  const status: WiStatus = ret.filingStatus === 'qss' ? 'hoh' : ret.filingStatus
  const joint = status === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const S1: Record<string, number> = {}
  const S2: Record<string, number> = {}
  const SB: Record<string, number> = {}
  const AD: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []

  // ── Income (lines 1–7) ──
  L['1'] = r(f['11a'])
  L['2'] = r(d.scheduleIAdjustment)
  L['3'] = L['1'] + L['2']
  L['3w'] = r(f['1z'])
  // Schedule AD: other states’ bond interest; Wisconsin allows only $500 of net capital loss.
  const sd = res.scheduleD
  AD['capitalLoss'] = sd.net < 0 ? pos(r(pos(sd.allowedLoss)) - (status === 'mfs' ? 250 : 500)) : 0
  AD['bonds'] = r(pos(d.otherStateBondInterest))
  AD['other'] = r(pos(d.otherAdditions))
  L['4'] = AD['capitalLoss'] + AD['bonds'] + AD['other']
  L['5'] = L['3'] + L['4']
  // Schedule SB.
  SB['stateRefund'] = r(pos(d.stateRefundInFagi))
  SB['usInterest'] = r(pos(d.usObligationInterest))
  SB['socialSecurity'] = r(pos(f['6b']))
  SB['capitalGain'] = sd.net > 0 && sd.longTerm > 0 ? r(Math.min(sd.longTerm, sd.net) * 0.3) : 0
  SB['retirement'] = r(pos(d.retirementSubtraction))
  SB['collegeSavings'] = r(pos(d.collegeSavings))
  SB['medicalInsurance'] = r(pos(d.medicalInsurance))
  SB['privateSchool'] = r(pos(d.privateSchoolTuition))
  SB['other'] = r(pos(d.otherSubtractions))
  L['6'] = Object.values(SB).reduce((s, x) => s + x, 0)
  L['7'] = L['5'] - L['6']

  // ── Standard deduction and exemptions (lines 8–11) ──
  const tableDeduction = wiStandardDeduction(L['7'], status)
  L['8'] = ret.canBeClaimedAsDependent ? Math.min(Math.max(1350, pos(f['1z']) + 450), tableDeduction) : tableDeduction
  L['9'] = pos(L['7'] - L['8'])
  const filers = ret.canBeClaimedAsDependent ? 0 : joint ? 2 : 1
  const depCount = ret.dependents.length
  const people = owners.map((o) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse))
  const age65 = ret.canBeClaimedAsDependent ? 0 : people.filter((p) => p.age65OrOlder || p.age >= 65).length
  L['10aN'] = filers + depCount
  L['10a'] = L['10aN'] * 700
  L['10bN'] = age65
  L['10b'] = age65 * 250
  L['10c'] = L['10a'] + L['10b']
  L['11'] = pos(L['9'] - L['10c'])

  // ── Tax and nonrefundable credits (lines 12–22) ──
  L['12'] = wiTax(L['11'], status)
  const sa = res.scheduleA
  S1['1'] = r(pos(sa.medical))
  S1['2'] = r(pos(sa.interest))
  S1['3'] = r(pos(sa.charity))
  S1['4'] = 0
  S1['5'] = S1['1'] + S1['2'] + S1['3'] + S1['4']
  S1['6'] = L['8']
  S1['7'] = pos(S1['5'] - S1['6'])
  S1['9'] = r(S1['7'] * 0.05)
  L['13'] = S1['9']
  L['14'] = r(pos(d.additionalCareCredit))
  L['15'] = 0
  const maxProperty = status === 'mfs' || (status === 'hoh' && d.hohMarried) ? 150 : 300
  const renter = Math.min(maxProperty, wiRenterCredit(d.rentHeatIncluded, true) + wiRenterCredit(d.rentHeatNotIncluded, false))
  L['16a'] = renter
  L['16b'] = Math.min(maxProperty - renter, wiHomeownerCredit(d.propertyTaxes))
  L['17'] = 0
  // Schedule 2: married couple credit.
  if (joint) {
    for (const [o, col] of [['taxpayer', 'a'], ['spouse', 'b']] as const) {
      const wages = r(ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + w.wages, 0))
      const se = r(res.scheduleC.filter((x) => x.owner === o).reduce((s, x) => s + x.netProfit, 0))
      S2[`${col}1`] = wages
      S2[`${col}2`] = se
      S2[`${col}3`] = wages + se
      S2[`${col}4`] = 0
      S2[`${col}5`] = pos(S2[`${col}3`] - S2[`${col}4`])
    }
    S2['6'] = Math.min(16000, S2['a5'], S2['b5'])
    S2['8'] = Math.min(480, r(S2['6'] * 0.03))
  }
  L['18'] = S2['8'] ?? 0
  L['19'] = r(pos(d.nonrefundableCredits))
  L['20'] = r(pos(d.otherStateCredit))
  L['21'] = L['13'] + L['14'] + L['15'] + L['16a'] + L['16b'] + L['17'] + L['18'] + L['19'] + L['20']
  L['22'] = pos(L['12'] - L['21'])
  L['23'] = r(pos(d.useTax))
  for (const k of WI_DONATION_LINES) L[`d${k}`] = r(pos(d.donations[k] ?? 0))
  L['24'] = WI_DONATION_LINES.reduce((s, k) => s + L[`d${k}`], 0)
  L['25'] = 0
  L['26'] = 0
  L['27'] = L['22'] + L['23'] + L['24'] + L['25'] + L['26']

  // ── Payments and refundable credits (lines 28–37) ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, ein: x?.ein ?? '', stateId: x?.stateId ?? '', wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  })
  L['28'] = statements.reduce((s, x) => s + x.tax, 0) + r(pos(d.withholding1099))
  L['29'] = r(pos(d.estimatedPayments))
  const kids = res.eic.qualifyingChildren
  const eicPercent = status === 'mfs' || kids === 0 ? 0 : kids === 1 ? 4 : kids === 2 ? 11 : 34
  L['30n'] = eicPercent > 0 ? kids : 0
  L['30a'] = eicPercent > 0 ? r(pos(f['27a'])) : 0
  L['30'] = r(L['30a'] * eicPercent / 100)
  L['33'] = r(pos(d.homesteadCredit))
  L['35'] = r(pos(d.refundableCredits))
  L['37'] = L['28'] + L['29'] + L['30'] + L['33'] + L['35']
  L['39'] = L['37']
  L['40'] = pos(L['39'] - L['27'])
  L['42'] = Math.min(r(pos(d.creditForward)), L['40'])
  L['41'] = L['40'] - L['42']
  L['43'] = pos(L['27'] - L['39'])
  L['45'] = L['43']

  // ── Notes ──
  if (L['2'] !== 0) attach.push('Schedule I (adjustments for federal law changes Wisconsin has not adopted)')
  if (L['4'] > 0) attach.push('Schedule AD (additions)')
  if (L['6'] > 0) attach.push('Schedule SB (subtractions)')
  if (SB['capitalGain'] > 0 || AD['capitalLoss'] > 0) attach.push('Schedule WD (Wisconsin capital gains and losses)')
  if (L['14'] > 0) attach.push('Schedule WI-2441 (additional child and dependent care credit)')
  if (L['19'] > 0 || L['35'] > 0) attach.push('Schedule CR (credits)')
  if (L['20'] > 0) attach.push('Schedule OS and the other state’s return')
  if (L['30'] > 0) attach.push('A copy of federal Schedule EIC')
  if (L['33'] > 0) attach.push('Schedule H or H-EZ (homestead credit)')
  if (L['28'] > 0) attach.push('Your W-2s and 1099s showing Wisconsin tax withheld')
  attach.push('Copies of your federal return and schedules')
  if (ret.dependentCare.expenses > 0 && L['14'] === 0) issues.push('You have child care expenses: Wisconsin’s additional child and dependent care credit (Schedule WI-2441, line 14) may apply. Enter it under credits.')
  if (people.some((p) => p.age >= 65) && L['6'] - SB['socialSecurity'] === 0 && ret.retirement.length > 0) issues.push('At 65 or older, part of your retirement income may be exempt (Schedule SB: the retirement income subtraction or the $5,000 subtraction). Enter it under retirement subtractions.')
  if (L['16a'] + L['16b'] === 0) issues.push('If you paid rent or property taxes on your home, enter them for the school property tax credit (line 16).')
  if (SB['capitalGain'] > 0) issues.push(`Wisconsin excludes 30% of net long-term capital gains (${SB['capitalGain'].toLocaleString('en-US')} here). Complete Schedule WD to confirm it.`)
  if (AD['capitalLoss'] > 0) issues.push(`Wisconsin allows only $500 of net capital loss, so ${AD['capitalLoss'].toLocaleString('en-US')} is added back (Schedule WD/AD).`)
  if (!d.schoolDistrict.trim()) issues.push('Fill in your 4-digit school district number (instructions page 45).')
  if (L['43'] > 500 && L['29'] === 0) issues.push('A balance due over $500 may mean underpayment interest (Schedule U).')
  if (res.deduction.used === 'itemized' && L['13'] === 0) issues.push('Wisconsin has no itemized deductions; instead some of them give a 5% credit (Schedule 1), which is 0 here.')

  return {
    status, lines: L, sch1: S1, sch2: S2, sb: SB, ad: AD,
    exemptions: { filers, dependents: depCount, age65 }, eicPercent, statements, issues, attach
  }
}
