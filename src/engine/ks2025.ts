/**
 * Kansas Form K-40, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 K-40, Schedule S and the 2025 Kansas individual income tax booklet (ip25): exemptions of $9,160
 * ($18,320 joint) plus $2,320 for head of household, each dependent, each child born in 2025 and each disabled veteran;
 * standard deduction $3,605 / $8,240 / $4,120 / $6,180 with the 65-or-blind chart; Schedule S modifications (Social
 * Security, U.S. interest, exempt KPERS / federal / military / railroad retirement, 529 and ABLE contributions); tax at
 * 5.2% and 5.58% (above $23,000, $46,000 joint) from the $50-row tax tables up to $100,000 and the tax computation
 * worksheet above; child and dependent care credit of 50% of the federal credit; earned income credit of 17% of the
 * federal credit, refundable. Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const KS_STANDARD: Record<TaxReturnInput['filingStatus'], number[]> = {
  single: [3605, 4455, 5305], mfj: [8240, 8940, 9640, 10340, 11040], mfs: [4120, 4820, 5520, 6220, 6920], hoh: [6180, 7030, 7880], qss: [8240, 8940, 9640, 10340, 11040]
}

/** Kansas tax by formula: 5.2% up to $23,000 ($46,000 joint), 5.58% above. */
function ksFormula(x: number, joint: boolean): number {
  const top = joint ? 46000 : 23000
  return x <= top ? x * 0.052 : x * 0.0558 - (joint ? 175 : 87)
}

/** Tax from the 2025 tax tables ($50 rows taxed at the midpoint; $26–$50 first row) or the computation worksheet over $100,000. */
export function ksTax(taxable: number, joint: boolean): number {
  const x = Math.max(0, Math.floor(taxable))
  if (x > 100000) return r(ksFormula(x, joint))
  if (x <= 25) return 0
  const mid = x <= 50 ? 38 : 50 * Math.ceil(x / 50) - 24.5
  return r(ksFormula(mid, joint))
}

export interface KsOtherState { name: string; l1: number; l2: number; l3: number; l4: number; /** percent, 4 decimals */ l5: number; l6: number; l7: number }

export interface KsResult {
  /** Line 13 worksheets (Worksheet for Residents), one per state or foreign country. */
  otherStates: KsOtherState[]
  /** Kansas Schedule A lines. */
  schA: Record<string, number>
  itemizedFederally: boolean
  lines: Record<string, number>
  exemptions: { count: number; base: number; hoh: number; dependents: number; newborns: number; veterans: number }
  scheduleS: Record<string, number>
  itemize: boolean
  itemized: number
  standard: number
  issues: string[]
  attach: string[]
}

export function computeKansas(ret: TaxReturnInput, res: TaxReturnResult): KsResult {
  const d = ret.ks
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []

  // ── Exemptions ──
  const dependent = ret.canBeClaimedAsDependent
  const newborns = ret.dependents.filter((x) => x.age < 1).length
  const ex = {
    count: joint ? 2 : 1,
    base: joint ? 18320 : 9160,
    hoh: fs === 'hoh' ? 2320 : 0,
    dependents: dependent ? 0 : ret.dependents.length * 2320,
    newborns: dependent ? 0 : newborns * 2320,
    veterans: pos(Math.floor(d.disabledVeterans)) * 2320
  }
  const exemptionTotal = ex.base + ex.hoh + ex.dependents + ex.newborns + ex.veterans

  // ── Schedule S ──
  const S: Record<string, number> = {}
  S['A1'] = r(pos(d.otherStateBondInterest))
  S['A2'] = r(pos(d.kpersContributions))
  S['A8'] = r(pos(d.otherAdditions))
  S['A9'] = S['A1'] + S['A2'] + S['A8']
  S['A10'] = r(pos(f['6b']))
  S['A12'] = r(pos(d.usObligationInterest))
  S['A13'] = r(pos(d.stateRefundInFagi))
  S['A14'] = r(ret.retirement.filter((x) => owners.includes(x.owner) && d.exemptRetirement[x.id]).reduce((s, x) => s + pos(x.taxableAmount), 0))
  S['A16'] = r(pos(d.qtp529))
  S['A21'] = r(pos(d.able))
  S['A25'] = r(pos(d.otherSubtractions))
  S['A26'] = ['A10', 'A12', 'A13', 'A14', 'A16', 'A21', 'A25'].reduce((s, k) => s + S[k], 0)
  S['A27'] = S['A9'] - S['A26']

  // ── Income and deductions ──
  L['1'] = r(f['11a'])
  L['2'] = S['A27']
  L['3'] = L['1'] + L['2']
  const boxes = owners.reduce((s, o) => s + (person(o).age >= 65 || person(o).age65OrOlder ? 1 : 0) + (person(o).blind ? 1 : 0), 0)
  const chart = KS_STANDARD[fs]
  const standard = chart[Math.min(boxes, chart.length - 1)]
  // ── Kansas Schedule A (may be used whether or not you itemized federally) ──
  const itemizedFederally = res.deduction.used === 'itemized'
  const it = ret.itemized
  const ka = d.schA
  const A: Record<string, number> = {}
  A['1'] = r(pos(it.medical)); A['2'] = r(f['11a']); A['3'] = r(pos(A['2']) * 0.075); A['4'] = pos(A['1'] - A['3'])
  A['5'] = r(pos(it.realEstateTax)); A['6'] = r(pos(it.personalPropertyTax)); A['7'] = A['5'] + A['6']
  A['8a'] = r(pos(it.mortgageInterest)); A['8b'] = r(pos(ka.individualMortgage)); A['8c'] = r(pos(ka.points)); A['9'] = A['8a'] + A['8b'] + A['8c']
  A['10'] = r(pos(it.charityCash)); A['11'] = r(pos(it.charityNonCash)); A['12'] = r(pos(ka.carryover)); A['13'] = A['10'] + A['11'] + A['12']
  A['14'] = A['4'] + A['7'] + A['9'] + A['13']
  const itemized = A['14']
  const itemize = itemized > standard
  L['4'] = itemize ? itemized : standard
  L['5'] = exemptionTotal
  L['6'] = L['4'] + L['5']
  L['7'] = pos(L['3'] - L['6'])

  // ── Tax and credits ──
  L['8'] = ksTax(L['7'], joint)
  L['11'] = 0
  L['12'] = L['8'] + L['11']
  // Line 13: Worksheet for Residents, one per state (and one for a foreign country, line 1 limited to the tax paid minus the federal foreign tax credit).
  const rows = d.otherStates.filter((o) => o.state.trim() && (o.tax > 0 || o.income > 0)).map((o) => ({ name: o.state.trim().toUpperCase(), paid: o.tax, income: o.income }))
  const fo = d.foreign
  if (fo.taxPaid > 0 || fo.income > 0) rows.push({ name: fo.country.trim() || 'Foreign country', paid: pos(fo.taxPaid - fo.federalCredit), income: fo.income })
  const otherStates: KsOtherState[] = rows.map((o) => {
    const l1 = r(pos(o.paid))
    const l3 = r(pos(o.income))
    const pct = L['3'] > 0 ? Math.min(1, l3 / L['3']) : 0
    const l6 = r(L['12'] * pct)
    return { name: o.name, l1, l2: L['12'], l3, l4: L['3'], l5: Math.round(pct * 1e6) / 1e4, l6, l7: Math.min(l1, l6) }
  })
  const worked = otherStates.length > 0
  L['13'] = Math.min(L['12'], worked ? otherStates.reduce((s, o) => s + o.l7, 0) : r(pos(d.otherStateCredit)))
  L['14'] = Math.min(L['12'] - L['13'], r(pos(res.schedule3.dependentCare) * 0.5))
  L['15'] = Math.min(L['12'] - L['13'] - L['14'], r(pos(d.otherCredits)))
  L['16'] = pos(L['12'] - L['13'] - L['14'] - L['15'])
  const eitc = r(pos(f['27a']) * 0.17)
  L['17'] = Math.min(eitc, L['16'])
  L['18'] = pos(L['16'] - L['17'])

  // ── Payments ──
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  L['19'] = r(w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0) + pos(d.withholdingOther))
  L['20'] = r(pos(d.estimatedPayments))
  L['21'] = r(pos(d.extensionPayment))
  L['22'] = eitc - L['17']
  L['23'] = 0
  L['27'] = L['19'] + L['20'] + L['21'] + L['22'] + L['23']
  const contrib = ['35', '36', '37', '38', '39', '40', '41', '42']
  for (const k of contrib) L[k] = r(pos(d.contributions[k] ?? 0))
  const giving = contrib.reduce((s, k) => s + L[k], 0)
  L['28'] = pos(L['18'] - L['27'])
  L['33'] = pos(L['27'] - L['18'])
  L['34'] = Math.min(L['33'], r(pos(d.creditForward)))
  const fromRefund = Math.min(giving, L['33'] - L['34'])
  L['43'] = L['33'] - L['34'] - fromRefund
  L['32'] = L['28'] + (giving - fromRefund)

  // ── Notes ──
  if (S['A9'] + S['A26'] > 0) attach.push('Schedule S, Part A (modifications)')
  if (itemize) attach.push('The supporting documents the Kansas Schedule A instructions call for (e.g. Form 1098, receipts for gifts of $250 or more)')
  if (itemize && ka.mixedUseMortgage) issues.push('Kansas Schedule A line 8: you said not all mortgage loans were used to buy, build or improve your home; limit the interest as the instructions describe.')
  if (L['13'] > 0) attach.push('The other state’s return and supporting schedules (credit for taxes paid to other states)')
  if (d.foreign.taxPaid > 0) attach.push('Federal Form 1116, if you completed one (foreign tax credit)')
  if (L['14'] > 0) attach.push('Federal Form 2441')
  if (L['15'] > 0) attach.push('The schedules for your other credits')
  if (dependent) issues.push('Someone can claim you as a dependent: Kansas limits your standard deduction (see the booklet) and you claim no dependents.')
  if (itemizedFederally && !itemize && itemized > 0) issues.push(`Kansas itemized deductions (${itemized.toLocaleString('en-US')}) are less than the Kansas standard deduction, so the standard deduction is used.`)
  if (ret.retirement.some((x) => owners.includes(x.owner) && x.taxableAmount > 0) && Object.keys(d.exemptRetirement).length === 0) issues.push('KPERS, federal civil service, military and railroad retirement are exempt in Kansas: mark them among your 1099-Rs.')
  if (d.qtp529 > (joint ? 6000 : 3000) * Math.max(1, ret.dependents.length)) issues.push('The 529 subtraction is limited to $3,000 per beneficiary ($6,000 if married filing jointly).')
  if (L['28'] > 500 && L['20'] === 0) issues.push('A balance due over $500 may mean an estimated tax penalty (Form K-210).')

  return { otherStates, schA: A, itemizedFederally, lines: L, exemptions: ex, scheduleS: S, itemize, itemized, standard, issues, attach }
}
