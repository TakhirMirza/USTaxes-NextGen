/**
 * Colorado Form DR 0104, full-year resident individual income tax return, tax year 2025.
 *
 * Source: 2025 Book 104 (Colorado Individual Income Tax Filing Guide), DR 0104 (10/03/25), DR 0104AD, DR 0104CR
 * (09/24/25), DR 0347 and DR 0104CN (2025). Colorado starts from federal taxable income (line 1); adds back state
 * income tax deducted on Schedule A (limited to the excess over the standard deduction), the QBI deduction when AGI
 * is over $500,000 ($1,000,000 joint), and deductions over $12,000 ($16,000 joint) when AGI is over $300,000;
 * subtracts on DR 0104AD (state refund, U.S. interest, Social Security and the $20,000/$24,000 pension and annuity
 * subtraction at 55/65, military retirement under 55 up to $15,000, CollegeInvest/ABLE contributions up to $25,400
 * per beneficiary ($38,100 joint), charitable gifts over $500 for non-itemizers, FAMLI benefits); taxes 4.4% (the
 * tax table below $50,000); and refundable credits: child tax credit (under 6) and family affordability credit
 * (under 17) from DR 0104CN, child care credit (50% of the federal credit, AGI $60,000 or less, DR 0347), and
 * Colorado EITC (50% of the federal credit). Line 38 is the TABOR state sales tax refund. Amounts are whole dollars.
 */
import type { Owner, TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'

export const CO_RATE = 0.044
export const CO_TABLE_TOP = 50000
export const CO_ADDBACK = { agi: 300000, single: 12000, joint: 16000 }
export const CO_QBI_ADDBACK = { single: 500000, joint: 1000000 }
export const CO_PENSION = { over65: 24000, over55: 20000 }
export const CO_SS_FULL = { single: 75000, joint: 95000 }
export const CO_MILITARY = 15000
export const CO_529_LIMIT = { single: 25400, joint: 38100 }
export const CO_CHARITY_FLOOR = 500
export const CO_EITC_RATE = 0.5
export const CO_CARE_RATE = 0.5
export const CO_CARE_AGI = 60000

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

/** Colorado tax: the 2025 tax table (row midpoint, rounded) up to $50,000, then 4.4% of taxable income. */
export function coTax(taxable: number): number {
  const t = pos(r(taxable))
  if (t === 0) return 0
  if (t > CO_TABLE_TOP) return r(t * CO_RATE)
  const small: [number, number][] = [[10, 0], [30, 1], [50, 2], [75, 3], [100, 4]]
  for (const [top, tax] of small) if (t <= top) return tax
  const lo = Math.floor((t - 1) / 100) * 100
  return r((lo + 50) * CO_RATE)
}

/** TABOR state sales tax refund (line 38) by modified AGI (line 37). */
export function coTabor(magi: number, joint: boolean): number {
  const tiers: [number, number, number][] = [[52000, 19, 38], [105000, 25, 50], [168000, 29, 58], [233000, 35, 70], [299000, 37, 74], [Infinity, 59, 118]]
  const row = tiers.find(([top]) => magi <= top) ?? tiers[tiers.length - 1]
  return joint ? row[2] : row[1]
}

/** DR 0104CN line 3: child tax credit per child under 6. */
export function coChildCredit(fagi: number, joint: boolean): number {
  const [a, b, c] = joint ? [36000, 61000, 87000] : [26000, 51000, 77000]
  return fagi <= a ? 1200 : fagi <= b ? 600 : fagi <= c ? 200 : 0
}

/** DR 0104CN lines 6 and 9: family affordability credit per child (under 6, and 6 to 16). */
export function coFamilyCredit(fagi: number, joint: boolean): { under6: number; age6to16: number } {
  const under6 = [3273, 3048, 2823, 2598, 2373, 2148, 1923, 1698, 1473, 1248, 1023, 798, 573, 348, 123]
  const older = [2455, 2286, 2117, 1949, 1780, 1611, 1442, 1274, 1105, 936, 767, 598, 430, 261, 92]
  const first = joint ? 26000 : 15000
  if (fagi <= first) return { under6: under6[0], age6to16: older[0] }
  const i = Math.ceil((fagi - first) / 5000)
  if (i >= under6.length) return { under6: 0, age6to16: 0 }
  return { under6: under6[i], age6to16: older[i] }
}

export interface CoResult {
  lines: Record<string, number>
  /** DR 0104AD lines 1–22. */
  ad: Record<string, number>
  /** DR 0104CR lines. */
  cr: Record<string, number>
  /** DR 0104CN lines. */
  cn: Record<string, number>
  /** DR 0347 lines. */
  care: Record<string, number>
  dependents: { first: string; last: string; ssn: string; birthYear: number; childTaxCredit: boolean }[]
  statements: { owner: Owner; employer: string; ein: string; stateId: string; wages: number; tax: number }[]
  issues: string[]
  attach: string[]
}

export function computeColorado(ret: TaxReturnInput, res: TaxReturnResult): CoResult {
  const d = ret.co
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const L: Record<string, number> = {}
  const A: Record<string, number> = {}
  const CR: Record<string, number> = {}
  const CN: Record<string, number> = {}
  const K: Record<string, number> = {}
  const issues: string[] = []
  const attach: string[] = []
  const fagi = r(f['11a'])
  const itemized = res.deduction.used === 'itemized'

  // ── Additions (lines 1–10) ──
  L['1'] = r(f['15'])
  // State income tax addback: the income-tax share of the capped SALT deduction, but no more than the itemized excess over standard.
  const sa = res.scheduleA
  let stateTaxDeducted = 0
  if (itemized && !d.deductedSalesTax && sa.saltBeforeCap > 0) {
    const incomeTax = pos(ret.itemized.stateLocalIncomeOrSalesTax)
    stateTaxDeducted = incomeTax * Math.min(1, sa.taxes / sa.saltBeforeCap)
  }
  L['2'] = r(pos(Math.min(stateTaxDeducted, res.deduction.itemized - res.deduction.standard)))
  L['3'] = fagi > (joint ? CO_QBI_ADDBACK.joint : CO_QBI_ADDBACK.single) ? r(pos(f['13a'])) : 0
  const line12e = r(f['12e'])
  const floor = joint ? CO_ADDBACK.joint : CO_ADDBACK.single
  L['4'] = fagi > CO_ADDBACK.agi && line12e > floor ? pos(line12e - floor - L['2']) : 0
  L['5'] = r(ret.businesses.reduce((s, b) => s + pos(b.expenses.meals), 0))
  L['6'] = 0
  L['7'] = 0
  L['9'] = r(pos(d.otherStateBondInterest)) + r(pos(d.otherAdditions))
  L['10'] = L['1'] + L['2'] + L['3'] + L['4'] + L['5'] + L['6'] + L['7'] + L['9']

  // ── DR 0104AD subtractions ──
  const ageOf = (o: Owner): number => { const p = o === 'taxpayer' ? ret.taxpayer : ret.spouse; return p.age || (p.age65OrOlder ? 65 : 0) }
  A['1'] = r(pos(d.stateRefundInFagi))
  A['2'] = r(pos(d.usObligationInterest))
  // Social Security: f['6b'] split by each person's share of net benefits.
  const ssTotal = ret.socialSecurity.reduce((s, x) => s + pos(x.netBenefits), 0)
  const ssShare = (o: Owner): number => ssTotal > 0 ? r(pos(f['6b']) * ret.socialSecurity.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.netBenefits), 0) / ssTotal) : 0
  const ssSub = (o: Owner): number => {
    const amt = ssShare(o); const age = ageOf(o)
    if (age >= 65) return amt
    if (age >= 55) return fagi <= (joint ? CO_SS_FULL.joint : CO_SS_FULL.single) ? amt : Math.min(amt, CO_PENSION.over55)
    return 0
  }
  const pensionOf = (o: Owner): number => pos(ret.retirement.filter((x) => x.owner === o).reduce((s, x) => s + pos(x.taxableAmount), 0) - pos(d.militaryRetirement[o]))
  const pensionSub = (o: Owner, ss: number): number => {
    const age = ageOf(o)
    if (age >= 65) return r(Math.min(pos(CO_PENSION.over65 - ss), pensionOf(o)))
    if (age >= 55) return r(Math.min(pos(CO_PENSION.over55 - ss), pensionOf(o)))
    return 0
  }
  A['3'] = ssSub('taxpayer')
  A['4'] = pensionSub('taxpayer', A['3'])
  A['5'] = joint ? ssSub('spouse') : 0
  A['6'] = joint ? pensionSub('spouse', A['5']) : 0
  A['7'] = ageOf('taxpayer') <= 54 ? Math.min(r(pos(d.militaryRetirement.taxpayer)), CO_MILITARY) : 0
  A['8'] = joint && ageOf('spouse') <= 54 ? Math.min(r(pos(d.militaryRetirement.spouse)), CO_MILITARY) : 0
  A['9'] = 0
  const limit529 = (joint ? CO_529_LIMIT.joint : CO_529_LIMIT.single) * Math.max(1, Math.floor(d.beneficiaries))
  A['10'] = Math.min(r(pos(d.collegeInvest)), limit529)
  A['11'] = Math.min(r(pos(d.coloradoAble)), pos(limit529 - A['10']))
  const charity = pos(ret.itemized.charityCash) + pos(ret.itemized.charityNonCash)
  A['12c'] = itemized ? 0 : r(charity)
  A['12'] = itemized ? 0 : pos(A['12c'] - CO_CHARITY_FLOOR)
  A['13'] = 0; A['14'] = 0; A['15'] = 0; A['16'] = 0; A['17'] = 0; A['18'] = 0
  A['19'] = r(pos(d.famliBenefits))
  A['20'] = r(pos(d.otherSubtractions))
  A['21'] = 0
  A['22'] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'].reduce((s, k) => s + A[k], 0)

  // ── Tax (lines 11–23) ──
  L['11'] = A['22']
  L['12'] = L['10'] - L['11']
  L['13'] = coTax(L['12'])
  L['14'] = 0
  L['15'] = 0
  L['16'] = L['13'] + L['14'] + L['15']

  // ── DR 0104CR credits ──
  // Child tax credit and family affordability credit (DR 0104CN): qualifying children under 17 with the federal child credit.
  const year = 2025
  const kids = ret.dependents.filter((x) => x.childRelationship && x.age < 17 && x.monthsLivedWithYou > 6)
  const under6 = kids.filter((x) => x.age < 6).length
  const age6to16 = kids.length - under6
  const ctcPer = coChildCredit(fagi, joint)
  const fam = coFamilyCredit(fagi, joint)
  CN['1'] = fagi
  CN['2'] = ctcPer > 0 ? under6 : 0
  CN['3'] = ctcPer
  CN['4'] = CN['2'] * CN['3']
  CN['5'] = fam.under6 > 0 ? under6 : 0
  CN['6'] = fam.under6
  CN['7'] = CN['5'] * CN['6']
  CN['8'] = fam.age6to16 > 0 ? age6to16 : 0
  CN['9'] = fam.age6to16
  CN['10'] = CN['8'] * CN['9']
  CN['11'] = CN['4'] + CN['7'] + CN['10']
  CR['1'] = CN['11']
  // Child and dependent care (DR 0347): 50% of the federal credit allowed (Form 2441 line 11) when AGI is $60,000 or less;
  // without a federal credit and AGI of $25,000 or less, 25% of expenses up to $500 (one child) or $1,000.
  const care = ret.dependentCare
  K['2e'] = r(pos(care.expenses))
  K['4'] = fagi
  K['5'] = r(res.form2441.credit)
  K['6'] = r(f['18'])
  K['8'] = r(res.schedule3.dependentCare)
  K['2f'] = r(res.form2441.line4)
  K['2g'] = joint ? r(res.form2441.line5) : 0
  K['3'] = pos(Math.min(K['2e'], K['2f'], joint ? K['2g'] : Infinity))
  if (fagi <= CO_CARE_AGI && K['8'] > 0) { K['7'] = CO_CARE_RATE; K['9'] = r(K['8'] * CO_CARE_RATE); CR['2'] = K['9'] } else if (fagi <= 25000 && K['2e'] > 0 && K['8'] === 0) {
    K['10'] = 0.25
    K['11'] = r(K['3'] * 0.25)
    const kidsUnder13 = ret.dependents.filter((x) => x.age < 13).length
    K['12'] = Math.min(K['11'], kidsUnder13 >= 2 ? 1000 : kidsUnder13 === 1 ? 500 : 0)
    CR['2'] = K['12']
  } else CR['2'] = 0
  CR['4'] = r(pos(f['27a']))
  CR['3'] = CR['4'] > 0 ? r(pos(res.eic.earnedIncome)) : 0
  CR['5'] = r(CR['4'] * CO_EITC_RATE)
  CR['26'] = CR['1'] + CR['2'] + CR['5'] + r(pos(d.refundableCredits))
  // Part II: credit for tax paid to another state, and the other nonrefundable credits.
  CR['34'] = Math.min(r(pos(d.otherStateCredit)), L['16'])
  CR['65'] = Math.min(CR['34'] + r(pos(d.nonrefundableCredits)), L['16'])
  L['17'] = CR['65']
  L['18'] = 0; L['19'] = 0; L['20'] = 0
  L['21'] = pos(L['16'] - L['17'] - L['18'] - L['19'] - L['20'])
  L['22'] = 0
  L['23'] = L['21'] + L['22']

  // ── Payments (lines 24–33) ──
  const statements = ret.w2s.filter((w) => owners.includes(w.owner)).map((w) => {
    const x = d.w2[w.id]
    return { owner: w.owner, employer: w.employer, ein: x?.ein ?? '', stateId: x?.stateId ?? '', wages: r(x?.stateIncome ?? w.wages), tax: r(pos(x?.stateTax ?? 0)) }
  })
  L['24'] = statements.reduce((s, x) => s + x.tax, 0) + r(pos(d.withholding1099))
  L['25'] = r(pos(d.priorCarryforward))
  L['26'] = r(pos(d.estimatedPayments))
  L['27'] = r(pos(d.extensionPayment))
  L['28'] = 0; L['29'] = 0; L['30'] = 0
  L['31'] = CR['26']
  L['32'] = 0
  L['33'] = L['24'] + L['25'] + L['26'] + L['27'] + L['28'] + L['29'] + L['30'] + L['31'] + L['32']

  // ── TABOR and balance (lines 34–47) ──
  L['34'] = fagi
  L['35'] = r(pos(f['6a'] - f['6b']))
  L['36'] = r(pos(d.otherStateBondInterest))
  L['37'] = L['34'] + L['35'] + L['36']
  L['38'] = d.tabor ? coTabor(L['37'], joint) : 0
  L['39'] = L['33'] + L['38']
  L['40'] = pos(L['39'] - L['23'])
  L['41'] = Math.min(r(pos(d.creditForward)), L['40'])
  L['42'] = L['40'] - L['41']
  L['43'] = pos(L['23'] - L['39'])
  L['44'] = 0; L['45'] = 0; L['46'] = 0
  L['47'] = L['43'] + L['44'] + L['45'] + L['46']

  const dependents = ret.dependents.slice(0, 5).map((x) => {
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    return { first: parts.join(' '), last, ssn: x.ssn, birthYear: year - Math.max(0, Math.floor(x.age)), childTaxCredit: kids.includes(x) }
  })

  // ── Notes ──
  if (L['11'] > 0) attach.push('DR 0104AD (subtractions from income)')
  if (CR['26'] > 0 || L['17'] > 0) attach.push('DR 0104CR (credits)')
  if (CR['1'] > 0) attach.push('DR 0104CN (child tax credit and family affordability credit)')
  if (CR['2'] > 0) attach.push('DR 0347 (child care credit) and a copy of federal Form 2441')
  if (L['24'] > 0) attach.push('W-2s and 1099s showing Colorado tax withheld')
  if (CR['34'] > 0) attach.push('Copy of the other state’s return (credit for tax paid to another state)')
  if (A['3'] + A['5'] > 0) attach.push('Copies of your SSA-1099s')
  if (A['4'] + A['6'] + A['7'] + A['8'] > 0) attach.push('Copies of your 1099-Rs')
  if (res.schedule2.amt > 0) issues.push('You owe federal alternative minimum tax; Colorado may have its own AMT (DR 0104AMT, line 14), which is not figured here.')
  if (L['2'] > 0) issues.push(`State income tax addback (line 2): ${L['2'].toLocaleString('en-US')} of the state income tax deducted on Schedule A. If your Schedule A deduction is sales tax, check “sales tax” below.`)
  if (ret.dependents.length > 5) issues.push('More than five dependents: Colorado requires e-filing.')
  if (kids.some((x) => !x.ssn)) issues.push('Each child for the Colorado child tax credit needs an SSN or ITIN.')
  if (A['12'] > 0) issues.push(`You did not itemize, so charitable gifts over $${CO_CHARITY_FLOOR} are subtracted (DR 0104AD line 12). Keep receipts; claims over $5,000 need them attached.`)
  if (owners.some((o) => ageOf(o) < 55 && ret.retirement.some((x) => x.owner === o && x.taxableAmount > 0))) issues.push('Under 55, the pension subtraction applies only to survivor benefits (enter them under other subtractions) and military retirement.')
  if (L['47'] > 1000 && L['26'] === 0) issues.push('A balance due over $1,000 may mean an estimated tax penalty (DR 0204).')
  if (statements.some((x) => x.tax > 0 && !x.ein)) issues.push('Enter each W-2’s employer ID for your records.')

  return { lines: L, ad: A, cr: CR, cn: CN, care: K, dependents, statements, issues, attach }
}
