/**
 * Maine Form 1040ME, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form 1040ME with Schedules 1A, 1S (pension income deduction worksheet), 2, A and PTFC/STFC, the 2025
 * 1040ME general instructions, the 2025 tax rate schedules and tax table (Maine Revenue Services, Feb. 2026), and the
 * 2025 worksheets for the dependent exemption tax credit, child care credit and earned income tax credit.
 *
 *  - Maine AGI = federal AGI + Schedule 1A − Schedule 1S (Social Security, U.S. interest, pension income deduction:
 *    up to $48,216 a person less Social Security received, phased out above $125,000 / $187,500 / $250,000 federal AGI;
 *    military retirement in full; 529 contributions up to $1,000 a beneficiary).
 *  - Standard deduction $15,000 / $30,000 / $22,500 (+ $2,000 unmarried or $1,600 married per 65 / blind box), or
 *    Schedule 2 itemized (federal Schedule A without income/sales taxes, real estate and personal property taxes
 *    added back, $36,300 cap except medical), phased out above $100,000 / $150,000 / $200,050 Maine AGI.
 *  - Exemptions $5,150 each, phased out above $333,450 / $366,750 / $400,100 ($200,050 MFS).
 *  - Tax: 5.8% / 6.75% / 7.15%; the tax table (line 19 under $100,000) is the schedule at the midpoint of each $100.
 *  - Refundable credits: dependent exemption credit $305 ($610 under 6), less $20 per $500 above $100,000 / $125,000 /
 *    $150,000 ($75,000 MFS); child care credit 25% of the federal credit (50% for Star 5 providers), up to $500
 *    refundable; earned income credit 25% of federal (50% with no qualifying child); property tax fairness credit and
 *    sales tax fairness credit (Schedule PTFC/STFC).
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
type FS = TaxReturnInput['filingStatus']

const SCHEDULES: Record<'s' | 'h' | 'j', [number, number, number][]> = {
  s: [[0, 0, 0.058], [26800, 1554, 0.0675], [63450, 4028, 0.0715]],
  h: [[0, 0, 0.058], [40200, 2332, 0.0675], [95150, 6041, 0.0715]],
  j: [[0, 0, 0.058], [53600, 3109, 0.0675], [126900, 8057, 0.0715]]
}
const sched = (fs: FS): 's' | 'h' | 'j' => (fs === 'mfj' || fs === 'qss' ? 'j' : fs === 'hoh' ? 'h' : 's')
const schedule = (x: number, fs: FS): number => {
  const rows = SCHEDULES[sched(fs)]
  const [floor, base, rate] = rows.filter((row) => x >= row[0]).pop() ?? rows[0]
  return base + (x - floor) * rate
}

/** Line 20: the tax table below $100,000 (schedule at the middle of each $100 row; under $50 no tax), the schedules above. */
export function meTax(taxable: number, fs: FS): number {
  const x = Math.floor(pos(taxable))
  if (x < 50) return 0
  if (x < 100000) return Math.round(schedule(Math.floor(x / 100) * 100 + 50, fs))
  return Math.round(schedule(x, fs))
}

export const ME_STANDARD: Record<FS, number> = { single: 15000, mfs: 15000, mfj: 30000, qss: 30000, hoh: 22500 }
export const ME_EXEMPTION = 5150

/** A worksheet phase-out ratio, carried to four decimals and capped at 1. */
const ratio = (excess: number, span: number): number => (excess <= 0 ? 0 : Math.min(1, Math.round((excess / span) * 10000) / 10000))

/** Sales tax fairness credit (Schedule PTFC/STFC line 17 tables). */
export function meSalesTaxCredit(income: number, fs: FS, kids: number): number {
  const x = Math.round(income)
  if (fs === 'single') return x <= 25450 ? 155 : pos(155 - 10 * Math.ceil((x - 25450) / 500))
  if (fs === 'mfj' || fs === 'qss') {
    const base = kids === 0 ? 215 : kids === 1 ? 250 : 280
    return x <= 50950 ? base : pos(base - 20 * Math.ceil((x - 50950) / 1000))
  }
  if (fs === 'hoh') {
    const base = kids <= 1 ? 215 : kids === 2 ? 250 : 280
    return x <= 38200 ? base : pos(base - 15 * Math.ceil((x - 38200) / 750))
  }
  return 0
}

export interface MeResult {
  lines: Record<string, number>
  /** Schedule 1A (A1…A11), 1S (S1…S27), pension worksheet per owner, Schedule 2 (two…), Schedule A (CA1…CA23), PTFC/STFC (P1…P17). */
  s1a: Record<string, number>
  s1s: Record<string, number>
  pension: Record<Owner, Record<string, number>>
  pensionRatio: number
  military: boolean
  s2: Record<string, number> | null
  sa: Record<string, number>
  ptfc: Record<string, number>
  boxes: { old: Record<Owner, boolean>; blind: Record<Owner, boolean> }
  deductionRatio: number
  itemize: boolean
  qualifying: number
  issues: string[]
  attach: string[]
}

export function computeMaine(ret: TaxReturnInput, res: TaxReturnResult): MeResult {
  const d = ret.me
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const isOld = (o: Owner): boolean => person(o).age >= 65 || person(o).age65OrOlder
  const dependentFiler = ret.canBeClaimedAsDependent
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const earned = r(ret.w2s.filter((w) => w.owner === 'taxpayer').reduce((s, w) => s + pos(w.wages), 0) + res.scheduleC.filter((b) => b.owner === 'taxpayer').reduce((s, b) => s + pos(b.netProfit), 0))

  // ── Schedule 1A ──
  const A: Record<string, number> = {}
  A['1'] = r(pos(d.otherStateBondInterest))
  A['3'] = r(pos(d.mainePersContributions))
  A['10'] = r(pos(d.otherAdditions))
  A['11'] = A['1'] + A['3'] + A['10']

  // ── Schedule 1S with the pension income deduction worksheet ──
  const S: Record<string, number> = {}
  S['1'] = r(pos(d.usObligationInterest))
  S['2'] = r(pos(d.stateRefund))
  S['3'] = r(pos(f['6b']))
  const fagi = r(f['11a'])
  const pThreshold = fs === 'mfs' || fs === 'single' ? 125000 : fs === 'hoh' ? 187500 : 250000
  const pensionRatio = ratio(fagi - pThreshold, fs === 'mfs' ? 50000 : 100000)
  const pension = { taxpayer: {}, spouse: {} } as Record<Owner, Record<string, number>>
  let military = false
  for (const o of owners) {
    const mine = ret.retirement.filter((x) => x.owner === o)
    const P = pension[o]
    P['P1'] = r(mine.filter((x) => (d.pensionKind[x.id] ?? 'none') === 'eligible').reduce((s, x) => s + pos(x.taxableAmount), 0))
    P['P2'] = 48216
    P['P3'] = r(ret.socialSecurity.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.netBenefits), 0))
    P['P4'] = pos(P['P2'] - P['P3'])
    P['P5'] = Math.min(P['P1'], P['P4'])
    P['P7'] = r(P['P5'] * pensionRatio)
    P['P8'] = P['P5'] - P['P7']
    P['P9'] = r(mine.filter((x) => d.pensionKind[x.id] === 'military').reduce((s, x) => s + pos(x.taxableAmount), 0))
    P['P10'] = P['P8'] + P['P9']
    if (P['P9'] > 0) military = true
  }
  S['4'] = owners.reduce((s, o) => s + pension[o]['P10'], 0)
  S['7'] = r(pos(d.mainePersPickup))
  const smallAgi = fagi <= (fs === 'single' || fs === 'mfs' ? 100000 : 200000)
  S['8'] = smallAgi ? Math.min(r(pos(d.tuition529)), 1000 * Math.max(0, Math.floor(d.tuitionBeneficiaries))) : 0
  S['18'] = r(pos(d.maineBondInterest))
  S['26'] = r(pos(d.otherSubtractions))
  S['27'] = ['1', '2', '3', '4', '7', '8', '18', '26'].reduce((s, k) => s + S[k], 0)

  // ── Lines 12–16 ──
  const old: Record<Owner, boolean> = { taxpayer: isOld('taxpayer'), spouse: joint && isOld('spouse') }
  const blind: Record<Owner, boolean> = { taxpayer: ret.taxpayer.blind, spouse: joint && ret.spouse.blind }
  const boxes = owners.reduce((s, o) => s + (old[o] ? 1 : 0) + (blind[o] ? 1 : 0), 0)
  L['13'] = dependentFiler ? 0 : joint ? 2 : 1
  const qualifying = ret.dependents.length
  L['13a'] = qualifying
  L['14'] = fagi
  L['15a'] = A['11']
  L['15b'] = S['27']
  L['16'] = L['14'] + L['15a'] - L['15b']

  // ── Line 17: standard or Schedule 2 itemized deduction, with the phase-out worksheet ──
  let standard = ME_STANDARD[fs]
  if (dependentFiler) standard = Math.min(standard, Math.max(1350, earned + 450))
  standard += boxes * (fs === 'single' || fs === 'hoh' ? 2000 : 1600)
  let s2: Record<string, number> | null = null
  if (res.deduction.used === 'itemized') {
    const sa = res.scheduleA
    const it = ret.itemized
    s2 = {}
    s2['1'] = r(sa.total)
    s2['2a'] = r(sa.taxes)
    s2['2d'] = r(sa.medical)
    s2['2f'] = s2['2a'] + s2['2d']
    s2['3b'] = r(pos(it.realEstateTax))
    s2['3c'] = r(pos(it.personalPropertyTax))
    s2['3e'] = s2['3b'] + s2['3c']
    s2['4'] = pos(s2['1'] - s2['2f'] + s2['3e'])
    s2['5'] = 36300
    s2['6'] = Math.min(s2['4'], s2['5'])
    s2['7'] = s2['2d'] + s2['6']
  }
  const itemize = s2 !== null && s2['7'] > standard
  const dThreshold = fs === 'single' || fs === 'mfs' ? 100000 : fs === 'hoh' ? 150000 : 200050
  const deductionRatio = ratio(L['16'] - dThreshold, fs === 'single' || fs === 'mfs' ? 75000 : fs === 'hoh' ? 112500 : 150000)
  const fullDeduction = itemize && s2 ? s2['7'] : standard
  L['17full'] = fullDeduction
  L['17'] = fullDeduction - r(fullDeduction * deductionRatio)
  const eThreshold = fs === 'single' ? 333450 : fs === 'hoh' ? 366750 : fs === 'mfs' ? 200050 : 400100
  const exemptionRatio = ratio(L['16'] - eThreshold, fs === 'mfs' ? 62500 : 125000)
  L['18'] = L['13'] * ME_EXEMPTION - r(L['13'] * ME_EXEMPTION * exemptionRatio)
  L['19'] = pos(L['16'] - L['17'] - L['18'])
  L['20'] = meTax(L['19'], fs)
  L['22'] = L['20']

  // ── Schedule A ──
  const CA: Record<string, number> = {}
  const young = ret.dependents.filter((x) => x.age < 6).length
  const depCredit = (qualifying - young) * 305 + young * 610
  const aThreshold = fs === 'single' ? 100000 : fs === 'hoh' ? 125000 : fs === 'mfs' ? 75000 : 150000
  const over = L['16'] - aThreshold
  CA['1'] = pos(depCredit - (over > 0 ? 20 * Math.ceil(over / 500) : 0))
  const care = ret.dependentCare
  const federalCare = r(res.schedule3.dependentCare)
  let careCredit = 0
  if (federalCare > 0 && care.expenses > 0) {
    const star = Math.min(pos(d.star5Expenses), care.expenses) / care.expenses
    careCredit = r(federalCare * (1 - star) * 0.25 + federalCare * star * 0.5)
  }
  CA['2'] = Math.min(careCredit, 500)
  CA['11'] = careCredit - CA['2']
  const eicKids = ret.dependents.some((x) => x.childRelationship && x.age < 19)
  CA['4'] = r(pos(f['27a']) * (eicKids ? 0.25 : 0.5))
  CA['8'] = r(pos(d.otherRefundableCredits))
  CA['9'] = CA['1'] + CA['2'] + CA['4'] + CA['8']
  const oj = d.otherJurisdiction
  CA['14'] = oj.tax > 0 && oj.income > 0 && L['16'] > 0 ? Math.min(r(pos(oj.tax)), r(L['22'] * Math.min(1, oj.income / L['16']))) : 0
  CA['20'] = r(pos(d.otherNonrefundableCredits))
  CA['21'] = CA['11'] + CA['14'] + CA['20']
  CA['22'] = L['22']
  CA['23'] = Math.min(CA['21'], CA['22'])
  L['23'] = CA['23']
  L['24'] = L['22'] - L['23']

  // ── Schedule PTFC/STFC ──
  const P: Record<string, number> = {}
  const notMfs = fs !== 'mfs'
  P['2a'] = r(f['9'])
  P['2b'] = r(pos(f['6a'] - f['6b']))
  P['2c'] = r(pos(f['2a']))
  P['2d'] = r(pos(-f['7a']) + res.scheduleC.reduce((s, b) => s + pos(-b.netProfit), 0) + pos(-res.scheduleE.net))
  P['3'] = P['2a'] + P['2b'] + P['2c'] + P['2d']
  const anyOld = old.taxpayer || old.spouse
  const ptfcLimit = anyOld ? 102500 : fs === 'single' ? 63750 : fs === 'hoh' ? (qualifying > 1 ? 101250 : 82500) : qualifying >= 1 ? 101250 : 82500
  P['4'] = r(pos(d.propertyTax))
  P['5a'] = r(pos(d.rentPaid))
  P['5c'] = d.rentIncludesUtilities ? (d.rentUtilities === null ? r(P['5a'] * 0.15) : r(pos(d.rentUtilities))) : 0
  P['5d'] = pos(P['5a'] - P['5c'])
  P['5e'] = r(P['5d'] * 0.15)
  P['6'] = P['4'] + P['5e']
  P['7'] = anyOld ? 1 : 0
  P['8'] = anyOld ? 4100 : fs === 'single' ? 2550 : fs === 'hoh' ? (qualifying > 1 ? 4050 : 3300) : qualifying >= 1 ? 4050 : 3300
  P['9'] = Math.min(P['6'], P['8'])
  P['10'] = r(P['3'] * 0.04)
  const ptfcOk = notMfs && P['6'] > 0 && P['3'] < ptfcLimit && P['9'] > P['10']
  P['10a'] = P['9'] > P['10'] ? 1 : 0
  if (ptfcOk) {
    P['11'] = P['9'] - P['10']
    P['12'] = anyOld ? 2000 : 1000
    P['13'] = Math.min(P['11'], P['12'])
    P['14'] = d.veteranDisabled ? 1 : 0
    P['14a'] = d.veteranDisabled ? P['13'] : 0
    P['15'] = P['13'] + P['14a']
    P['16'] = Math.min(P['15'], P['6'])
  } else P['16'] = 0
  P['17'] = notMfs && !dependentFiler ? meSalesTaxCredit(P['3'], fs, qualifying) : 0

  // ── Payments ──
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  L['25a'] = r(w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0) + pos(d.withholdingOther))
  L['25b'] = r(pos(d.estimatedPayments))
  L['25c'] = CA['9']
  L['25d'] = P['16']
  L['25e'] = P['17']
  L['25f'] = L['25a'] + L['25b'] + L['25c'] + L['25d'] + L['25e']
  L['27'] = L['25f']
  const net = pos(L['24'])
  L['28'] = pos(L['27'] - net)
  L['29'] = pos(net - L['27'])
  L['30'] = r(pos(d.useTax))
  L['31'] = r(pos(d.contributions))
  const extra = L['30'] + L['31']
  L['33'] = pos(L['28'] - extra)
  L['34a'] = Math.min(L['33'], r(pos(d.creditForward)))
  L['34b'] = L['33'] - L['34a']
  L['35'] = L['29'] + extra - (L['28'] - L['33'])

  // ── Notes ──
  if (A['11'] > 0) attach.push('Schedule 1A')
  if (S['27'] > 0) attach.push('Schedule 1S')
  if (s2 && itemize) attach.push('Schedule 2')
  if (CA['9'] + CA['21'] > 0) attach.push('Schedule A')
  if (P['16'] + P['17'] > 0) attach.push('Schedule PTFC/STFC')
  if (CA['1'] > 0) attach.push('Dependent Exemption Tax Credit Worksheet (names and birthdates of each dependent)')
  if (careCredit > 0) attach.push('Child Care Credit Worksheet')
  if (CA['4'] > 0) attach.push('Earned Income Tax Credit Worksheet')
  if (CA['14'] > 0) attach.push(`Worksheet for the Credit for Income Tax Paid to Other Jurisdictions and a copy of your ${oj.name.trim() || 'other state'} return`)
  if (S['4'] > 0) attach.push('Copies of the 1099-Rs used for the pension income deduction')
  if (L['25a'] > 0) attach.push('W-2, 1099 and 1099ME forms showing Maine withholding')
  if (L['31'] > 0) attach.push('Schedule CP (charitable contributions and park passes)')
  if (P['14a'] > 0) attach.push('Your VA Rating Decision Letter or VA Benefit Summary Letter')
  if (deductionRatio > 0) issues.push(`Your ${itemize ? 'itemized' : 'standard'} deduction is reduced by ${(deductionRatio * 100).toFixed(2)}% (Maine AGI above ${dThreshold.toLocaleString('en-US')}); enclose the phase-out worksheet.`)
  if (fs === 'mfs') issues.push('Married filing separately: you can’t claim the property or sales tax fairness credits, and both spouses must itemize or both take the standard deduction.')
  if (P['16'] > 0 && !d.birthDates.taxpayer.trim()) issues.push('Schedule PTFC/STFC asks for your date of birth.')
  if (careCredit > 0 && d.star5Expenses > 0) issues.push('Enter the Star 5 provider’s certificate number on the Child Care Credit Worksheet.')
  if (CA['1'] > 0) issues.push('The Dependent Exemption Tax Credit Worksheet lists each dependent’s name and date of birth.')
  if (L['29'] - L['25a'] >= 1000) issues.push('You may owe an underpayment of estimated tax penalty (Form 2210ME, line 32).')
  return { lines: L, s1a: A, s1s: S, pension, pensionRatio, military, s2, sa: CA, ptfc: P, boxes: { old, blind }, deductionRatio, itemize, qualifying, issues, attach }
}
