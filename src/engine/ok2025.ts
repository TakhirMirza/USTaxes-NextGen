/**
 * Oklahoma Form 511, full-year resident individual income tax return, tax year 2025.
 *
 * Source: the 2025 Form 511 packet (Oklahoma Tax Commission): federal AGI less Schedule 511-A subtractions (U.S.
 * interest, taxable Social Security, CSRS and military retirement in full, $10,000 per person of Oklahoma government /
 * federal civil service and other retirement income, railroad retirement), plus Schedule 511-B additions, less
 * Schedule 511-C adjustments; the Oklahoma standard deduction ($6,350 / $12,700 / $9,350) or Schedule 511-D
 * itemized deductions (federal itemized deductions less state income or sales tax, limited to $17,000 apart from
 * medical and gifts); $1,000 per exemption; tax from the 2025 tax table (rows of $50 below $100,000, at the midpoint)
 * or the worksheet (rates 0.25% to 4.75%); the child care / child tax credit (the larger of 20% of the federal care
 * credit or 5% of the federal child tax credit, AGI ≤ $100,000) and the earned income credit (5% of the federal
 * credit under the 2020 federal rules, Form 511-EIC), both prorated by Oklahoma AGI over federal AGI. Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

const BRACKETS = [1000, 2500, 3750, 4900, 7200]
const RATES = [0.0025, 0.0075, 0.0175, 0.0275, 0.0375, 0.0475]

function rateTax(x: number, joint: boolean): number {
  let t = 0
  let prev = 0
  BRACKETS.forEach((b0, i) => {
    const b = joint ? b0 * 2 : b0
    if (x > prev) t += (Math.min(x, b) - prev) * RATES[i]
    prev = b
  })
  if (x > prev) t += (x - prev) * RATES[5]
  return t
}

/** Line 14a: the 2025 tax table below $100,000 ($50 rows, at the midpoint) or the worksheet above. */
export function okTax(taxable: number, joint: boolean): number {
  const x = pos(r(taxable))
  if (x >= 100000) return r((joint ? 4373 : 4562) + (x - 100000) * 0.0475)
  return r(rateTax(Math.floor(x / 50) * 50 + 25, joint))
}

/** 2020 federal EIC parameters, by number of qualifying children (0–3). Oklahoma figures its credit under the 2020 rules (Form 511-EIC). */
const EIC_2020 = [
  { rate: 0.0765, max: 538, start: 8790, startJoint: 14680, phase: 0.0765, end: 15820, endJoint: 21710 },
  { rate: 0.34, max: 3584, start: 19330, startJoint: 25220, phase: 0.1598, end: 41756, endJoint: 47646 },
  { rate: 0.4, max: 5920, start: 19330, startJoint: 25220, phase: 0.2106, end: 47440, endJoint: 53330 },
  { rate: 0.45, max: 6660, start: 19330, startJoint: 25220, phase: 0.2106, end: 50954, endJoint: 56844 }
]
export const OK_EIC_INVESTMENT_LIMIT_2020 = 3650

/** The 2020 EIC Table amount for an income: figured at the middle of its $50 row, like the table. */
export function okEic2020Table(income: number, children: number, joint: boolean): number {
  const p = EIC_2020[Math.min(3, children)]
  if (income <= 0 || income >= (joint ? p.endJoint : p.end)) return 0
  const mid = Math.floor(income / 50) * 50 + 25
  const start = joint ? p.startJoint : p.start
  return Math.max(0, Math.round(Math.min(p.rate * mid, p.max) - (mid > start ? p.phase * (mid - start) : 0)))
}

/** Form 511-EIC line 20 for one year: the smaller of the credit by earned income (line 16) and by AGI (line 19). */
export function okEic2020(earned: number, agi: number, children: number, joint: boolean): { line16: number; line19: number | null; line20: number } {
  const line16 = okEic2020Table(earned, children, joint)
  const p = EIC_2020[Math.min(3, children)]
  const start = joint ? p.startJoint : p.start
  const line19 = Math.round(earned) === Math.round(agi) || agi < Math.ceil(start / 50) * 50 ? null : okEic2020Table(agi, children, joint)
  return { line16, line19, line20: line19 === null ? line16 : Math.min(line16, line19) }
}

export interface OkResult {
  lines: Record<string, number>
  schA: Record<string, number>
  schB: Record<string, number>
  schC: Record<string, number>
  schD: Record<string, number> | null
  schF: Record<string, number>
  schG: Record<string, number>
  /** Form 511-TX lines 1–7 (empty when no credit). */
  tx: Record<string, number>
  /** Form 511-EIC columns (2024 from the inputs, 2025 from this return); null when the credit is not available. */
  eic: { earned: [number, number]; agi: [number, number]; line16: [number, number]; line19: [number | null, number | null]; line20: [number, number]; children: number } | null
  ratio: number
  exemptions: { regular: [number, number]; special: [number, number]; blind: [number, number]; dependents: number; total: number }
  issues: string[]
  attach: string[]
}

export function computeOklahoma(ret: TaxReturnInput, res: TaxReturnResult): OkResult {
  const d = ret.ok
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const jointRates = fs === 'mfj' || fs === 'hoh' || fs === 'qss'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const agi = r(f['11a'])
  L['1'] = agi

  // ── Schedule 511-A ──
  const A: Record<string, number> = {}
  const kind = (id: string): string => d.retirementKind[id] ?? 'other'
  const byKind = (o: Owner, k: string): number => r(ret.retirement.filter((x) => x.owner === o && kind(x.id) === k).reduce((s, x) => s + pos(x.taxableAmount), 0))
  A['1'] = r(pos(d.usObligationInterest))
  A['2'] = r(pos(f['6b']))
  A['3'] = owners.reduce((s, o) => s + byKind(o, 'csrs'), 0)
  A['4'] = owners.reduce((s, o) => s + byKind(o, 'military'), 0)
  let five = 0
  let six = 0
  for (const o of owners) {
    const gov = Math.min(10000, byKind(o, 'okgov'))
    const other = Math.min(pos(10000 - gov), byKind(o, 'other'))
    five += gov
    six += other
  }
  A['5'] = five
  A['6'] = six
  A['7'] = owners.reduce((s, o) => s + byKind(o, 'railroad'), 0)
  A['17'] = /^\d{1,2}$/.test(d.otherSubtraction.code) ? r(pos(d.otherSubtraction.amount)) : 0
  A['18'] = ['1', '2', '3', '4', '5', '6', '7', '17'].reduce((s, k) => s + A[k], 0)
  L['2'] = A['18']
  L['3'] = L['1'] - L['2']
  L['4'] = 0
  L['5'] = L['3'] - L['4']
  const B: Record<string, number> = {}
  B['1'] = r(pos(d.otherStateBondInterest))
  B['9'] = /^\d{1,2}$/.test(d.otherAddition.code) ? r(pos(d.otherAddition.amount)) : 0
  B['10'] = B['1'] + B['9']
  L['6'] = B['10']
  L['7'] = L['5'] + L['6']
  const C: Record<string, number> = {}
  C['1'] = r(pos(d.militaryPay))
  C['3'] = Math.min(r(pos(d.collegeSavings)), joint ? 20000 : 10000)
  C['6'] = /^\d{1,2}$/.test(d.otherAdjustment.code) ? r(pos(d.otherAdjustment.amount)) : 0
  C['7'] = C['1'] + C['3'] + C['6']
  L['8'] = C['7']
  L['9'] = L['7'] - L['8']

  // ── Deductions and exemptions ──
  let D: Record<string, number> | null = null
  const standard = fs === 'mfj' || fs === 'qss' ? 12700 : fs === 'hoh' ? 9350 : 6350
  if (res.deduction.used === 'itemized') {
    D = {}
    const sa = res.scheduleA
    D['1'] = r(res.deduction.itemized)
    const incomeTax = pos(ret.itemized.stateLocalIncomeOrSalesTax)
    D['2'] = r(sa.saltBeforeCap > 0 ? incomeTax * Math.min(1, sa.taxes / sa.saltBeforeCap) : 0)
    D['3'] = D['1'] - D['2']
    D['4'] = r(pos(sa.medical))
    D['5'] = r(pos(sa.charity))
    D['6'] = D['3'] - D['4'] - D['5']
    D['limited'] = D['6'] > 17000 ? 1 : 0
    if (D['limited']) { D['8'] = 17000; D['9'] = D['4']; D['10'] = D['5']; D['11'] = 17000 + D['4'] + D['5'] } else D['11'] = D['3']
  }
  L['10'] = D ? D['11'] : standard
  const limitSpecial = { single: 15000, mfj: 25000, mfs: 12500, hoh: 19000, qss: 25000 }[fs]
  const is65 = (o: Owner): boolean => person(o).age65OrOlder || person(o).age >= 65
  const regular: [number, number] = [ret.canBeClaimedAsDependent ? 0 : 1, joint ? 1 : 0]
  const special: [number, number] = [is65('taxpayer') && agi <= limitSpecial ? 1 : 0, joint && is65('spouse') && agi <= limitSpecial ? 1 : 0]
  const blind: [number, number] = [ret.taxpayer.blind ? 1 : 0, joint && ret.spouse.blind ? 1 : 0]
  const dependents = ret.dependents.length
  const total = regular[0] + regular[1] + special[0] + special[1] + blind[0] + blind[1] + dependents
  L['11'] = total * 1000
  L['12'] = L['10'] + L['11']
  L['13'] = pos(L['9'] - L['12'])
  L['14a'] = okTax(L['13'], jointRates)
  L['14b'] = 0
  L['14'] = L['14a'] + L['14b']

  // ── Credits ──
  const ratio = agi > 0 ? Math.min(1, pos(L['7']) / agi) : 0
  const F: Record<string, number> = {}
  const s8812 = res.schedule8812
  const ctcShare = s8812.qualifyingChildren > 0 ? (s8812.qualifyingChildren * 2200) / (s8812.qualifyingChildren * 2200 + s8812.otherDependents * 500) : 0
  F['1'] = r(pos(res.schedule3.dependentCare))
  F['2'] = r(F['1'] * 0.2)
  F['3'] = r(pos(s8812.nonrefundable) * ctcShare + pos(s8812.refundable))
  F['4'] = r(F['3'] * 0.05)
  F['5'] = agi <= 100000 ? Math.max(F['2'], F['4']) : 0
  F['6'] = ratio
  F['7'] = L['7'] < L['1'] ? r(F['5'] * ratio) : F['5']
  L['15'] = Math.min(F['7'], L['14'])
  // Form 511-TX: tax paid to the other state, limited to Oklahoma tax × (income taxed by both ÷ Oklahoma AGI) when that income is entered.
  const txIncome = r(pos(d.otherStateIncome ?? 0))
  const tx: Record<string, number> = {}
  if (d.otherStateCredit > 0) {
    tx['1'] = txIncome
    tx['2'] = L['7']
    tx['3'] = txIncome > 0 && L['7'] > 0 ? Math.min(1, txIncome / L['7']) : 0
    tx['4'] = L['14']
    tx['5'] = txIncome > 0 ? r(L['14'] * tx['3']) : L['14']
    tx['6'] = r(d.otherStateCredit)
    tx['7'] = Math.min(tx['5'], tx['6'])
  }
  L['16'] = Math.min(tx['7'] ?? 0, pos(L['14'] - L['15']))
  L['17'] = Math.min(r(pos(d.otherCredit.amount)), pos(L['14'] - L['15'] - L['16']))
  L['18'] = pos(L['14'] - L['15'] - L['16'] - L['17'])
  L['19'] = r(pos(d.useTax))
  L['20'] = L['18'] + L['19']
  L['21'] = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + r(pos(d.w2[w.id]?.stateTax ?? 0)), 0) + r(pos(d.withholding1099))
  L['22'] = r(pos(d.estimatedPayments))
  L['23'] = r(pos(d.extensionPayment))
  L['25'] = r(pos(d.salesTaxCredit))
  const G: Record<string, number> = {}
  // Form 511-EIC: the 2020 federal rules, with the 2024 or 2025 earned income (whichever gives the larger credit).
  const eicOk = res.eic.notEligibleBecause.length === 0 && res.eic.investmentIncome <= OK_EIC_INVESTMENT_LIMIT_2020
  const jointEic = ret.filingStatus === 'mfj'
  const prior = d.priorYearEic ?? { earnedIncome: 0, agi: 0 }
  let eic: OkResult['eic'] = null
  if (eicOk && (res.eic.earnedIncome > 0 || prior.earnedIncome > 0)) {
    const ch = res.eic.qualifyingChildren
    const y24 = prior.earnedIncome > 0 ? okEic2020(prior.earnedIncome, prior.agi || prior.earnedIncome, ch, jointEic) : { line16: 0, line19: null, line20: 0 }
    const y25 = okEic2020(res.eic.earnedIncome, f['11a'], ch, jointEic)
    eic = { earned: [r(prior.earnedIncome), r(res.eic.earnedIncome)], agi: [r(prior.agi || prior.earnedIncome), r(f['11a'])], line16: [y24.line16, y25.line16], line19: [y24.line19, y25.line19], line20: [y24.line20, y25.line20], children: ch }
  }
  G['1'] = eic ? Math.max(eic.line20[0], eic.line20[1]) : 0
  G['2'] = r(G['1'] * 0.05)
  G['3'] = ratio
  G['4'] = r(G['2'] * ratio)
  L['28'] = G['4']
  L['31'] = L['21'] + L['22'] + L['23'] + L['25'] + L['28']
  L['33'] = L['31']
  L['34'] = pos(L['33'] - L['20'])
  L['35'] = Math.min(r(pos(d.creditForward)), L['34'])
  L['37'] = L['35']
  L['38'] = L['34'] - L['37']
  L['39'] = pos(L['20'] - L['33'])
  L['42'] = L['39']

  // ── Notes ──
  if (L['21'] > 0) attach.push('W-2s, 1099s and other statements showing Oklahoma tax withheld')
  if (L['7'] !== L['1'] || D) attach.push('A copy of your federal return (Form 1040 and schedules)')
  if (A['3'] > 0) attach.push('Form CSA 1099-R or CSF 1099-R (CSRS retirement, Schedule 511-A line 3)')
  if (A['5'] + A['6'] > 0) attach.push('Forms 1099-R for the retirement exclusion (Schedule 511-A lines 5 and 6)')
  if (L['16'] > 0) attach.push('Form 511-TX and the other state’s return')
  if (L['17'] > 0) attach.push('Form 511-CR (other credits)')
  if (L['25'] > 0) attach.push('Form 538-S (sales tax relief credit)')
  if (L['28'] > 0) attach.push('Form 511-EIC')
  if (D?.['limited']) issues.push('Oklahoma limits itemized deductions other than medical and gifts to $17,000.')
  if (res.deduction.used === 'itemized' && L['10'] < standard) issues.push('You itemized on your federal return, so Oklahoma requires itemized deductions even though they are below the Oklahoma standard deduction.')
  if (ret.retirement.some((x) => x.code === '1' && (d.retirementKind[x.id] ?? 'other') === 'okgov')) issues.push('An early distribution (code 1) does not qualify for the government retirement exclusion (line 5); mark it as other retirement income.')
  if (ret.retirement.length > 0 && Object.keys(d.retirementKind).length === 0) issues.push('Tell the app which 1099-Rs are military, CSRS, Oklahoma or federal civil service retirement: they are excluded differently.')
  if (owners.some((o) => is65(o)) && agi > limitSpecial) issues.push('The special exemption at 65 applies only when federal AGI is under the filing status limit.')
  if (agi <= 50000 && L['25'] === 0) issues.push('Households with gross income up to $20,000 ($50,000 with a dependent, at 65, or with a disability) may claim the sales tax relief credit on Form 538-S.')
  if (!d.county.trim()) issues.push('Enter your county (page 1).')
  if (L['39'] > 500 && L['22'] === 0) issues.push('A balance due may mean underpayment of estimated tax interest (Form OW-8-P).')

  return { lines: L, schA: A, schB: B, schC: C, schD: D, schF: F, schG: G, tx, eic, ratio, exemptions: { regular, special, blind, dependents, total }, issues, attach }
}
