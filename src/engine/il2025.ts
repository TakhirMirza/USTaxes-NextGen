/**
 * Illinois Form IL-1040, full-year resident income tax return, tax year 2025.
 *
 * Source: 2025 IL-1040 and its instructions (exemption chart and income exceptions, UT Table), Schedule M
 * and Schedule IL-E/EITC with their instructions (dependent exemption, Illinois EITC at 20% of the federal
 * credit, the Illinois Expanded EITC worksheet for filers outside the federal age range, Child Tax Credit at
 * 40% of the Illinois EITC for a dependent child under 12). Flat rate 4.95%. Amounts are whole dollars.
 */
import type { TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { eicChild, eicFromTable } from './compute.ts'
import * as R from './rules.ts'

export const IL_RATE = 0.0495
export const IL_EXEMPTION = 2850
export const IL_EXTRA_EXEMPTION = 1000
export const IL_EXEMPTION_AGI_LIMIT = { joint: 500000, other: 250000 }
export const IL_EITC_RATE = 0.2
export const IL_CTC_RATE = 0.4
export const IL_COLLEGE_SAVINGS_MAX = { single: 10000, joint: 20000 }

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** UT Table: estimated use tax by federal AGI. */
export function ilUseTaxTable(agi: number): number {
  const rows: [number, number][] = [[10000, 3], [20000, 8], [30000, 13], [40000, 18], [50000, 23], [75000, 31], [100000, 44]]
  for (const [lim, tax] of rows) if (agi <= lim) return tax
  return r(agi * 0.0005)
}

export interface IlResult {
  lines: Record<string, number>
  exemptions: { base: number; over65: number; blind: number; dependents: number; dependentCount: number; limited: boolean }
  scheduleM: { additions: number; collegeSavings: number; usInterest: number; otherSubtractions: number; subtractions: number }
  eitc: { federal: number; expanded: boolean; credit: number; ctc: number; childUnder12: boolean }
  issues: string[]
  attach: string[]
}

export function computeIllinois(ret: TaxReturnInput, res: TaxReturnResult): IlResult {
  const d = ret.il
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = r(f['11a'])

  // ── Income ──
  L['1'] = fagi
  L['2'] = r(f['2a'])
  const smAdditions = r(pos(d.otherAdditions))
  L['3'] = smAdditions
  L['4'] = L['1'] + L['2'] + L['3']
  L['5'] = r(f['4b'] + f['5b'] + f['6b'])
  L['6'] = r(pos(d.stateRefundInFagi))
  const college = Math.min(r(pos(d.collegeSavings)), joint ? IL_COLLEGE_SAVINGS_MAX.joint : IL_COLLEGE_SAVINGS_MAX.single)
  const usInterest = r(pos(d.usObligationInterest))
  const otherSub = r(pos(d.otherSubtractions))
  L['7'] = college + usInterest + otherSub
  L['8'] = L['5'] + L['6'] + L['7']
  L['9'] = L['4'] - L['8']

  // ── Exemptions ──
  const youDep = ret.canBeClaimedAsDependent
  const spouseDep = false // the return records one "can be claimed" answer; for a joint return it is treated as one spouse
  let base: number
  if (!joint) base = !youDep ? IL_EXEMPTION : L['9'] <= IL_EXEMPTION ? IL_EXEMPTION : 0
  else if (!youDep && !spouseDep) base = 2 * IL_EXEMPTION
  else if (youDep && spouseDep) base = L['9'] <= 2 * IL_EXEMPTION ? 2 * IL_EXEMPTION : 0
  else base = L['9'] <= IL_EXEMPTION ? 2 * IL_EXEMPTION : IL_EXEMPTION
  const older = (p: TaxReturnInput['taxpayer']): boolean => p.age65OrOlder || p.age >= 65
  const over65Count = (older(ret.taxpayer) ? 1 : 0) + (joint && older(ret.spouse) ? 1 : 0)
  const blindCount = (ret.taxpayer.blind ? 1 : 0) + (joint && ret.spouse.blind ? 1 : 0)
  const dependentCount = ret.dependents.length
  const limited = fagi > (joint ? IL_EXEMPTION_AGI_LIMIT.joint : IL_EXEMPTION_AGI_LIMIT.other)
  L['10a'] = limited ? 0 : base
  L['10b'] = limited ? 0 : over65Count * IL_EXTRA_EXEMPTION
  L['10c'] = limited ? 0 : blindCount * IL_EXTRA_EXEMPTION
  L['10d'] = limited ? 0 : dependentCount * IL_EXEMPTION
  L['10'] = L['10a'] + L['10b'] + L['10c'] + L['10d']

  // ── Tax ──
  L['11'] = pos(L['9'] - L['10'])
  L['12'] = r(L['11'] * IL_RATE)
  L['13'] = 0
  L['14'] = L['12'] + L['13']
  L['15'] = r(pos(d.otherStateCredit))
  L['16'] = r(pos(d.icrCredit))
  L['17'] = r(pos(d.otherCredits))
  L['18'] = Math.min(L['15'] + L['16'] + L['17'], L['14'])
  L['19'] = L['14'] - L['18']
  L['20'] = 0
  L['21'] = d.useTaxTable ? ilUseTaxTable(fagi) : r(pos(d.useTax))
  L['22'] = 0
  L['23'] = L['19'] + L['20'] + L['21'] + L['22']
  L['24'] = L['23']

  // ── Illinois EITC and Child Tax Credit ──
  let federal = r(res.eic.credit)
  let expanded = false
  const reasons = res.eic.notEligibleBecause
  const ageOnly = reasons.length > 0 && reasons.every((x) => x.startsWith('without a qualifying child'))
  if (federal === 0 && ageOnly && res.eic.earnedIncome > 0 && [ret.taxpayer, ...(joint ? [ret.spouse] : [])].some((p) => p.age >= 18)) {
    // Illinois Expanded EITC worksheet: the federal EITC figured without the age rule (no qualifying child).
    const start = (joint ? R.EIC_PHASEOUT_START_JOINT : R.EIC_PHASEOUT_START_OTHER)[0]
    const earned = r(res.eic.earnedIncome)
    const byEarned = eicFromTable(earned, 0, start)
    federal = fagi === earned || fagi < start ? byEarned : Math.min(byEarned, eicFromTable(fagi, 0, start))
    expanded = federal > 0
  }
  L['29'] = r(federal * IL_EITC_RATE)
  const childUnder12 = ret.dependents.some((x) => x.childRelationship && x.age < 12)
  L['30'] = L['29'] > 0 && childUnder12 ? r(L['29'] * IL_CTC_RATE) : 0

  // ── Payments ──
  L['25'] = r(pos(d.withholding))
  L['26'] = r(pos(d.estimatedPayments))
  L['27'] = r(pos(d.passThroughWithholding))
  L['28'] = 0
  L['31'] = L['25'] + L['26'] + L['27'] + L['28'] + L['29'] + L['30']
  L['32'] = pos(L['31'] - L['24'])
  L['33'] = pos(L['24'] - L['31'])
  L['34'] = 0
  L['35'] = r(pos(d.donations))
  L['36'] = L['34'] + L['35']
  L['37'] = L['32'] > L['36'] ? L['32'] - L['36'] : 0
  L['40'] = Math.min(r(pos(d.creditForward)), L['37'])
  L['38'] = L['37'] - L['40']
  L['41'] = L['33'] > 0 ? L['33'] + L['36'] : L['32'] < L['36'] ? L['36'] - L['32'] : 0

  // ── Notes ──
  if (L['3'] > 0 || L['7'] > 0) attach.push('Schedule M, other additions and subtractions')
  if (L['10d'] > 0 || L['29'] > 0) attach.push('Schedule IL-E/EITC, exemptions and earned income credit')
  if (L['29'] > 0) attach.push('Copy of pages 1 and 2 of your federal Form 1040 (for the Illinois EITC)')
  if (L['5'] > 0) attach.push('Copy of your federal Form 1040 (for the retirement and Social Security subtraction)')
  if (L['15'] > 0) attach.push('Schedule CR, credit for tax paid to other states')
  if (L['16'] > 0) attach.push('Schedule ICR, property tax and K-12 education expense credits')
  if (L['17'] > 0) attach.push('Schedule 1299-C')
  if (L['25'] > 0) attach.push('Schedule IL-WIT, Illinois income tax withheld')
  if (limited) issues.push(`Federal AGI is over $${(joint ? IL_EXEMPTION_AGI_LIMIT.joint : IL_EXEMPTION_AGI_LIMIT.other).toLocaleString('en-US')}, so no exemption allowance is allowed.`)
  if (L['5'] > 0) issues.push(`Illinois does not tax Social Security or qualified retirement income: ${L['5'].toLocaleString('en-US')} is subtracted on line 5.`)
  if (expanded) issues.push('You do not meet the federal EITC age rule, but Illinois allows its EITC from age 18 (Illinois Expanded EITC worksheet).')
  if (ret.itemized.realEstateTax > 0 && L['16'] === 0 && !limited) issues.push('Illinois gives a credit of 5% of property tax paid on your main home (Schedule ICR). Enter it on line 16.')
  if (otherSub > 0) issues.push('Enter your other subtractions on the matching lines of Schedule M.')
  if (ret.dependents.some((x) => !d.dependentBirthDates[x.id])) issues.push('Schedule IL-E/EITC asks for each dependent’s date of birth.')
  if (L['33'] > 1000 && L['26'] === 0) issues.push('If you owe more than $1,000, Illinois may charge a late-payment penalty for underpaying estimated tax (Form IL-2210).')

  return {
    lines: L,
    exemptions: { base: L['10a'], over65: L['10b'], blind: L['10c'], dependents: L['10d'], dependentCount, limited },
    scheduleM: { additions: smAdditions, collegeSavings: college, usInterest, otherSubtractions: otherSub, subtractions: L['7'] },
    eitc: { federal, expanded, credit: L['29'], ctc: L['30'], childUnder12 },
    issues, attach
  }
}

/** Dependents that are qualifying children for the Illinois EITC (the federal tests). */
export const ilEitcChild = eicChild
