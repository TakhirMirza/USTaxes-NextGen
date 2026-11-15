/**
 * Georgia Form 500, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Form 500 (Rev. 07/09/25) and the 2025 IT-511 Individual Income Tax Booklet: flat 5.19%, standard
 * deduction $12,000 ($24,000 married filing jointly), $4,000 per dependent (including unborn dependents),
 * Schedule 1 additions and subtractions, the retirement income exclusion ($35,000 at 62–64 or disabled,
 * $65,000 at 65 or older, of which up to $5,000 may be earned income), the military retirement exclusion
 * under 62 ($17,500 plus $17,500 more with over $17,500 of Georgia earned income), the Low Income Credit
 * Worksheet, the Georgia Eligible Itemizer Tax Credit ($300 per taxpayer, O.C.G.A. 48-7-27.1) and IND-CR 202
 * (50% of the federal child and dependent care credit). Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

export const GA_RATE = 0.0519
export const GA_STANDARD = { single: 12000, mfs: 12000, hoh: 12000, qss: 12000, mfj: 24000 } as const
export const GA_DEPENDENT = 4000
export const GA_RETIREMENT = { under65: 35000, over65: 65000, earnedMax: 5000, age: 62 }
export const GA_MILITARY = { base: 17500, additional: 17500, earnedThreshold: 17500 }
export const GA_ITEMIZER_CREDIT = 300
export const GA_CARE_RATE = 0.5
export const GA_DONATION_LINES = ['32', '33', '34', '35', '36', '37', '38', '39', '40', '41'] as const

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Low Income Credit Worksheet table: credit per exemption by federal AGI (none at $20,000 or more). */
export function gaLowIncomePer(fagi: number): number {
  if (fagi < 6000) return 26
  if (fagi < 8000) return 20
  if (fagi < 10000) return 14
  if (fagi < 15000) return 8
  if (fagi < 20000) return 5
  return 0
}

export interface GaRetirementPerson {
  owner: Owner; eligible: boolean; disabledOnly: boolean
  /** Schedule 1 page 2, lines 1–17. */ lines: Record<string, number>
  exclusion: number
  military: { lines: Record<string, number>; exclusion: number }
}

export interface GaResult {
  lines: Record<string, number>
  schedule1: Record<string, number>
  retirement: Record<Owner, GaRetirementPerson>
  deduction: { method: 'standard' | 'itemized'; standard: number; itemized: number }
  lowIncome: { exemptions: number; per: number }
  indCr: { care: number; other: number; total: number }
  statements: { owner: Owner; employer: string; ein: string; stateId: string; wages: number; tax: number }[]
  issues: string[]
  attach: string[]
}

export function computeGeorgia(ret: TaxReturnInput, res: TaxReturnResult): GaResult {
  const d = ret.ga
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const S: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = r(f['11a'])

  // ── Retirement income exclusion (Schedule 1 page 2) and military exclusion (page 3), per person ──
  const share = joint ? 0.5 : 1
  const wagesOf = (o: Owner): number => ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + w.wages, 0)
  const businessOf = (o: Owner): number => res.scheduleC.filter((c) => c.owner === o).reduce((s, c) => s + c.netProfit, 0)
  const retirementOf = (o: Owner): { ira: number; pension: number } => ret.retirement.filter((x) => x.owner === o).reduce(
    (s, x) => (x.ira ? { ...s, ira: s.ira + pos(x.taxableAmount) } : { ...s, pension: s.pension + pos(x.taxableAmount) }), { ira: 0, pension: 0 })
  const person = (o: Owner): GaRetirementPerson => {
    const p = o === 'taxpayer' ? ret.taxpayer : ret.spouse
    const age = p.age || (p.age65OrOlder ? 65 : 0)
    const disabled = d.disabled[o]
    const military = r(pos(d.militaryRetirement[o]))
    // Military retirement exclusion: only under 62.
    const m: Record<string, number> = {}
    let milExcl = 0
    if (military > 0 && age < GA_RETIREMENT.age) {
      m['1'] = military
      m['2'] = GA_MILITARY.base
      m['3'] = Math.min(m['1'], m['2'])
      m['4'] = r(wagesOf(o))
      m['5'] = r(businessOf(o))
      m['6'] = m['4'] + m['5']
      if (m['1'] > GA_MILITARY.base && m['6'] > GA_MILITARY.earnedThreshold) {
        m['7'] = GA_MILITARY.base + GA_MILITARY.additional
        m['8'] = Math.min(m['1'], m['7'])
        milExcl = m['8']
      } else milExcl = m['3']
    }
    const eligible = age >= GA_RETIREMENT.age || disabled
    const L2: Record<string, number> = {}
    let exclusion = 0
    if (eligible) {
      const ret1 = retirementOf(o)
      L2['1'] = r(wagesOf(o))
      L2['2'] = r(businessOf(o))
      L2['3'] = L2['1'] + L2['2']
      L2['4'] = GA_RETIREMENT.earnedMax
      L2['5'] = pos(Math.min(L2['3'], L2['4']))
      L2['6'] = r(f['2b'] * share)
      L2['7'] = r(f['3b'] * share)
      L2['8'] = 0
      L2['9'] = r(f['7a'] * share)
      L2['10'] = r(res.schedule1.otherIncome * share)
      L2['11'] = r(ret1.ira)
      L2['12'] = r(pos(ret1.pension - milExcl))
      L2['13'] = r(res.schedule1.rentalIncome * share)
      L2['14'] = pos(L2['6'] + L2['7'] + L2['8'] + L2['9'] + L2['10'] + L2['11'] + L2['12'] + L2['13'])
      L2['15'] = L2['5'] + L2['14']
      L2['16'] = age >= 65 ? GA_RETIREMENT.over65 : GA_RETIREMENT.under65
      L2['17'] = Math.min(L2['15'], L2['16'])
      exclusion = L2['17']
    }
    return { owner: o, eligible, disabledOnly: eligible && age < GA_RETIREMENT.age, lines: L2, exclusion, military: { lines: m, exclusion: milExcl } }
  }
  const tp = person('taxpayer')
  const sp = joint ? person('spouse') : { owner: 'spouse' as Owner, eligible: false, disabledOnly: false, lines: {}, exclusion: 0, military: { lines: {}, exclusion: 0 } }

  // ── Schedule 1 ──
  S['1'] = r(pos(d.otherStateBondInterest))
  S['2'] = 0
  S['3'] = 0
  S['4'] = 0
  S['5'] = r(pos(d.otherAdditions))
  S['6'] = S['1'] + S['2'] + S['3'] + S['4'] + S['5']
  S['7a'] = tp.disabledOnly ? 0 : tp.exclusion
  S['7b'] = tp.military.exclusion
  S['7c'] = tp.disabledOnly ? tp.exclusion : 0
  S['7d'] = sp.disabledOnly ? 0 : sp.exclusion
  S['7e'] = sp.military.exclusion
  S['7f'] = sp.disabledOnly ? sp.exclusion : 0
  S['8'] = r(f['6b'])
  S['9'] = r(pos(d.path2College))
  S['10'] = r(pos(d.usObligationInterest))
  S['11'] = 0
  S['12'] = r(pos(d.otherSubtractions))
  S['13'] = S['7a'] + S['7b'] + S['7c'] + S['7d'] + S['7e'] + S['7f'] + S['8'] + S['9'] + S['10'] + S['11'] + S['12']
  S['14'] = S['6'] - S['13']

  // ── Income and deductions ──
  L['8'] = fagi
  L['9'] = S['14']
  L['10'] = L['8'] + L['9']
  const standard = GA_STANDARD[fs]
  const itemizes = res.deduction.used === 'itemized' || (fs === 'mfs' && d.spouseItemizes)
  const federalItemized = r(res.deduction.itemized)
  if (itemizes) {
    L['12a'] = federalItemized
    L['12b'] = Math.min(r(pos(d.itemizedAdjustment)), L['12a'])
    L['12c'] = L['12a'] - L['12b']
    L['11'] = 0
  } else {
    L['11'] = standard
    L['12a'] = 0; L['12b'] = 0; L['12c'] = 0
  }
  L['13'] = L['10'] - (itemizes ? L['12c'] : L['11'])
  L['7a'] = ret.dependents.length
  L['7b'] = Math.max(0, Math.floor(d.unbornDependents))
  L['7c'] = L['7a'] + L['7b']
  L['14'] = L['7c'] * GA_DEPENDENT
  L['15a'] = L['13'] - L['14']
  L['15b'] = 0
  L['15c'] = L['15a'] - L['15b']
  L['16'] = r(pos(L['15c']) * GA_RATE)

  // ── Credits, each limited to the tax that is left ──
  let left = L['16']
  const use = (n: number): number => { const u = Math.min(pos(n), left); left -= u; return u }
  const older = (p: TaxReturnInput['taxpayer']): boolean => p.age65OrOlder || p.age >= 65
  const lowIncomeOk = fagi < 20000 && !ret.canBeClaimedAsDependent
  const children = ret.dependents.filter((x) => x.childRelationship).length
  const exemptions = lowIncomeOk ? 1 + (joint ? 1 : 0) + children + (older(ret.taxpayer) ? 1 : 0) + (joint && older(ret.spouse) ? 1 : 0) : 0
  const per = lowIncomeOk ? gaLowIncomePer(fagi) : 0
  L['17a'] = exemptions
  L['17b'] = per
  L['17'] = use(exemptions * per)
  L['18'] = use(r(d.otherStateCredit))
  L['19'] = use(itemizes ? GA_ITEMIZER_CREDIT * owners.length : 0)
  const care = r(pos(res.schedule3.dependentCare) * GA_CARE_RATE)
  const indCrTotal = care + r(pos(d.otherIndCr))
  L['20'] = use(indCrTotal)
  L['21'] = use(r(d.schedule2Credits))
  L['22'] = L['17'] + L['18'] + L['19'] + L['20'] + L['21']
  L['23'] = pos(L['16'] - L['22'])

  // ── Payments ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, ein: x?.ein ?? '', stateId: x?.stateId ?? '', wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  })
  L['24'] = statements.reduce((s, x) => s + x.tax, 0) + r(pos(d.withholding1099))
  L['25'] = r(pos(d.otherWithholding))
  L['26'] = r(pos(d.estimatedPayments))
  L['27'] = 0
  L['28'] = L['24'] + L['25'] + L['26'] + L['27']
  L['29'] = pos(L['23'] - L['28'])
  L['30'] = pos(L['28'] - L['23'])
  L['31'] = Math.min(r(pos(d.creditForward)), L['30'])
  for (const k of GA_DONATION_LINES) L[k] = r(pos(d.donations[k] ?? 0))
  const donations = GA_DONATION_LINES.reduce((s, k) => s + L[k], 0)
  L['42'] = 0; L['43'] = 0; L['44'] = 0
  if (L['29'] > 0) { L['45'] = L['29'] + donations; L['46'] = 0 } else {
    const net = L['30'] - L['31'] - donations
    L['46'] = pos(net)
    L['45'] = pos(-net)
  }

  // ── Notes ──
  if (S['6'] !== 0 || S['13'] !== 0) attach.push('Form 500 Schedule 1 (adjustments to income)')
  if (S['7a'] + S['7c'] + S['7d'] + S['7f'] > 0) attach.push('Schedule 1 page 2 (retirement income exclusion)')
  if (S['7b'] + S['7e'] > 0) attach.push('Schedule 1 page 3 (military retirement income exclusion)')
  if (fagi >= 40000) attach.push('Copy of federal Form 1040 pages 1 and 2 and Schedule 1 (federal AGI is $40,000 or more)')
  if (itemizes) attach.push('Copy of federal Schedule A')
  if (L['24'] > 0) attach.push('W-2s and 1099s showing Georgia tax withheld')
  if (L['20'] > 0) attach.push('Form IND-CR 202 and the IND-CR Summary Worksheet')
  if (L['18'] > 0) attach.push('Copy of the other state’s return (credit for tax paid to other states)')
  if (L['21'] > 0) issues.push('Schedule 2 credits (series 100) can only be claimed on an electronically filed return.')
  if (itemizes && L['19'] > 0) issues.push(`You itemize, so the Georgia Eligible Itemizer Tax Credit applies: $${GA_ITEMIZER_CREDIT} per taxpayer (${L['19'].toLocaleString('en-US')}).`)
  if (res.deduction.used === 'itemized' && res.scheduleA.saltCap > 0 && L['12b'] === 0) issues.push('If your federal state and local tax deduction includes income tax paid to another state, enter the disallowed part on line 12b (IT-511 formula).')
  for (const x of [tp, sp]) {
    if (x.exclusion > 0 || x.military.exclusion > 0) {
      const who = x.owner === 'taxpayer' ? 'You' : 'Your spouse'
      if (!d.birthDate[x.owner]) issues.push(`${who}: Georgia requires the date of birth for the retirement income exclusion.`)
    }
  }
  if (joint && (tp.exclusion > 0 || sp.exclusion > 0) && (f['2b'] + f['3b'] + f['7a'] !== 0)) issues.push('Interest, dividends, capital gains and rents are split 50/50 between spouses for the retirement exclusion. If an item belongs to one spouse only, adjust Schedule 1 page 2.')
  if ((ret.dependents.length > 4)) issues.push('More than four dependents: attach a list of the additional dependents.')
  if (lowIncomeOk && fs === 'mfs') issues.push('Married filing separately: the Low Income Credit is limited to what a joint return would allow.')
  if (ret.dependents.length > 0 && L['7b'] === 0) issues.push('Unborn dependents (a detectable heartbeat by December 31) count on line 7b; a child born in 2025 is on line 7a.')
  if (statements.some((x) => !x.ein)) issues.push('Enter each W-2’s federal employer ID and Georgia withholding ID for the income statement section.')
  if (L['29'] > 0 && L['26'] === 0 && L['29'] > 1000) issues.push('A balance due over $1,000 may mean an estimated tax penalty (Form 500 UET).')

  return {
    lines: L, schedule1: S, retirement: { taxpayer: tp, spouse: sp },
    deduction: { method: itemizes ? 'itemized' : 'standard', standard, itemized: federalItemized },
    lowIncome: { exemptions, per }, indCr: { care, other: r(pos(d.otherIndCr)), total: indCrTotal },
    statements, issues, attach
  }
}
