/**
 * Rhode Island Form RI-1040, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 RI-1040 instructions (rev. 11/2025), 2025 tax rate schedule and worksheets, 2025 tax table, 2025
 * RI Schedule M and Schedule CR, and the 2025 RI-1040H.
 *  - Modified federal AGI = federal AGI ± Schedule M (U.S. interest, railroad retirement, 529 up to $500 / $1,000,
 *    Social Security and up to $50,000 of pensions for those at full retirement age with federal AGI ≤ $107,000
 *    ($133,750 joint), military service pensions; other states’ bond interest added).
 *  - Standard deduction $10,900 / $21,800 / $16,350 and $5,100 per exemption, both phased out in 20% steps for each
 *    $7,250 above $254,250.
 *  - Tax: 3.75% / 4.75% / 5.99% (tax table at the middle of each $50 row under $100,000).
 *  - Credits: 25% of the federal child and dependent care credit; tax paid to another state; Schedule CR.
 *  - Refundable: earned income credit 16% of federal; RI-1040H property tax relief up to $700.
 * Amounts are kept in dollars and cents, as the RI-1040 asks.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const c2 = (n: number): number => Math.round(n * 100) / 100
const pos = (n: number): number => Math.max(0, n)
type FS = TaxReturnInput['filingStatus']

export const RI_STANDARD: Record<FS, number> = { single: 10900, mfs: 10900, mfj: 21800, qss: 21800, hoh: 16350 }
export const RI_EXEMPTION = 5100
const PHASEOUT = 254250

/** Standard deduction / exemption phase-out multiplier (worksheet lines 5–7). */
export function riPhaseout(modifiedAgi: number): number {
  const over = modifiedAgi - PHASEOUT
  if (over <= 0) return 1
  if (over > 29000) return 0
  return [1, 0.8, 0.6, 0.4, 0.2][Math.ceil(over / 7250)] ?? 0
}

const schedule = (x: number): number => (x <= 79900 ? x * 0.0375 : x <= 181650 ? 2996.25 + (x - 79900) * 0.0475 : 7829.38 + (x - 181650) * 0.0599)

/** Line 8: tax table under $100,000 (rows of $50, tax at the midpoint, whole dollars), computation worksheet above. */
export function riTax(taxable: number): number {
  const x = pos(taxable)
  if (x < 50) return 0
  if (x < 100000) return Math.round(schedule(Math.floor(x / 50) * 50 + 25))
  return c2(x <= 181650 ? x * 0.0475 - 799 : x * 0.0599 - 3051.46)
}

/** RI-1040H percentage of household income by income and household size. */
export function riReliefPercent(income: number, persons: number): number {
  if (income < 6991) return 0.03
  if (income <= 10480) return 0.04
  if (income <= 13970) return 0.05
  if (income <= 17460) return persons > 1 ? 0.05 : 0.06
  return 0.06
}

/** Born on or before March 1, 1959 — reached full retirement age for 2025 (dates as mm/dd/yyyy). */
export function riFullRetirementAge(dob: string, age: number): boolean {
  const m = dob.trim().match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/)
  if (!m) return age >= 67
  const t = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])).getTime()
  return t <= new Date(1959, 2, 1).getTime()
}

export interface RiResult {
  /** RI Schedule CR lines (1–9 when listed by line; 10–12 recapture). */
  cr: Record<string, number>
  lines: Record<string, number>
  m: Record<string, number>
  h: Record<string, number> | null
  exemptions: number
  phaseout: number
  issues: string[]
  attach: string[]
}

export function computeRhodeIsland(ret: TaxReturnInput, res: TaxReturnResult): RiResult {
  const d = ret.ri
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const L: Record<string, number> = {}
  const M: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = c2(f['11a'])

  // ── Schedule M ──
  const limit = joint || fs === 'qss' ? 133750 : 107000
  const fra: Record<Owner, boolean> = { taxpayer: riFullRetirementAge(d.birthDates.taxpayer, ret.taxpayer.age), spouse: joint && riFullRetirementAge(d.birthDates.spouse, ret.spouse.age) }
  M['1a'] = c2(pos(d.usObligationInterest))
  M['1d'] = c2(pos(d.railroadRetirement))
  M['1g'] = Math.min(c2(pos(d.tuition529)), joint ? 1000 : 500)
  // Line 1s: taxable Social Security of those at full retirement age, AGI at or under the limit.
  if (fagi <= limit && f['6b'] > 0) {
    const benefits = (o: Owner): number => ret.socialSecurity.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.netBenefits), 0)
    const total = owners.reduce((s, o) => s + benefits(o), 0)
    const eligible = owners.filter((o) => fra[o]).reduce((s, o) => s + benefits(o), 0)
    M['1s'] = total > 0 ? c2(f['6b'] * Math.min(1, eligible / total)) : 0
  } else M['1s'] = 0
  // Line 1t: up to $50,000 of pension and annuity income per person at full retirement age; line 1v: military pensions.
  const pensionOf = (o: Owner, kind: 'pension' | 'military'): number => ret.retirement.filter((x) => x.owner === o && !x.ira && d.pensionKind[x.id] === kind).reduce((s, x) => s + pos(x.taxableAmount), 0)
  M['1t'] = fagi <= limit ? c2(owners.filter((o) => fra[o]).reduce((s, o) => s + Math.min(50000, pensionOf(o, 'pension')), 0)) : 0
  M['1v'] = c2(owners.reduce((s, o) => s + pensionOf(o, 'military'), 0))
  M['1other'] = c2(pos(d.otherDecreasing))
  M['1y'] = -(M['1a'] + M['1d'] + M['1g'] + M['1s'] + M['1t'] + M['1v'] + M['1other'])
  M['2a'] = c2(pos(d.otherStateBondInterest))
  M['2other'] = c2(pos(d.otherIncreasing))
  M['2m'] = M['2a'] + M['2other']
  M['3'] = c2(M['1y'] + M['2m'])

  // ── Page 1 ──
  L['1'] = fagi
  L['2'] = M['3']
  L['3'] = c2(L['1'] + L['2'])
  const phaseout = riPhaseout(L['3'])
  L['4'] = c2(RI_STANDARD[fs] * phaseout)
  L['5'] = c2(pos(L['3'] - L['4']))
  const exemptions = ret.canBeClaimedAsDependent ? 0 : (joint ? 2 : 1) + ret.dependents.length
  L['6n'] = exemptions
  L['6'] = c2(exemptions * RI_EXEMPTION * phaseout)
  L['7'] = c2(pos(L['5'] - L['6']))
  L['8'] = riTax(L['7'])
  // Schedule I: 25% of the federal child and dependent care credit.
  L['20'] = c2(pos(res.schedule3.dependentCare))
  L['21'] = c2(L['20'] * 0.25)
  L['22'] = Math.min(L['8'], L['21'])
  L['9a'] = L['22']
  // Schedule II: credit for tax paid to another state.
  const os = d.otherState
  if (os.tax > 0 && os.income > 0 && L['3'] > 0) {
    L['23'] = c2(L['8'] - L['22'])
    L['24'] = c2(os.income)
    L['25'] = L['3']
    L['26'] = Math.min(1, Math.round((L['24'] / L['25']) * 10000) / 10000)
    L['27'] = c2(L['23'] * L['26'])
    L['28'] = c2(os.tax)
    L['29'] = Math.min(L['23'], L['27'], L['28'])
  } else L['29'] = 0
  L['9b'] = L['29']
  const crListed = Object.values(d.crLines).some((x) => x > 0)
  const CR: Record<string, number> = {}
  if (crListed) { for (let n = 1; n <= 8; n++) CR[String(n)] = c2(pos(d.crLines[String(n)] ?? 0)); CR['9'] = [1, 2, 3, 4, 5, 6, 7, 8].reduce((s, n) => s + CR[String(n)], 0) }
  const rec = d.recapture.filter((x) => x.amount > 0).slice(0, 2)
  rec.forEach((x, i) => { CR[String(10 + i)] = c2(x.amount) })
  CR['12'] = rec.reduce((s, x) => s + c2(x.amount), 0)
  L['9c'] = crListed ? CR['9'] : c2(pos(d.otherCredits))
  L['9d'] = c2(L['9a'] + L['9b'] + L['9c'])
  L['10a'] = c2(pos(L['8'] - L['9d']))
  // Checkoffs (lines 30–37).
  for (const k of ['30', '31', '32', '33', '34', '35', '36', '37']) L[k] = c2(pos(d.checkoffs[k] ?? 0))
  L['38'] = ['30', '31', '32', '33', '34', '35', '36', '37'].reduce((s, k) => s + L[k], 0)
  L['11'] = L['38']
  L['12a'] = c2(pos(d.useTax))
  L['12b'] = d.fullYearCoverage ? 0 : c2(pos(d.mandatePenalty))
  L['10b'] = CR['12']
  L['13a'] = c2(L['10a'] + L['10b'] + L['11'] + L['12a'] + L['12b'])

  // ── RI-1040H ──
  let H: Record<string, number> | null = null
  const oldOrDisabled = owners.some((o) => person(o).age >= 65 || person(o).age65OrOlder) || d.relief.disabled
  if (d.relief.claim) {
    const rl = d.relief
    H = {}
    H['14'] = c2(pos(f['1z']))
    H['15'] = c2(pos(f['2a']) + pos(f['2b']) + pos(f['3b']))
    H['18'] = c2(res.schedule1.businessIncome)
    H['19'] = c2(f['7a'] + res.schedule1.otherGains)
    H['20'] = c2(pos(f['4a']) + pos(f['5a']))
    H['21'] = c2(res.schedule1.rentalIncome)
    H['23'] = c2(pos(res.schedule1.unemployment))
    H['24'] = c2(pos(f['6a']))
    H['25'] = c2(res.schedule1.otherIncome)
    H['26'] = c2(['14', '15', '18', '19', '20', '21', '23', '24', '25'].reduce((s, k) => s + H![k], 0))
    H['27'] = c2(pos(f['10']))
    H['28'] = c2(H['26'] - H['27'])
    H['29'] = c2(pos(rl.publicAssistance))
    H['30'] = c2(pos(rl.otherNontaxable))
    H['31'] = c2(['18', '19', '21', '25'].reduce((s, k) => s + pos(-H![k]), 0))
    H['32'] = c2(H['28'] + H['29'] + H['30'] + H['31'])
    H['1b'] = H['32']
    const persons = Math.max(1, Math.round(rl.householdSize))
    const pct = riReliefPercent(H['32'], persons)
    if (rl.owner) {
      H['2'] = c2(pos(rl.propertyTax))
      H['3'] = pct
      H['4'] = c2(H['32'] * pct)
      H['5'] = c2(pos(H['2'] - H['4']))
      H['6'] = Math.min(H['5'], 700)
      H['13'] = H['6']
    } else {
      H['7'] = c2(pos(rl.rent))
      H['8'] = c2(H['7'] * 0.2)
      H['9'] = pct
      H['10'] = c2(H['32'] * pct)
      H['11'] = c2(pos(H['8'] - H['10']))
      H['12'] = Math.min(H['11'], 700)
      H['13'] = H['12']
    }
    if (!oldOrDisabled || H['32'] > 40730) H['13'] = 0
    if (!oldOrDisabled) issues.push('The property tax relief credit needs you or your spouse to be 65 or older or disabled at the end of 2025.')
    if (H['32'] > 40730) issues.push('Total household income is over $40,730, so no property tax relief credit is allowed.')
  }

  // ── Page 2: payments ──
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const w2Tax = w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0)
  const otherTax = d.other1099.filter((x) => owners.includes(x.owner)).reduce((s, x) => s + pos(x.tax), 0)
  L['14a'] = c2(w2Tax + otherTax)
  L['14b'] = c2(pos(d.estimatedPayments))
  L['14c'] = H?.['13'] ?? 0
  L['39'] = c2(pos(f['27a']))
  L['40'] = 0.16
  L['41'] = c2(L['39'] * 0.16)
  L['14d'] = L['41']
  L['14g'] = c2(L['14a'] + L['14b'] + L['14c'] + L['14d'])
  L['14i'] = L['14g']
  L['13b'] = L['13a']
  L['15a'] = c2(pos(L['13b'] - L['14i']))
  L['15c'] = L['15a']
  L['16'] = c2(pos(L['14i'] - L['13b']))
  L['18'] = Math.min(L['16'], c2(pos(d.creditForward)))
  L['17'] = c2(L['16'] - L['18'])

  // ── Notes ──
  if (M['1y'] !== 0 || M['2m'] !== 0) attach.push('RI Schedule M with supporting documents')
  if (L['14a'] > 0) attach.push('RI Schedule W and every W-2 and 1099 with Rhode Island withholding')
  if (exemptions > (joint ? 2 : 1)) attach.push('RI Schedule E (dependents with dates of birth)')
  if (L['9c'] > 0 || L['10b'] > 0) attach.push('RI Schedule CR with the credit forms and certificates')
  if (L['29'] > 0) attach.push(`A copy of your ${os.state.trim() || 'other state'} return (Schedule II)`)
  if (H && L['14c'] > 0) attach.push(d.relief.owner ? 'RI-1040H with your 2025 property tax bill' : 'RI-1040H with your lease or three rent receipts')
  if (H) attach.push('Your 2025 Social Security award letter or Form 1099 (RI-1040H)')
  if (L['12a'] > 0) attach.push('RI Schedule U (use tax)')
  if (!d.fullYearCoverage) attach.push('Form IND-HEALTH and the Shared Responsibility Worksheet')
  if ((M['1s'] > 0 || M['1t'] > 0) && !d.birthDates.taxpayer.trim()) issues.push('Schedule M lines 1s / 1t need your date of birth.')
  if (fagi > limit && (f['6b'] > 0 || ret.retirement.some((x) => d.pensionKind[x.id] === 'pension'))) issues.push(`Federal AGI is over ${limit.toLocaleString('en-US')}, so the Social Security and pension modifications don’t apply.`)
  if (phaseout < 1) issues.push(`Modified federal AGI is over $254,250: the standard deduction and exemptions are reduced to ${Math.round(phaseout * 100)}%.`)
  if (L['17'] > 0 && L['17'] < 5) issues.push('Refunds under $5 are paid only on request.')
  return { cr: CR, lines: L, m: M, h: H, exemptions, phaseout, issues, attach }
}
