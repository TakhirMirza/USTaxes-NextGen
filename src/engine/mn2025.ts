/**
 * Minnesota Form M1, full-year resident individual income tax return, tax years 2025 and 2026.
 *
 * Source: 2025 Form M1 and its instructions (standard deduction table, Worksheets A and B for line 4, Worksheet for
 * line 5, tax table on pages 32–38 and the tax rate schedules on page 39), Schedule M1M (Rev. 7/26, with the
 * Social Security subtraction worksheet for line 12 and the charitable worksheet for line 11), Schedule M1REF and
 * Schedule M1CWFC (Rev. 7/26: working family credit 4% of the first $9,480 of earned income plus $1,000/$2,270/
 * $2,710 for qualifying older children; child tax credit $1,750 per qualifying child under 18; reduced by 12% (9%
 * with only older children) of income over $31,950, $37,910 joint). Amounts are whole dollars.
 *
 * 2026 (MN_PARAMS[2026]): the 2026 Form M1 instructions (final draft 10/1/26: standard deduction table, Worksheets A/B
 * for line 4 from $244,400, $5,300 dependent exemption, tax table to $90,000 and the page 39 rate schedules), the 2026
 * Schedule M1SA (final draft 11/4/26: computed in full for 2026, with the new 1% charitable floor and the line 28
 * phaseout), the 2026 Schedule M1M instructions (charitable subtraction: 50% of contributions over 1% of AGI and $500;
 * Social Security thresholds $86,410 / $110,780 / $55,390) and the 2026 Schedule M1CWFC ($9,690 × 4%, $1,800 per
 * child, $1,020 / $2,330 / $2,770 for older children, phaseout from $32,680 / $38,770, investment income under $12,200).
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { currentTaxYear } from './rules.ts'

export interface MnParams {
  standard: Record<MnStatus, { base: number; per: number; maxBoxes: number }>
  /** Dependent standard deduction: the minimum, and the amount added to earned income. */
  dependentMin: number; dependentAdd: number
  /** Worksheets A/B for line 4 (and M1SA line 28): start, the 3% band end, the band width, and the 80% point. */
  limit: { start: number; mid: number; band: number; mfsStart: number; mfsMid: number; mfsBand: number; top: number }
  exemption: number
  exemptionStart: Record<MnStatus, number>
  schedules: Record<MnStatus, number[]>
  tableTop: number
  ss: { start: Record<'joint' | 'single' | 'mfs', number> }
  cwfc: { earnedCap: number; older: [number, number, number]; perChild: number; threshold: { joint: number; other: number }; investmentLimit: number }
}

export const MN_PARAMS: Record<number, MnParams> = {
  2025: {
    standard: {
      single: { base: 14950, per: 2000, maxBoxes: 2 }, hoh: { base: 22500, per: 2000, maxBoxes: 2 },
      mfj: { base: 29900, per: 1550, maxBoxes: 4 }, qss: { base: 29900, per: 1550, maxBoxes: 2 }, mfs: { base: 14950, per: 1550, maxBoxes: 4 }
    },
    dependentMin: 1250, dependentAdd: 350,
    limit: { start: 238950, mid: 330300, band: 91350, mfsStart: 119475, mfsMid: 165150, mfsBand: 45675, top: 1083150 },
    exemption: 5200,
    exemptionStart: { mfj: 358550, qss: 358550, single: 239050, hoh: 298800, mfs: 179275 },
    schedules: { single: [32570, 106990, 198630], mfj: [47620, 189180, 330410], qss: [47620, 189180, 330410], mfs: [23810, 94590, 165205], hoh: [40100, 161130, 264050] },
    tableTop: 86800,
    ss: { start: { joint: 108320, single: 84490, mfs: 54160 } },
    cwfc: { earnedCap: 9480, older: [1000, 2270, 2710], perChild: 1750, threshold: { joint: 37910, other: 31950 }, investmentLimit: 11950 }
  },
  2026: {
    standard: {
      single: { base: 15300, per: 2000, maxBoxes: 2 }, hoh: { base: 23000, per: 2000, maxBoxes: 2 },
      mfj: { base: 30600, per: 1600, maxBoxes: 4 }, qss: { base: 30600, per: 1600, maxBoxes: 2 }, mfs: { base: 15300, per: 1600, maxBoxes: 4 }
    },
    dependentMin: 1300, dependentAdd: 350,
    limit: { start: 244400, mid: 337800, band: 93400, mfsStart: 122200, mfsMid: 168900, mfsBand: 46700, top: 1107750 },
    exemption: 5300,
    exemptionStart: { mfj: 366700, qss: 366700, single: 244500, hoh: 305600, mfs: 183350 },
    schedules: { single: [33310, 109430, 203150], mfj: [48700, 193480, 337930], qss: [48700, 193480, 337930], mfs: [24350, 96740, 168965], hoh: [41010, 164800, 270060] },
    tableTop: 90000,
    ss: { start: { joint: 110780, single: 86410, mfs: 55390 } },
    cwfc: { earnedCap: 9690, older: [1020, 2330, 2770], perChild: 1800, threshold: { joint: 38770, other: 32680 }, investmentLimit: 12200 }
  }
}
/** Minnesota parameters for a tax year (the current one by default). */
export const mnParams = (year: number = currentTaxYear()): MnParams => MN_PARAMS[year] ?? MN_PARAMS[2025]

/** Schedule M1M addition lines an "other addition" item can go on (label → PDF field). The last is the catch-all line 3. */
export const MN_M1M_ADDITION_LINES: [label: string, field: string][] = [
  ['Line 2: tax-exempt mutual fund dividends from other states’ bonds', 'M1Mline2'],
  ['Line 4: capital gain portion of a lump-sum distribution (Form 4972)', 'M1Mline4'],
  ['Line 5: Schedule M1HOME addition', 'M1Mline5'],
  ['Line 6: education savings account distributions for K-12 tuition', 'M1Mline6'],
  ['Line 9: Schedule M1NC addition', 'M1Mline9'],
  ['Line 3: expenses attributable to income not taxed by Minnesota', 'M1Mline3']
]

export type MnStatus = 'single' | 'mfj' | 'mfs' | 'hoh' | 'qss'
const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Standard deduction table for line 4: base and the amount per box (65 or older, blind). */
export const MN_STANDARD = MN_PARAMS[2025].standard
export const MN_DEPENDENT_EXEMPTION = MN_PARAMS[2025].exemption

/** Tax rate schedules (page 39): bracket tops by year, and the rates. */
const RATES = [0.0535, 0.068, 0.0785, 0.0985]
export const MN_TABLE_TOP = MN_PARAMS[2025].tableTop

function scheduleTax(income: number, status: MnStatus, year?: number): number {
  const tops = mnParams(year).schedules[status]
  let tax = 0
  let low = 0
  for (let i = 0; i < RATES.length; i++) {
    const top = i < tops.length ? tops[i] : Infinity
    if (income > low) tax += (Math.min(income, top) - low) * RATES[i]
    low = top
  }
  return tax
}

/** Line 10: the tax table below $86,800 ($90,000 for 2026; $100 rows taxed at their midpoint; $0–20 is 0 and $20–100 uses $60), then the schedules. */
export function mnTax(taxable: number, status: MnStatus, year?: number): number {
  const t = pos(r(taxable))
  if (t >= mnParams(year).tableTop) return r(scheduleTax(t, status, year))
  if (t < 20) return 0
  if (t < 100) return r(scheduleTax(60, status, year))
  const lo = Math.floor(t / 100) * 100
  return r(scheduleTax(lo + 50, status, year))
}

/** Worksheet A/B for line 4: the standard deduction phased down by up to 80% for high incomes. */
export function mnStandardLimit(standard: number, agi: number, status: MnStatus, year?: number): number {
  return r(standard - mnPhaseout(standard, agi, status, year))
}

/** The reduction from Worksheets A/B for line 4 (and M1SA line 28 Worksheets A/B, applied to the deductions that can be reduced). */
export function mnPhaseout(amount: number, agi: number, status: MnStatus, year?: number): number {
  const L = mnParams(year).limit
  const mfs = status === 'mfs'
  const start = mfs ? L.mfsStart : L.start
  if (agi <= start || amount <= 0) return 0
  if (agi > L.top) return amount * 0.8
  const mid = mfs ? L.mfsMid : L.mid
  const s3 = (agi > mid ? (mfs ? L.mfsBand : L.band) : agi - start) * 0.03
  const s5 = (agi > mid ? agi - mid : 0) * 0.1
  return Math.min(s3 + s5, amount * 0.8)
}

/** Worksheet for line 5: $5,200 per dependent, reduced 2% per $2,500 ($1,250 separate) of AGI over the threshold. */
export function mnExemptions(count: number, agi: number, status: MnStatus, year?: number): number {
  const P = mnParams(year)
  const full = count * P.exemption
  const over = agi - P.exemptionStart[status]
  if (over <= 0) return full
  if (over > (status === 'mfs' ? 61250 : 122500)) return 0
  const steps = Math.ceil(over / (status === 'mfs' ? 1250 : 2500))
  return r(full - full * steps * 0.02)
}

/** Schedule M1M Worksheet for line 12: Social Security subtraction. */
export function mnSocialSecurity(res: TaxReturnResult, agi: number, status: MnStatus): number {
  const f = res.f1040
  const taxable = pos(f['6b'])
  if (taxable === 0) return 0
  const joint = status === 'mfj' || status === 'qss'
  const mfs = status === 'mfs'
  const S = mnParams().ss.start
  const start = joint ? S.joint : mfs ? S.mfs : S.single
  if (agi <= start) return r(taxable)
  const steps = Math.min(10, Math.ceil((agi - start) / (mfs ? 2000 : 4000)))
  const simplified = pos(taxable - taxable * steps * 0.1)
  const s11 = pos(f['9']) - taxable
  const s15 = s11 + pos(f['6a']) * 0.5 + pos(f['2a'])
  const s18 = pos(res.schedule1.totalAdjustments - (res.schedule1.adjustments.studentLoanInterest ?? 0))
  const s19 = pos(s15 - s18)
  const s21 = pos(s19 - (joint ? 88630 : mfs ? 44315 : 69250))
  const s24 = pos((joint ? 5840 : mfs ? 2920 : 4560) - s21 * 0.2)
  const alternative = Math.min(s24, taxable)
  return r(Math.max(alternative, simplified))
}

/** Schedule M1CWFC lines 1–15. */
export function mnChildWorkingFamily(agi: number, earned: number, children: number, olderChildren: number, joint: boolean): Record<string, number> {
  const W: Record<string, number> = {}
  W['1'] = r(agi)
  W['2'] = r(pos(earned))
  const C = mnParams().cwfc
  W['3'] = Math.min(W['2'], C.earnedCap)
  W['4'] = r(W['3'] * 0.04)
  W['5'] = olderChildren >= 3 ? C.older[2] : olderChildren === 2 ? C.older[1] : olderChildren === 1 ? C.older[0] : 0
  W['6'] = W['4'] + W['5']
  W['7'] = children
  W['8'] = children * C.perChild
  W['9'] = W['6'] + W['8']
  W['10'] = Math.max(W['1'], W['2'])
  W['11'] = joint ? C.threshold.joint : C.threshold.other
  W['12'] = pos(W['10'] - W['11'])
  W['13'] = W['5'] > 0 && W['8'] === 0 ? 0.09 : 0.12
  W['14'] = W['12'] > 0 ? r(W['12'] * W['13']) : 0
  W['15'] = pos(W['9'] - W['14'])
  return W
}

/**
 * Schedule M1SA (2026 final draft): medical over 10% of AGI, real estate and personal property taxes up to $10,000
 * ($5,000 separate), mortgage interest, charitable contributions over 1% of AGI (cash limited to 60% of AGI), other
 * deductions, and the line 28 phaseout (Worksheet A/B: the 3%/10% reduction, at most 80% of the deductions other than
 * medical, investment interest and casualty losses).
 */
export function mnScheduleM1sa(ret: TaxReturnInput, res: TaxReturnResult, agi: number, status: MnStatus): Record<string, number> {
  const it = ret.itemized
  const S: Record<string, number> = {}
  S['1'] = pos(agi)
  S['2'] = r(pos(it.medical))
  S['3'] = r(S['1'] * 0.1)
  S['4'] = pos(S['2'] - S['3'])
  S['5'] = r(pos(it.realEstateTax))
  S['6'] = r(pos(it.personalPropertyTax))
  S['7'] = S['5'] + S['6']
  S['8'] = Math.min(S['7'], status === 'mfs' ? 5000 : 10000)
  S['9'] = 0
  S['10'] = S['8'] + S['9']
  S['11'] = r(pos(it.mortgageInterest))
  S['12'] = 0; S['13'] = 0
  S['14'] = S['11'] + S['12'] + S['13']
  S['15'] = r(Math.min(pos(it.charityCash), S['1'] * 0.6))
  S['16'] = r(pos(it.charityNonCash))
  S['17'] = 0
  S['18'] = S['15'] + S['16']
  S['19'] = r(S['1'] * 0.01)
  S['20'] = pos(S['18'] - S['19'])
  S['21'] = S['17'] + S['20']
  S['22'] = 0; S['23'] = 0
  S['24'] = S['23'] > 0 ? r(S['1'] * 0.02) : 0
  S['25'] = pos(S['23'] - S['24'])
  S['26'] = r(pos(res.scheduleA.other))
  S['27'] = S['4'] + S['10'] + S['14'] + S['21'] + S['22'] + S['25'] + S['26']
  const reducible = pos(S['27'] - (S['4'] + S['13'] + S['22']))
  S['28'] = r(mnPhaseout(reducible, agi, status))
  S['29'] = pos(S['27'] - S['28'])
  return S
}

export interface MnResult {
  status: MnStatus
  lines: Record<string, number>
  /** Schedule M1M lines. */
  m: Record<string, number>
  /** Schedule M1REF lines. */
  ref: Record<string, number>
  /** Schedule M1CWFC lines. */
  cwfc: Record<string, number>
  /** Schedule M1SA lines 1–29 (2026 on: figured in full), or null. */
  sa: Record<string, number> | null
  deduction: { method: 'standard' | 'itemized'; standard: number; itemized: number; boxes: number }
  dependents: { count: number; children: number; older: number }
  /** Schedule M1DQC rows. */
  dqc: { first: string; last: string; ssn: string; relationship: string; months: number; student: boolean; disabled: boolean; child: boolean; older: boolean }[]
  statements: { owner: Owner; employer: string; ein: string; stateId: string; wages: number; tax: number }[]
  issues: string[]
  attach: string[]
}

export function computeMinnesota(ret: TaxReturnInput, res: TaxReturnResult): MnResult {
  const d = ret.mn
  const f = res.f1040
  const status: MnStatus = ret.filingStatus
  const joint = status === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const M: Record<string, number> = {}
  const REF: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const agi = r(f['11a'])
  const year = currentTaxYear()
  const P = mnParams(year)

  // Federal return lines A–F.
  L['A'] = r(f['1z']); L['B'] = r(pos(f['4b']) + pos(f['5b'])); L['C'] = r(pos(res.schedule1.unemployment))
  L['D'] = r(f['15']); L['E'] = r(pos(f['6a'])); L['F'] = r(pos(f['6b']))

  // ── Schedule M1M additions ──
  M['1'] = r(pos(d.otherStateBondInterest))
  M['3'] = r(pos(d.otherAdditions))
  M['10'] = M['1'] + M['3']
  // ── Deduction (line 4) ──
  const people = owners.map((o) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse))
  const boxes = Math.min(P.standard[status].maxBoxes, people.reduce((s, p) => s + ((p.age65OrOlder || p.age >= 65) ? 1 : 0) + (p.blind ? 1 : 0), 0))
  const table = P.standard[status].base + boxes * P.standard[status].per
  const standard = ret.canBeClaimedAsDependent ? Math.min(Math.max(P.dependentMin, pos(f['1z']) + P.dependentAdd), table) : table
  const standardLimited = mnStandardLimit(standard, agi, status)
  // Minnesota itemized deductions (Schedule M1SA): estimated as federal itemized deductions without state income tax.
  const fedItemized = r(res.deduction.itemized)
  const sa = res.scheduleA
  const incomeTaxShare = sa.saltBeforeCap > 0 ? pos(ret.itemized.stateLocalIncomeOrSalesTax) * Math.min(1, sa.taxes / sa.saltBeforeCap) : 0
  // From 2026, Schedule M1SA is figured line by line (no deduction for income or sales tax; property taxes capped at $10,000).
  const SA = year >= 2026 ? mnScheduleM1sa(ret, res, agi, status) : null
  const itemized = d.itemized !== null ? r(pos(d.itemized)) : SA ? SA['29'] : fedItemized > 0 ? r(pos(fedItemized - incomeTaxShare)) : 0
  const itemizes = (status === 'mfs' && d.spouseItemizes) || itemized > standardLimited
  L['1'] = agi
  L['2'] = M['10']
  L['3'] = L['1'] + L['2']
  L['4'] = itemizes ? itemized : standardLimited
  // ── Exemptions (line 5) ──
  const depCount = ret.canBeClaimedAsDependent ? 0 : ret.dependents.length
  L['5'] = ret.canBeClaimedAsDependent ? 0 : mnExemptions(depCount, agi, status)
  L['6'] = r(pos(d.stateRefundInFagi))
  // ── Schedule M1M subtractions ──
  const charity = pos(ret.itemized.charityCash) + pos(ret.itemized.charityNonCash)
  // Charitable subtraction for non-itemizers (2025 M1M line 11; 2026 line 13: contributions over 1% of AGI first).
  M['11'] = itemizes ? 0 : r(pos((year >= 2026 ? pos(charity - pos(agi) * 0.01) : charity) - 500) * 0.5)
  M['12'] = mnSocialSecurity(res, agi, status)
  M['13'] = r(pos(d.k12Expenses))
  M['14'] = r(pos(d.usObligationInterest))
  M['15'] = r(pos(d.contributions529))
  M['20'] = r(pos(d.activeMilitaryPay))
  M['25'] = r(pos(d.militaryPension))
  M['35'] = 0
  M['38'] = r(pos(d.otherSubtractions))
  M['40'] = M['11'] + M['12'] + M['13'] + M['14'] + M['15'] + M['20'] + M['25'] + M['38']
  L['7'] = M['40']
  L['8'] = L['4'] + L['5'] + L['6'] + L['7']
  L['9'] = pos(L['3'] - L['8'])
  // ── Tax (lines 10–19) ──
  L['10'] = mnTax(L['9'], status)
  L['11'] = 0
  L['12'] = L['10'] + L['11']
  L['13'] = L['12']
  L['14a'] = 0; L['14b'] = 0
  L['15'] = L['13'] + L['14a'] + L['14b']
  L['16'] = Math.min(r(pos(d.nonrefundableCredits)), L['15'])
  L['17'] = pos(L['15'] - L['16'])
  L['18'] = r(pos(d.nongame))
  L['19'] = L['17'] + L['18']

  // ── Refundable credits: Schedule M1CWFC (qualifying children from Schedule M1DQC) ──
  const lived = (x: TaxReturnInput['dependents'][number]): boolean => x.monthsLivedWithYou > 6
  const isChild = (x: TaxReturnInput['dependents'][number]): boolean => x.childRelationship && x.age < 18 && lived(x)
  const isOlder = (x: TaxReturnInput['dependents'][number]): boolean => x.childRelationship && lived(x) && x.age >= 18 && (x.age < 19 || (x.student && x.age < 24) || x.disabled)
  const children = ret.dependents.filter(isChild).length
  const older = ret.dependents.filter(isOlder).length
  const dqc = ret.dependents.map((x) => {
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    return { first: parts.join(' '), last, ssn: x.ssn, relationship: x.relationship.trim(), months: x.monthsLivedWithYou, student: x.student && x.age >= 18 && x.age < 24, disabled: x.disabled, child: isChild(x), older: isOlder(x) }
  })
  const earned = Math.max(pos(f['1z']), pos(res.eic.earnedIncome))
  const investment = pos(f['2b']) + pos(f['3b']) + pos(f['2a']) + pos(f['7a'])
  const cwfcEligible = !ret.canBeClaimedAsDependent && status !== 'mfs' && investment < P.cwfc.investmentLimit && (children + older > 0 || people.some((p) => p.age >= 19 && p.age <= 64))
  const CW = cwfcEligible ? mnChildWorkingFamily(agi, earned, children, older, joint) : mnChildWorkingFamily(agi, 0, 0, 0, joint)
  if (!cwfcEligible) CW['15'] = 0
  REF['2'] = CW['15']
  REF['2a'] = cwfcEligible ? children : 0
  REF['2b'] = cwfcEligible ? older : 0
  REF['13'] = r(pos(d.refundableCredits))
  REF['14'] = REF['2'] + REF['13']
  // ── Payments and balance (lines 20–30) ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, ein: x?.ein ?? '', stateId: x?.stateId ?? '', wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  })
  L['20'] = statements.reduce((s, x) => s + x.tax, 0) + r(pos(d.withholding1099))
  L['21'] = r(pos(d.estimatedPayments))
  L['22'] = REF['14']
  L['23'] = L['20'] + L['21'] + L['22']
  L['24'] = pos(L['23'] - L['19'])
  L['26'] = pos(L['19'] - L['23'])
  L['30'] = Math.min(r(pos(d.creditForward)), L['24'])
  L['29'] = L['30'] > 0 ? L['24'] - L['30'] : 0

  // ── Notes ──
  attach.push('Schedule M1DQC (dependents and qualifying children)')
  if (L['20'] > 0) attach.push('Schedule M1W (Minnesota tax withheld) with your W-2s and 1099s')
  if (itemizes) attach.push('Schedule M1SA (Minnesota itemized deductions)')
  if (L['2'] > 0 || L['7'] > 0) attach.push('Schedule M1M')
  if (L['22'] > 0) attach.push('Schedule M1REF')
  if (REF['2'] > 0) attach.push('Schedule M1CWFC')
  if (L['16'] > 0) attach.push('Schedule M1C (nonrefundable credits)')
  if (M['15'] > 0) attach.push('Schedule M1529 (529 plan subtraction)')
  attach.push(`A copy of your ${year} federal return and schedules`)
  if (itemizes && d.itemized === null && !SA) issues.push(`Minnesota itemized deductions are estimated at ${itemized.toLocaleString('en-US')} (federal itemized deductions without state income tax). Complete Schedule M1SA and enter its total for an exact figure.`)
  if (joint && ret.w2s.some((w) => w.owner === 'spouse') && ret.w2s.some((w) => w.owner === 'taxpayer')) {
    issues.push('Two-earner couples may get the Marriage Credit (Schedule M1C); enter it under nonrefundable credits.')
  }
  if (res.schedule2.amt > 0) issues.push('You owe federal alternative minimum tax; Minnesota may have its own (Schedule M1MT), which is not figured here.')
  if (ret.dependentCare.expenses > 0) issues.push('Minnesota’s Child and Dependent Care Credit (Schedule M1CD) is refundable for lower incomes; enter it under other refundable credits.')
  if (people.some((p) => p.age >= 65) && agi < 42000) issues.push('At 65 or older with low income you may qualify for the Schedule M1R subtraction (enter it under other subtractions).')
  if (agi < 75000) issues.push('Renters with lower incomes may get the Renter’s Credit (Schedule M1RENT, on M1REF line 4).')
  if (statements.some((x) => x.tax > 0 && !x.ein)) issues.push('Schedule M1W asks for each employer’s ID: enter it with the W-2 details.')
  if (L['26'] > 500 && L['21'] === 0) issues.push('A balance due may mean an estimated tax penalty (Schedule M15).')
  if (!cwfcEligible && children > 0 && investment >= P.cwfc.investmentLimit) issues.push(`Investment income is $${P.cwfc.investmentLimit.toLocaleString('en-US')} or more, so the Child and Working Family Credits may not apply (see the M1CWFC instructions).`)

  return {
    status, lines: L, m: M, ref: REF, cwfc: CW, sa: SA,
    deduction: { method: itemizes ? 'itemized' : 'standard', standard: standardLimited, itemized, boxes },
    dependents: { count: depCount, children, older }, dqc, statements, issues, attach
  }
}
