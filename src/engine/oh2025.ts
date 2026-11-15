/**
 * Ohio Form IT 1040, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Ohio IT 1040 / SD 100 instructions booklet: tax brackets (0% to $26,050, $342 plus 2.75% to
 * $100,000, $2,394.32 plus 3.125% above), exemption amount by modified AGI ($2,400 / $2,150 / $1,900 / $0),
 * Schedule of Adjustments, Schedule of Business Income (deduction of the first $250,000, $125,000 married
 * filing separately; the rest taxed at a flat 3%), Schedule of Credits (retirement income credit Table 2,
 * $50 senior citizen credit, child and dependent care credit worksheet, $20 exemption credit, joint filing
 * credit table up to $650, Ohio earned income credit at 30% of the federal credit). Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { k1Activity } from './k1.ts'

export const OH_BRACKETS = { zeroTo: 26050, middleTo: 100000, middleBase: 342, middleRate: 0.0275, topBase: 2394.32, topRate: 0.03125 }
export const OH_BUSINESS = { deduction: 250000, deductionMfs: 125000, rate: 0.03 }
export const OH_DONATION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Nonbusiness income tax on IT 1040 line 7. */
export function ohTax(x: number): number {
  const b = OH_BRACKETS
  if (x <= b.zeroTo) return 0
  if (x <= b.middleTo) return r(b.middleBase + (x - b.zeroTo) * b.middleRate)
  return r(b.topBase + (x - b.middleTo) * b.topRate)
}

/** Exemption amount per exemption by modified adjusted gross income. */
export function ohExemption(magi: number): number {
  if (magi <= 40000) return 2400
  if (magi <= 80000) return 2150
  if (magi < 750000) return 1900
  return 0
}

/** Table 2: retirement income credit by retirement income in Ohio AGI. */
export function ohRetirementCredit(income: number): number {
  if (income <= 500) return 0
  if (income <= 1500) return 25
  if (income <= 3000) return 50
  if (income <= 5000) return 80
  if (income <= 8000) return 130
  return 200
}

/** Joint filing credit percentage by MAGI less exemptions. */
export function ohJointPercent(mle: number): number {
  if (mle <= 25000) return 0.2
  if (mle <= 50000) return 0.15
  if (mle <= 75000) return 0.1
  return 0.05
}

/** 1099-R codes that are not received on account of retirement (early, rollover-type and corrective). */
const NOT_RETIREMENT = /^(1|2|8|J|P|S|E)/i

export interface OhResult {
  lines: Record<string, number>
  adjustments: Record<string, number>
  business: Record<string, number>
  credits: Record<string, number>
  magi: number
  exemptionCount: number
  mle: number
  jointPercent: number
  withholding: { w2: { owner: Owner; employer: string; ein: string; stateId: string; wages: number; ohWages: number; federal: number; tax: number }[]; r1099: { owner: Owner; payer: string; ein: string; stateId: string; gross: number; code: string; federal: number; tax: number; total: boolean }[] }
  issues: string[]
  attach: string[]
}

export function computeOhio(ret: TaxReturnInput, res: TaxReturnResult): OhResult {
  const d = ret.oh
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const A: Record<string, number> = {}
  const B: Record<string, number> = {}
  const C: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  L['1'] = r(f['11a'])

  // ── Schedule of Business Income ──
  const k1s = ret.k1s.filter((k) => owners.includes(k.owner) && k.materialParticipation)
  B['1'] = 0
  B['2'] = r(res.scheduleC.filter((c) => owners.includes(c.owner)).reduce((s, c) => s + c.netProfit, 0))
  B['3'] = 0
  B['4'] = r(k1s.reduce((s, k) => s + k1Activity(k), 0))
  B['5'] = r(k1s.reduce((s, k) => s + pos(k.guaranteedPayments), 0))
  B['6'] = 0; B['7'] = 0; B['8'] = 0
  B['9'] = r(d.otherBusinessIncome)
  B['10'] = B['1'] + B['2'] + B['3'] + B['4'] + B['5'] + B['6'] + B['7'] + B['8'] + B['9']
  B['11'] = pos(Math.min(B['10'], L['1']))
  B['12'] = fs === 'mfs' ? OH_BUSINESS.deductionMfs : OH_BUSINESS.deduction
  B['13'] = Math.min(B['11'], B['12'])

  // ── Schedule of Adjustments ──
  A['1'] = r(pos(d.otherStateBondInterest))
  A['9'] = r(pos(d.depreciationAddback))
  A['11'] = r(pos(d.otherAdditions))
  A['12'] = A['1'] + A['9'] + A['11']
  A['13'] = B['13']
  A['15'] = r(pos(d.stateRefundInFagi))
  A['16'] = r(f['6b'])
  A['26'] = r(pos(d.usObligationInterest))
  A['31'] = r(pos(d.otherDeductions))
  A['34'] = r(pos(d.uniformedRetirement))
  A['37'] = r(pos(d.contributions529))
  A['42'] = r(pos(d.disabilitySurvivor))
  A['44'] = r(pos(d.medicalExpenses))
  A['47'] = A['13'] + A['15'] + A['16'] + A['26'] + A['31'] + A['34'] + A['37'] + A['42'] + A['44']
  L['2a'] = A['12']
  L['2b'] = A['47']
  L['3'] = L['1'] + L['2a'] - L['2b']

  // ── Exemptions ──
  const magi = L['3'] + A['13']
  const self = ret.canBeClaimedAsDependent ? 0 : 1 + (joint ? 1 : 0)
  const exemptionCount = self + ret.dependents.length
  L['4count'] = exemptionCount
  L['4'] = exemptionCount * ohExemption(magi)
  L['5'] = pos(L['3'] - L['4'])
  B['14'] = B['11'] - B['13']
  B['15'] = L['5'] > 0 ? Math.min(B['14'], L['5']) : 0
  B['16'] = r(B['15'] * OH_BUSINESS.rate)
  L['6'] = B['15']
  L['7'] = pos(L['5'] - L['6'])
  L['8a'] = ohTax(L['7'])
  L['8b'] = B['16']
  L['8c'] = L['8a'] + L['8b']

  // ── Schedule of Credits ──
  const mle = magi - L['4']
  const older = (p: TaxReturnInput['taxpayer']): boolean => p.age65OrOlder || p.age >= 65
  const retirementIncome = pos(r(ret.retirement.filter((x) => owners.includes(x.owner) && !NOT_RETIREMENT.test(x.code.trim())).reduce((s, x) => s + pos(x.taxableAmount), 0)) - A['34'])
  C['1'] = L['8c']
  C['2'] = mle < 100000 ? ohRetirementCredit(retirementIncome) : 0
  C['3'] = 0
  C['4'] = mle < 100000 && (older(ret.taxpayer) || (joint && older(ret.spouse))) ? 50 : 0
  C['5'] = 0
  const careCredit = res.schedule3.dependentCare > 0 || res.form2441.credit > 0
  C['6'] = careCredit && magi < 40000 ? (magi < 20000 ? r(res.form2441.credit) : r(res.schedule3.dependentCare * 0.25)) : 0
  C['7'] = 0
  C['8'] = 0
  C['9'] = mle < 30000 ? 20 * exemptionCount : 0
  C['10'] = C['2'] + C['3'] + C['4'] + C['5'] + C['6'] + C['7'] + C['8'] + C['9']
  C['11'] = pos(C['1'] - C['10'])
  const qualifying = (o: Owner): number => ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + w.wages, 0)
    + ret.retirement.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.taxableAmount), 0)
  const jointOk = joint && magi < 750000 && qualifying('taxpayer') >= 500 && qualifying('spouse') >= 500
  const jointPercent = jointOk ? ohJointPercent(mle) : 0
  C['12'] = jointOk ? Math.min(650, r(C['11'] * jointPercent)) : 0
  C['13'] = r(pos(res.eic.credit) * 0.3)
  const other = r(pos(d.otherCredits))
  C['36'] = C['12'] + C['13'] + other
  C['37'] = pos(C['11'] - C['36'])
  C['38'] = 0
  C['39'] = r(pos(d.residentCredit))
  C['40'] = C['10'] + C['36'] + C['38'] + C['39']
  C['47'] = 0

  // ── Tax and payments ──
  L['9'] = C['40']
  L['10'] = pos(L['8c'] - L['9'])
  L['11'] = 0
  L['12'] = r(pos(d.useTax))
  L['13'] = L['10'] + L['11'] + L['12']
  const w2 = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, ein: x?.ein ?? '', stateId: x?.stateId ?? '', wages: r(w.wages), ohWages: r(x?.stateIncome ?? w.wages), federal: r(w.federalWithholding), tax: r(pos(x?.stateTax ?? 0)) }
  })
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner)).map((x) => {
    const s = d.r1099[x.id]
    return { owner: x.owner, payer: x.payer, ein: s?.ein ?? '', stateId: s?.stateId ?? '', gross: r(x.grossDistribution), code: x.code, federal: r(x.federalWithholding), tax: r(pos(s?.stateTax ?? 0)), total: false }
  })
  L['14'] = w2.reduce((s, x) => s + x.tax, 0) + r1099.reduce((s, x) => s + x.tax, 0) + r(pos(d.otherWithholding))
  L['15'] = r(pos(d.estimatedPayments))
  L['16'] = C['47']
  L['17'] = L['14'] + L['15'] + L['16']
  L['18'] = 0
  L['19'] = L['17'] - L['18']
  L['20'] = pos(L['13'] - L['19'])
  L['21'] = 0
  L['22'] = L['20'] + L['21']
  L['23'] = pos(L['19'] - L['13'])
  L['24'] = Math.min(r(pos(d.creditForward)), L['23'])
  let room = L['23'] - L['24']
  for (const k of OH_DONATION_LETTERS) { const v = Math.min(r(pos(d.donations[k] ?? 0)), room); L[`25${k}`] = v; room -= v }
  L['25g'] = OH_DONATION_LETTERS.reduce((s, k) => s + L[`25${k}`], 0)
  L['26'] = L['23'] - L['24'] - L['25g']

  // ── Notes ──
  if (L['2a'] > 0 || L['2b'] > 0) attach.push('Ohio Schedule of Adjustments')
  if (B['10'] !== 0) attach.push('Ohio Schedule of Business Income')
  if (C['40'] > 0) attach.push('Ohio Schedule of Credits')
  if (ret.dependents.length > 0) attach.push('Ohio Schedule of Dependents')
  if (L['14'] > 0) attach.push('Schedule of Ohio Withholding and the state copies of your W-2s and 1099s')
  if (C['39'] > 0) attach.push('Ohio IT RC (resident credit) and a copy of the other state’s return')
  if (C['12'] > 0) attach.push('A statement listing each spouse’s qualifying income (joint filing credit)')
  if (A['11'] > 0) issues.push('Other additions are shown on Schedule of Adjustments line 11; move them to the line that matches each item.')
  if (A['31'] > 0) issues.push('Other deductions are shown on Schedule of Adjustments line 31; move them to the line that matches each item.')
  if (other > 0) issues.push('Enter your other nonrefundable credits on the matching lines 14–35 of the Schedule of Credits.')
  if (C['2'] > 0) issues.push(`Retirement income credit: ${C['2']} for ${retirementIncome.toLocaleString('en-US')} of retirement income (Table 2). It only applies to income received on account of retirement.`)
  if (A['16'] > 0) issues.push('Ohio does not tax Social Security: your taxable benefits are deducted on Schedule of Adjustments line 16.')
  if (!d.schoolDistrict.trim()) issues.push('Enter your four-digit school district number (from the list in the instructions or tax.ohio.gov).')
  issues.push('Many Ohio school districts also levy an income tax filed on form SD 100, and most cities tax income on a separate municipal return.')
  if (B['13'] > 0) issues.push(`Business income deduction: the first $${B['12'].toLocaleString('en-US')} of business income is deducted; the rest is taxed at 3%.`)
  if (w2.some((x) => x.tax > 0 && (!x.ein || !x.stateId))) issues.push('Enter each W-2’s EIN and employer Ohio ID for the Schedule of Ohio Withholding.')
  if (ret.dependents.some((x) => !d.dependentBirthDates[x.id])) issues.push('The Schedule of Dependents asks for each dependent’s date of birth.')

  return { lines: L, adjustments: A, business: B, credits: C, magi, exemptionCount, mle, jointPercent, withholding: { w2, r1099 }, issues, attach }
}
