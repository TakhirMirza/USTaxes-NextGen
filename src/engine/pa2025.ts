/**
 * Pennsylvania Form PA-40, full-year resident income tax return, tax year 2025.
 *
 * Source: 2025 PA-40 and PA-40 IN (eight classes of income, losses in one class never reduce another,
 * flat 3.07%), PA Schedule O (529, ABLE, MSA, HSA and — new for 2025 — student loan interest up to $2,500)
 * and PA Schedule SP (Tax Forgiveness, Eligibility Income Tables 1 and 2). Pennsylvania does not tax Social
 * Security, unemployment or commonly recognized retirement benefits, but it does tax 401(k)-type
 * deferrals as compensation. The Working Pennsylvanians Tax Credit (10% of the federal EITC, up to $805)
 * is figured by the Department, not on the return. Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

export const PA_RATE = 0.0307
export const PA_529_LIMIT = 19000
export const PA_STUDENT_LOAN_MAX = 2500
export const PA_FORGIVENESS = { single: 6500, married: 13000, perChild: 9500, step: 250 }
export const PA_WPTC = { rate: 0.1, max: 805 }

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Eligibility Income Tables 1 and 2: the share of tax forgiven. */
export function forgivenessPercent(eligibility: number, married: boolean, children: number): number {
  const base = (married ? PA_FORGIVENESS.married : PA_FORGIVENESS.single) + children * PA_FORGIVENESS.perChild
  if (eligibility <= base) return 1
  const steps = Math.ceil((eligibility - base) / PA_FORGIVENESS.step)
  return steps >= 10 ? 0 : Math.round((1 - steps * 0.1) * 10) / 10
}

export interface PaResult {
  lines: Record<string, number>
  scheduleO: { tuition: Record<Owner, number>; hsa: number; studentLoan: number; total: number }
  forgiveness: { married: boolean; children: number; eligibility: number; percent: number; nontaxable: number }
  wptc: number
  losses: { business: boolean; property: boolean; rents: boolean }
  issues: string[]
  attach: string[]
}

export function computePennsylvania(ret: TaxReturnInput, res: TaxReturnResult): PaResult {
  const d = ret.pa
  const f = res.f1040
  const s1 = res.schedule1
  const joint = ret.filingStatus === 'mfj'
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []

  // ── Classes of income ──
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const w2 = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((s, w) => s + w.wages, 0)
  const deferrals = owners.reduce((s, o) => s + pos(ret.savings[o].electiveDeferrals), 0)
  L['1a'] = r(d.compensation ?? w2 + deferrals)
  L['1b'] = r(pos(d.unreimbursedExpenses))
  L['1c'] = pos(L['1a'] - L['1b'])
  L['2'] = r(pos(f['2b'] - pos(d.usObligationInterest) + pos(d.otherStateBondInterest)))
  const capGainDistributions = ret.dividends.reduce((s, x) => s + pos(x.capitalGainDistributions), 0)
  L['3'] = r(f['3b'] + capGainDistributions)
  L['4'] = r(s1.businessIncome)
  // Sales of property: this year's gains and losses only (no carryover, distributions are on line 3).
  L['5'] = r(res.scheduleD.net + ret.capitalLossCarryover.shortTerm + ret.capitalLossCarryover.longTerm - capGainDistributions)
  L['6'] = r(s1.rentalIncome)
  L['7'] = 0
  L['8'] = r(pos(d.gamblingWinnings))
  L['9'] = L['1c'] + L['2'] + L['3'] + pos(L['4']) + pos(L['5']) + pos(L['6']) + L['7'] + L['8']

  // ── Schedule O ──
  // With beneficiaries listed, each contributor's deduction is limited to $19,000 per beneficiary (Schedule O Section I).
  const listed = d.beneficiaries529.filter((b) => b.name.trim() || b.taxpayer || b.spouse)
  const perBeneficiary = (o: Owner): number => listed.reduce((s, b) => s + Math.min(PA_529_LIMIT, r(pos(b[o]))), 0)
  const tuition: Record<Owner, number> = listed.length
    ? { taxpayer: perBeneficiary('taxpayer'), spouse: joint ? perBeneficiary('spouse') : 0 }
    : { taxpayer: r(pos(d.tuitionContributions.taxpayer)), spouse: joint ? r(pos(d.tuitionContributions.spouse)) : 0 }
  const hsa = r((s1.adjustments.hsaDeduction ?? 0))
  const studentLoan = Math.min(PA_STUDENT_LOAN_MAX, r(pos(ret.adjustments.studentLoanInterest)))
  const deductions = tuition.taxpayer + tuition.spouse + hsa + studentLoan
  L['10'] = Math.min(deductions, L['9'])
  L['11'] = L['9'] - L['10']
  L['12'] = r(L['11'] * PA_RATE)

  // ── Payments ──
  L['13'] = r(pos(d.withholding))
  L['14'] = r(pos(d.priorYearCredit))
  L['15'] = r(pos(d.estimatedPayments))
  L['16'] = r(pos(d.extensionPayment))
  L['17'] = 0
  L['18'] = L['14'] + L['15'] + L['16'] + L['17']

  // ── Tax Forgiveness (Schedule SP) ──
  const married = joint || ret.filingStatus === 'mfs'
  const children = ret.dependents.filter((x) => x.childRelationship).length
  const nontaxable = r(pos(f['2a']) - pos(d.otherStateBondInterest) + pos(d.usObligationInterest))
  const eligibility = L['9'] + pos(nontaxable) + r(pos(d.otherEligibilityIncome)) + (ret.filingStatus === 'mfs' ? r(pos(d.spouseEligibilityIncome)) : 0)
  L['22'] = r(pos(d.residentCredit))
  const percent = ret.canBeClaimedAsDependent ? 0 : forgivenessPercent(eligibility, married, children)
  L['19b'] = children
  L['20'] = eligibility
  L['21'] = r(pos(L['12'] - L['22']) * percent)
  L['23'] = r(pos(d.otherCredits))
  L['24'] = L['13'] + L['18'] + L['21'] + L['22'] + L['23']
  L['25'] = r(pos(d.useTax))
  L['26'] = pos(L['12'] + L['25'] - L['24'])
  L['27'] = 0
  L['28'] = L['26'] + L['27']
  L['29'] = pos(L['24'] - L['12'] - L['25'] - L['27'])
  L['31'] = Math.min(r(pos(d.creditForward)), L['29'])
  L['30'] = L['29'] - L['31']

  const wptc = Math.min(PA_WPTC.max, r(pos(res.eic.credit) * PA_WPTC.rate))

  // ── Notes ──
  if (L['10'] > 0) attach.push('PA Schedule O, other deductions')
  if (L['21'] > 0) attach.push('PA Schedule SP, Tax Forgiveness')
  if (L['2'] > 2500) attach.push('PA Schedule A, interest income')
  if (L['3'] > 2500) attach.push('PA Schedule B, dividend income')
  if (L['4'] !== 0) attach.push('PA Schedule C (or federal Schedule C), business income')
  if (L['5'] !== 0) attach.push('PA Schedule D, sales of property')
  if (L['6'] !== 0) attach.push('PA Schedule E, rents and royalties')
  if (L['1b'] > 0) attach.push('PA Schedule UE, unreimbursed employee business expenses')
  if (L['22'] > 0) attach.push('PA Schedule G-L, resident credit')
  if (wptc > 0) attach.push('Copy of your federal Form 1040 (the Department figures the Working Pennsylvanians Tax Credit from line 27)')
  if (d.compensation === null && ret.w2s.length > 0) issues.push(`Line 1a uses W-2 box 1 plus your 401(k)-type deferrals (${L['1a'].toLocaleString('en-US')}). Pennsylvania taxes deferrals; if W-2 box 16 shows a different amount, enter it.`)
  if (L['4'] < 0 || L['5'] < 0 || L['6'] < 0) issues.push('A loss in one class of income does not reduce income in another class in Pennsylvania; the loss is shown but not subtracted.')
  if (r(f['4b'] + f['5b']) > 0) issues.push('Pennsylvania does not tax commonly recognized retirement benefits received after retirement age; early or nonqualified distributions may be taxable as compensation or interest — check the PA-40 instructions.')
  if (s1.unemployment > 0 || f['6b'] > 0) issues.push('Social Security and unemployment compensation are not taxed in Pennsylvania.')
  if (percent > 0 && percent < 1) issues.push(`Tax Forgiveness: ${Math.round(percent * 100)}% of your tax is forgiven (Schedule SP).`)
  if (percent === 1 && L['12'] > 0) issues.push('Tax Forgiveness: all of your Pennsylvania tax is forgiven (Schedule SP).')
  if (wptc > 0) issues.push(`Working Pennsylvanians Tax Credit: the Department adds about ${wptc.toLocaleString('en-US')} (10% of your federal EITC) to your refund. It is not entered on the PA-40.`)
  if (!d.schoolCode.trim()) issues.push('Enter your school district and five-digit school code (PA-40 instructions); Pennsylvania requires them.')
  if (L['3'] > 0 && L['5'] < 0 && res.scheduleD.net < 0) issues.push('Capital loss carryovers are not allowed in Pennsylvania; only this year’s sales count on line 5.')
  issues.push('Most Pennsylvania municipalities and school districts also tax earned income (local EIT) on a separate local return.')

  return {
    lines: L,
    scheduleO: { tuition, hsa, studentLoan, total: L['10'] },
    forgiveness: { married, children, eligibility, percent, nontaxable },
    wptc,
    losses: { business: L['4'] < 0, property: L['5'] < 0, rents: L['6'] < 0 },
    issues, attach
  }
}
