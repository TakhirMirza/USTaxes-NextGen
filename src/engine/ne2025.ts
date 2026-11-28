/**
 * Nebraska Form 1040N, full-year resident individual income tax return, tax years 2025 and 2026.
 *
 * Source: 2025 Form 1040N, Nebraska Schedule I, the 2025 Nebraska Individual Income Tax Booklet and the 2025 Tax
 * Calculation Schedule: federal AGI less the Nebraska standard deduction ($8,600 / $17,200 / $12,600, chart for 65 or
 * blind) or federal itemized deductions less state income taxes; Schedule I adjustments (Social Security, U.S.
 * obligation interest, military, railroad and CSRS retirement, Nebraska 529 up to $10,000); tax at 2.46% / 3.51% /
 * 5.01% / 5.20%; 29.6% of the federal tax on early distributions; $171 personal exemption credit; child and dependent
 * care credit (25% of the federal credit above $29,000 AGI; at or below, refundable Form 2441N: expenses × federal decimal × state decimal); earned
 * income credit of 10% of the federal credit (refundable); the federal tax liability limit. Whole dollars.
 *
 * 2026: the 2026 Form 1040N and Schedules I–III (final, fillable), the 2026 Tax Calculation Schedule (2.46% / 3.51% /
 * 4.55%) and Tax Table; $176 exemption credit; the standard deduction on line 6. Line and Schedule I numbers here stay
 * the 2025 ones; src/pdf/ne2025.ts maps them to the renumbered 2026 fields (Form 1040N lines 52–64 moved down by one
 * for the new adoption credit; Schedule I gained lines 13–14, 25 and 47–48).
 */
import type { NeRetirementKind, Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { currentTaxYear } from './rules.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const NE_STANDARD: Record<TaxReturnInput['filingStatus'], number[]> = {
  single: [8600, 10600, 12600], mfj: [17200, 18850, 20500, 22150, 23800], qss: [17200, 18850, 20500], mfs: [8600, 10250, 11900, 13550, 15200], hoh: [12600, 14600, 16600]
}
/**
 * 2026: the base amounts are printed on the 2026 Form 1040N line 6 ($8,850 / $17,700 / $8,850 / $12,950). The additions
 * for 65 or blind ($2,050 single or head of household, $1,700 married) are the LB 1090 (2018) amounts of $1,600 / $1,300
 * indexed with the same factor as the base amounts and rounded down to $50, as 2025's $2,000 / $1,650 were.
 */
export const NE_STANDARD_2026: Record<TaxReturnInput['filingStatus'], number[]> = {
  single: [8850, 10900, 12950], mfj: [17700, 19400, 21100, 22800, 24500], qss: [17700, 19400, 21100], mfs: [8850, 10550, 12250, 13950, 15650], hoh: [12950, 15000, 17050]
}
/** Personal exemption credit per exemption (Form 1040N line 18): $171 for 2025, $176 for 2026. */
export const NE_EXEMPTION_CREDIT: Record<number, number> = { 2025: 171, 2026: 176 }
const neYear = (): number => (currentTaxYear() >= 2026 ? 2026 : 2025)

/** 2026 Tax Calculation Schedule (8-460-2026): the top two brackets are both 4.55%. */
const BRACKETS_2026: Record<'single' | 'mfj' | 'hoh', [number, number, number][]> = {
  single: [[0, 0, 0.0246], [4130, 101.60, 0.0351], [24760, 825.71, 0.0455], [39900, 1514.58, 0.0455]],
  mfj: [[0, 0, 0.0246], [8250, 202.95, 0.0351], [49530, 1651.88, 0.0455], [79800, 3029.16, 0.0455]],
  hoh: [[0, 0, 0.0246], [7700, 189.42, 0.0351], [39620, 1309.81, 0.0455], [59160, 2198.88, 0.0455]]
}
const BRACKETS: Record<'single' | 'mfj' | 'hoh', [number, number, number][]> = {
  single: [[0, 0, 0.0246], [4030, 99.14, 0.0351], [24120, 804.30, 0.0501], [38870, 1543.28, 0.052]],
  mfj: [[0, 0, 0.0246], [8040, 197.78, 0.0351], [48250, 1609.15, 0.0501], [77730, 3086.10, 0.052]],
  hoh: [[0, 0, 0.0246], [7510, 184.75, 0.0351], [38590, 1275.66, 0.0501], [57630, 2229.56, 0.052]]
}

/** Tax Calculation Schedule (2025, or 2026 when that year is chosen). */
export function neTax(taxable: number, fs: TaxReturnInput['filingStatus'], year: number = neYear()): number {
  const rows = (year >= 2026 ? BRACKETS_2026 : BRACKETS)[fs === 'mfj' || fs === 'qss' ? 'mfj' : fs === 'hoh' ? 'hoh' : 'single']
  const x = Math.max(0, taxable)
  let row = rows[0]
  for (const b of rows) if (x > b[0]) row = b
  return r(row[1] + (x - row[0]) * row[2])
}

/** Form 2441N line 8: federal decimal by federal AGI ($0–$29,000). */
export function neFederalCareDecimal(agi: number): number {
  if (agi <= 15000) return 0.35
  return Math.max(28, 35 - Math.ceil((agi - 15000) / 2000)) / 100
}

/** Form 2441N line 9: state decimal by federal AGI; 0 above $29,000. */
export function neCarePercent(agi: number): number {
  if (agi <= 22000) return 1
  if (agi > 29000) return 0
  return Math.round((0.9 - 0.1 * (Math.ceil(agi / 1000) - 23)) * 100) / 100
}

/** Form 2441N refundable credit: qualifying expenses (line 6) × federal decimal × state decimal. */
export function neRefundableCare(expenses: number, agi: number): number {
  return r(r(pos(expenses) * neFederalCareDecimal(agi)) * neCarePercent(agi))
}

export interface NeResult {
  lines: Record<string, number>
  scheduleI: Record<string, number>
  /** Schedule II lines (den = line 3 denominator; null without the credit) and Form 2441N lines 10–11 (null without the refundable credit). */
  sch2: Record<string, number> | null
  care: Record<string, number> | null
  boxes: { youOver65: boolean; youBlind: boolean; spouseOver65: boolean; spouseBlind: boolean }
  exemptions: { a: number; b: number; c: number }
  federalTaxUsed: boolean
  qualifyingChildren: number
  issues: string[]
  attach: string[]
}

export function computeNebraska(ret: TaxReturnInput, res: TaxReturnResult): NeResult {
  const d = ret.ne
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const agi = r(f['11a'])
  const dependent = ret.canBeClaimedAsDependent

  // ── Lines 2–4 ──
  const old = (p: TaxReturnInput['taxpayer']): boolean => p.age >= 65 || p.age65OrOlder
  const spouseBoxes = joint || fs === 'mfs'
  const boxes = { youOver65: old(ret.taxpayer), youBlind: ret.taxpayer.blind, spouseOver65: spouseBoxes && old(ret.spouse), spouseBlind: spouseBoxes && ret.spouse.blind }
  const nBoxes = Object.values(boxes).filter(Boolean).length
  const exemptions = { a: dependent ? 0 : 1, b: joint ? 1 : 0, c: ret.dependents.length }
  L['4'] = exemptions.a + exemptions.b + exemptions.c

  // ── Deductions ──
  L['5'] = agi
  const chart = (neYear() >= 2026 ? NE_STANDARD_2026 : NE_STANDARD)[fs]
  const neStandard = chart[Math.min(nBoxes, chart.length - 1)]
  L['6'] = dependent ? Math.min(neStandard, r(f['12e'])) : neStandard
  const itemizedFederally = res.deduction.used === 'itemized'
  L['7'] = itemizedFederally ? r(res.deduction.itemized) : 0
  L['8'] = itemizedFederally ? r(pos(ret.itemized.stateLocalIncomeOrSalesTax)) : 0
  L['9'] = pos(L['7'] - L['8'])
  L['10'] = Math.max(L['6'], L['9'])
  L['11'] = L['5'] - L['10']

  // ── Schedule I ──
  const S: Record<string, number> = {}
  S['1'] = r(pos(d.otherStateBondInterest))
  S['3'] = S['1']
  S['13'] = S['3']
  S['14'] = r(pos(d.stateRefundInFagi))
  S['15'] = r(pos(d.usObligationInterest))
  S['17'] = S['15']
  const kind = (id: string): NeRetirementKind => d.retirementKind[id] ?? 'standard'
  const ofKind = (k: NeRetirementKind): number => r(ret.retirement.filter((x) => owners.includes(x.owner) && kind(x.id) === k).reduce((s, x) => s + pos(x.taxableAmount), 0))
  S['18'] = ofKind('railroad')
  S['20'] = Math.min(r(pos(d.collegeSavings)), fs === 'mfs' ? 5000 : 10000)
  S['22'] = r(pos(d.enable))
  S['31'] = r(pos(f['6b']))
  S['32'] = ofKind('military')
  S['38'] = ofKind('csrs')
  S['44'] = S['14'] + S['17'] + S['18'] + S['20'] + S['22'] + S['31'] + S['32'] + S['38']
  L['12'] = S['13']
  L['13'] = S['44']
  L['14'] = pos(L['11'] + L['12'] - L['13'])

  // ── Tax ──
  L['15'] = neTax(L['14'], fs)
  L['16b'] = r(pos(res.schedule2.earlyDistributionTax))
  L['16c'] = L['16b']
  L['16'] = r(L['16c'] * 0.296)
  L['17'] = L['15'] + L['16']

  // ── Nonrefundable credits ──
  L['18'] = NE_EXEMPTION_CREDIT[neYear()] * L['4']
  // ── Schedule II (full-year residents, one state) ──
  let sch2: Record<string, number> | null = null
  if (pos(d.otherState.tax) > 0 && pos(d.otherState.agi) > 0) {
    const c: Record<string, number> = {}
    c['1'] = L['17']
    c['2'] = r(pos(d.otherState.agi))
    c['den'] = r(f['11a']) + L['12'] - L['13']
    c['3'] = c['den'] > 0 ? Math.min(1, Math.round(c['2'] / c['den'] * 10000) / 10000) : 1
    c['4'] = r(c['1'] * c['3'])
    c['5'] = r(pos(d.otherState.tax))
    c['6'] = Math.min(c['1'], c['4'], c['5'])
    sch2 = c
  }
  L['19'] = sch2?.['6'] ?? 0
  L['23'] = agi > 29000 ? r(pos(res.schedule3.dependentCare) * 0.25) : 0
  L['34'] = L['18'] + L['19'] + L['23']
  L['35'] = pos(L['17'] - L['34'])
  let federalTaxUsed = false
  if (L['12'] - L['13'] < 5000 && L['35'] > 0) {
    const fed = pos(r(f['16']) + r(res.schedule2.amt) + r(res.schedule2.earlyDistributionTax))
    if (fed < L['35']) { L['35'] = fed; federalTaxUsed = true }
  }

  // ── Payments and refundable credits ──
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  L['36'] = r(w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0))
  L['37'] = r(pos(d.withholdingOther))
  L['40'] = r(pos(d.estimatedPayments))
  L['42'] = agi <= 29000 && fs !== 'mfs' ? neRefundableCare(res.form2441.expensesUsed, agi) : 0
  const care: Record<string, number> | null = L['42'] > 0 ? { '10': r(pos(res.form2441.expensesUsed) * neFederalCareDecimal(agi)), '11': L['42'] } : null
  L['98'] = r(pos(f['27a']))
  const qualifyingChildren = Math.min(3, ret.dependents.filter((x) => x.childRelationship && (x.age < 19 || (x.student && x.age < 24) || x.disabled) && x.monthsLivedWithYou > 6).length)
  L['44'] = r(L['98'] * 0.1)
  L['53'] = L['36'] + L['37'] + L['40'] + L['42'] + L['44']
  L['55'] = L['53']
  L['57'] = L['35']
  L['58'] = r(pos(d.useTax))
  L['59'] = pos(L['57'] + L['58'] - L['55'])
  L['60'] = pos(L['55'] - L['57'] - L['58'])
  L['61'] = Math.min(L['60'], r(pos(d.creditForward)))
  L['62'] = Math.min(L['60'] - L['61'], r(pos(d.wildlife)))
  L['63'] = L['60'] - L['61'] - L['62']

  // ── Notes ──
  attach.push('A copy of your federal return and schedules; your W-2s')
  if (L['12'] + L['13'] > 0) attach.push('Nebraska Schedule I')
  if (sch2) attach.push(`A complete copy of the return you filed with ${d.otherState.state.trim() || 'the other state'} (Schedule II)`)
  if (sch2 && !d.otherState.state.trim()) issues.push('Schedule II: enter the name of the other state.')
  if (L['23'] > 0) attach.push('Federal Form 2441')
  if (S['32'] > 0 || S['38'] > 0) attach.push('Documentation for the military / CSRS retirement exclusion')
  if (S['18'] > 0) attach.push('Your RRB forms (railroad retirement)')
  if (federalTaxUsed) issues.push('Your Nebraska tax is limited to your federal tax (line 35, federal tax box checked).')
  if (d.collegeSavings > S['20']) issues.push('The Nebraska 529 subtraction is limited to $10,000 ($5,000 married filing separately).')
  if (L['42'] > 0 && neYear() >= 2026) issues.push('Form 2441N for 2026 is not in this app yet: copy the refundable child care credit (line 42) from the Nebraska step.')
  if (L['42'] > 0) issues.push('The refundable child care credit follows Form 2441N: qualifying expenses × federal decimal × state decimal (AGI $29,000 or less).')
  if (L['59'] > 500 && L['40'] === 0) issues.push('A balance due may mean an underpayment penalty (Form 2210N).')

  return { lines: L, scheduleI: S, sch2, care, boxes, exemptions, federalTaxUsed, qualifyingChildren, issues, attach }
}
