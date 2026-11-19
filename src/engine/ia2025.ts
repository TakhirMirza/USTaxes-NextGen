/**
 * Iowa Form IA 1040, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 IA 1040 and IA 1040 Schedule 1, the IA 1040 expanded instructions (revenue.iowa.gov) and the 2025 Iowa
 * Income Tax Reduction Worksheet (41-146): federal taxable income plus Schedule 1 modifications (Social Security,
 * military retirement and — for those 55 or older or disabled — IRA, pension and railroad retirement income are
 * subtracted); a flat 3.8% tax, or for statuses 2–5 the alternate tax of 4.3% of net income above $13,500 ($32,000 at
 * 65); exemption credits of $40 / $20 / $40; the K-12 tuition credit (25% of $2,000 per dependent); the single filer tax
 * reduction worksheet; the low-income exemption ($9,000 / $13,500, $24,000 / $32,000 at 65); the school district
 * surtax; the refundable child and dependent care credit (75%–30% of the federal credit below $90,000) or early
 * childhood development credit (25% of $1,000 per child aged 3–5); the Iowa EITC (15% of the federal credit).
 * Whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export const IA_RATE = 0.038
export const IA_ALT_RATE = 0.043

/** Child and dependent care credit percentage of the federal credit by Iowa taxable income (IA 1040, line 4). */
export function iaCarePercent(income: number): number {
  if (income < 10000) return 0.75
  if (income < 20000) return 0.65
  if (income < 25000) return 0.55
  if (income < 35000) return 0.5
  if (income < 40000) return 0.4
  if (income < 90000) return 0.3
  return 0
}

export interface IaResult {
  lines: Record<string, number>
  step3: { a: number; b: number; c: number }
  schedule1: { A: Record<string, number>; B: Record<string, number>; lines: Record<string, number> }
  netIncome: number
  threshold: number
  lowIncomeExempt: boolean
  alternateTax: boolean
  taxReduction: boolean
  careCredit: 'care' | 'early' | null
  issues: string[]
  attach: string[]
}

export function computeIowa(ret: TaxReturnInput, res: TaxReturnResult): IaResult {
  const d = ret.ia
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const L: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const agi = r(f['11a'])

  // ── Step 3: exemption credits ──
  const step3 = {
    a: joint || fs === 'hoh' ? 2 : 1,
    b: owners.reduce((s, o) => s + (person(o).age >= 65 || person(o).age65OrOlder ? 1 : 0) + (person(o).blind ? 1 : 0), 0),
    c: ret.dependents.length
  }
  L['IIIa'] = step3.a * 40
  L['IIIb'] = step3.b * 20
  L['IIIc'] = step3.c * 40
  L['IIId'] = L['IIIa'] + L['IIIb'] + L['IIIc']

  // ── Step 4: federal figures ──
  L['1a'] = r(f['9'])
  L['1b'] = r(f['10'])
  L['1c'] = agi
  L['1d'] = r(f['12e'])
  L['1e'] = r(f['13a'])
  L['1f'] = r(pos(res.schedule1A.senior))
  L['2'] = r(f['15'])

  // ── Schedule 1 ──
  const A: Record<string, number> = {}
  const B: Record<string, number> = {}
  A['1'] = r(pos(d.otherStateBondInterest))
  B['1'] = r(pos(d.usObligationInterest))
  const kind = (id: string) => d.retirementKind[id] ?? 'standard'
  const mine = ret.retirement.filter((x) => owners.includes(x.owner))
  B['4'] = r(mine.filter((x) => kind(x.id) === 'military').reduce((s, x) => s + pos(x.taxableAmount), 0))
  B['5'] = r(pos(f['6b']))
  B['6'] = r(pos(d.activeDutyPay))
  const eligible = (o: Owner): boolean => person(o).age >= 55 || d.disabled[o]
  B['7'] = r(mine.filter((x) => kind(x.id) === 'railroad' || (kind(x.id) === 'standard' && eligible(x.owner))).reduce((s, x) => s + pos(x.taxableAmount), 0))
  const addCode = d.otherAddition.code.trim().toLowerCase()
  const subCode = d.otherSubtraction.code.trim().toLowerCase()
  if (d.otherAddition.amount > 0) A['11'] = r(d.otherAddition.amount)
  if (d.otherSubtraction.amount > 0) B['11'] = r(d.otherSubtraction.amount)
  A['12'] = Object.values(A).reduce((s, x) => s + x, 0)
  B['12'] = Object.values(B).reduce((s, x) => s + x, 0)
  const S: Record<string, number> = {}
  S['13'] = A['12'] - B['12']
  S['14'] = r(pos(d.iowa529))
  S['16'] = r(pos(d.capitalGainsDeduction))
  S['19'] = r(pos(d.otherAdjustment.amount))
  // Health insurance deduction: 65 or older and income (before this deduction, with add-backs) under $100,000.
  const before15 = L['2'] + S['13'] - S['14'] - S['16'] - S['19']
  const hiTest = before15 + Math.min(L['1d'], pos(agi)) + L['1e'] + L['1f'] + B['5'] + B['4'] + B['7']
  const any65 = owners.some((o) => person(o).age >= 65 || person(o).age65OrOlder)
  S['15'] = any65 && hiTest < 100000 ? r(pos(d.healthInsurance)) : 0
  if (d.healthInsurance > 0 && S['15'] === 0) issues.push(any65 ? 'Health insurance deduction (Schedule 1 line 15): income is $100,000 or more, so it is not allowed.' : 'Health insurance deduction (Schedule 1 line 15) is only for taxpayers 65 or older.')
  S['20'] = -(S['14'] + S['15'] + S['16'] + S['19'])
  S['21'] = S['13'] + S['20']
  L['3'] = S['21']
  L['4'] = L['2'] + L['3']
  const ti = pos(L['4'])

  // ── Net income for the low-income exemption, alternate tax and tax reduction ──
  const netIncome = L['4'] + Math.min(L['1d'], pos(agi)) + L['1f'] + L['1e']
  const single = fs === 'single' || fs === 'mfs'
  const threshold = single ? (any65 ? 24000 : 9000) : (any65 ? 32000 : 13500)
  const dependent = ret.canBeClaimedAsDependent
  const lowIncomeExempt = dependent ? L['4'] < 5000 && netIncome <= threshold : netIncome <= threshold

  // ── Step 5: tax ──
  let alternateTax = false
  let taxReduction = false
  const rateTax = r(ti * IA_RATE)
  L['5'] = rateTax
  if (fs === 'mfj' || fs === 'hoh' || fs === 'qss') {
    const alt = r(pos(netIncome - (any65 ? 32000 : 13500)) * IA_ALT_RATE)
    if (alt < rateTax) { L['5'] = alt; alternateTax = true }
  }
  L['6'] = 0
  L['7'] = L['5'] + L['6']
  L['8'] = L['IIId']
  L['9'] = r(ret.dependents.reduce((s, x) => s + Math.min(2000, pos(d.tuition[x.id] ?? 0)) * 0.25, 0))
  L['10'] = r(pos(d.volunteerCredit))
  L['11'] = L['8'] + L['9'] + L['10']
  L['12'] = pos(L['7'] - L['11'])
  if (fs === 'single' && !dependent) {
    const red = pos(netIncome - (any65 ? 24000 : 9000))
    if (red < L['12']) { L['12'] = red; taxReduction = true }
  }
  L['13'] = 0
  L['14'] = L['12'] - L['13']
  L['15'] = Math.min(L['14'], r(pos(d.outOfStateCredit)))
  L['16'] = pos(L['14'] - L['15'])
  L['17'] = Math.min(L['16'], r(pos(d.otherNonrefundable)))
  L['18'] = pos(L['16'] - L['17'])
  L['19'] = r(L['18'] * pos(d.surtaxRate) / 100)
  L['20'] = L['18'] + L['19']
  L['21fish'] = r(pos(d.fishWildlife))
  L['21child'] = r(pos(d.childAbuse))
  L['21'] = L['21fish'] + L['21child']
  L['22'] = L['20'] + L['21']
  if (lowIncomeExempt) {
    for (const k of ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19']) L[k] = 0
    L['20'] = 0
    L['21'] = L['21fish'] = L['21child'] = 0
    L['22'] = 0
    alternateTax = taxReduction = false
  }

  // ── Step 6: refundable credits and payments ──
  L['23'] = r(pos(d.fuelTaxCredit))
  const careOk = L['4'] < 90000
  const cdcc = careOk && fs !== 'mfs' ? r(pos(res.form2441.credit) * iaCarePercent(L['4'])) : 0
  const ecdc = careOk ? r(ret.dependents.filter((x) => x.age >= 3 && x.age <= 5).reduce((s, x) => s + Math.min(1000, pos(d.earlyChildhood[x.id] ?? 0)) * 0.25, 0)) : 0
  const careCredit: IaResult['careCredit'] = cdcc === 0 && ecdc === 0 ? null : cdcc >= ecdc ? 'care' : 'early'
  L['24'] = Math.max(cdcc, ecdc)
  L['25'] = r(pos(f['27a']) * 0.15)
  L['26'] = r(pos(d.otherRefundable))
  L['27'] = 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  L['28'] = r(w2s.reduce((s, w) => s + pos(d.w2[w.id]?.stateTax ?? 0), 0) + pos(d.withholdingOther))
  L['29'] = r(pos(d.estimatedPayments))
  L['30'] = L['23'] + L['24'] + L['25'] + L['26'] + L['27'] + L['28'] + L['29']

  // ── Steps 7–8 ──
  L['31a'] = pos(L['30'] - L['22'])
  L['31b'] = 0
  L['33'] = Math.min(L['31a'], r(pos(d.creditForward)))
  L['32'] = L['31a'] - L['31b'] - L['33']
  L['34'] = pos(L['22'] - L['30'])
  L['35'] = 0
  L['36'] = 0
  L['37'] = L['34'] + L['35'] + L['36']

  // ── Notes ──
  attach.push('A copy of your federal return and your W-2s')
  if (careCredit === 'care') attach.push('Federal Form 2441 (for the Iowa child and dependent care credit)')
  if (S['16'] > 0) attach.push('IA 100 (capital gains deduction)')
  if (L['15'] > 0) attach.push('IA 130 (out-of-state tax credit) — not filled in here')
  if (L['17'] + L['26'] > 0) attach.push('IA 148 (tax credits schedule) — not filled in here')
  if (L['23'] > 0) attach.push('IA 4136 (fuel tax credit) — not filled in here')
  if (addCode || subCode || d.otherAdjustment.amount > 0) attach.push('An explanation for each Schedule 1 line 11 / line 19 entry')
  if (lowIncomeExempt) issues.push(`Net income ${netIncome.toLocaleString('en-US')} is not more than $${threshold.toLocaleString('en-US')}: the low-income exemption applies and you owe no Iowa tax${L['30'] > 0 ? '; payments and refundable credits are refunded' : ''}.`)
  if (alternateTax) issues.push('The alternate tax (4.3% of net income above the exemption amount) is lower than 3.8% and is used on line 5.')
  if (taxReduction) issues.push('The Iowa Income Tax Reduction Worksheet (41-146) lowers line 12.')
  if (fs === 'mfs') issues.push('Married filing separately: enter your spouse’s Iowa taxable income in Step 2 yourself; the alternate tax is not computed here.')
  if (L['18'] > 0 && !d.surtaxRate && !d.schoolDistrictNo) issues.push('Enter your school district number and its surtax rate (table 41-027); most districts levy a surtax on line 19.')
  if (mine.some((x) => kind(x.id) === 'standard' && !eligible(x.owner) && x.taxableAmount > 0)) issues.push('Retirement income of someone under 55 is taxed unless they are disabled or a surviving spouse.')
  if (L['34'] > 0 && L['34'] > L['22'] * 0.1 && L['29'] === 0) issues.push('A balance due may mean an underpayment penalty (IA 2210).')
  if (ret.dependents.length > 4) issues.push('More than four dependents: attach a page listing the rest.')

  return { lines: L, step3, schedule1: { A, B, lines: S }, netIncome, threshold, lowIncomeExempt, alternateTax, taxReduction, careCredit, issues, attach }
}
