/**
 * Form 1040 (tax year 2025) calculation engine.
 *
 * One pure function: TaxReturnInput → TaxReturnResult. Every Form 1040 line and supporting
 * schedule is derived here, in IRS order, with whole-dollar rounding at each line.
 */
import type { Owner, ScheduleCBusiness, TaxReturnInput } from './model.ts'
import * as R from './rules2025.ts'
import type { FilingStatus } from './rules2025.ts'

export type IssueLevel = 'error' | 'warning' | 'info'
export interface Issue {
  level: IssueLevel
  step: 'about' | 'income' | 'deductions' | 'credits' | 'review'
  message: string
}

export interface ScheduleCResult { id: string; name: string; owner: Owner; grossIncome: number; totalExpenses: number; netProfit: number }
export interface ScheduleSEResult { owner: Owner; netEarnings: number; socialSecurityTax: number; medicareTax: number; total: number }

export interface TaxReturnResult {
  /** Form 1040 lines, keyed by line number. */
  f1040: Record<string, number>
  schedule1: { businessIncome: number; unemployment: number; otherIncome: number; additionalIncome: number; adjustments: Record<string, number>; totalAdjustments: number }
  schedule1A: { tips: number; overtime: number; carLoanInterest: number; senior: number; total: number }
  scheduleA: { medical: number; taxes: number; saltBeforeCap: number; saltCap: number; interest: number; charity: number; other: number; total: number }
  scheduleB: { interest: number; ordinaryDividends: number; required: boolean }
  scheduleC: ScheduleCResult[]
  scheduleD: { shortTerm: number; longTerm: number; net: number; allowedLoss: number; carryoverShort: number; carryoverLong: number; preferentialGain: number }
  scheduleSE: ScheduleSEResult[]
  schedule2: { selfEmploymentTax: number; additionalMedicareTax: number; netInvestmentIncomeTax: number; total: number }
  schedule8812: { qualifyingChildren: number; otherDependents: number; creditBeforePhaseout: number; phaseoutReduction: number; nonrefundable: number; refundable: number }
  qbi: { qualifiedBusinessIncome: number; deduction: number }
  deduction: { standard: number; itemized: number; used: 'standard' | 'itemized' }
  summary: {
    totalIncome: number
    agi: number
    taxableIncome: number
    totalTax: number
    totalPayments: number
    refund: number
    amountOwed: number
    effectiveRate: number
    marginalRate: number
  }
  issues: Issue[]
}

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const sum = (values: readonly number[]): number => values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
const isJoint = (fs: FilingStatus): boolean => fs === 'mfj'
/** Reduction "for each $1,000 or fraction thereof" of excess. */
const stepPhaseout = (excess: number, perThousand: number): number => (excess > 0 ? Math.ceil(excess / 1000) * perThousand : 0)

/** Exact tax from the rate schedule (Tax Computation Worksheet). */
export function taxFromSchedule(taxableIncome: number, fs: FilingStatus): number {
  const brackets = R.BRACKETS[fs]
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const [lower, rate] = brackets[i]
    const upper = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity
    if (taxableIncome <= lower) break
    tax += (Math.min(taxableIncome, upper) - lower) * rate
  }
  return tax
}

/**
 * Tax as the IRS Tax Table computes it for taxable income under $100,000
 * (tax on the midpoint of the $5/$10/$25/$50 row), and the Tax Computation Worksheet above that.
 */
export function regularTax(taxableIncome: number, fs: FilingStatus): number {
  const ti = pos(taxableIncome)
  if (ti <= 0) return 0
  if (ti >= 100000) return r(taxFromSchedule(ti, fs))
  let mid: number
  if (ti < 5) mid = 2.5
  else if (ti < 15) mid = 10
  else if (ti < 25) mid = 20
  else if (ti < 3000) mid = Math.floor(ti / 25) * 25 + 12.5
  else mid = Math.floor(ti / 50) * 50 + 25
  return r(taxFromSchedule(mid, fs))
}

/** Qualified Dividends and Capital Gain Tax Worksheet (Form 1040 instructions, line 16). */
export function qualifiedDividendsTax(taxableIncome: number, qualifiedDividends: number, capitalGain: number, fs: FilingStatus): number {
  const l1 = pos(taxableIncome)
  const l4 = pos(qualifiedDividends) + pos(capitalGain)
  const l5 = pos(l1 - l4)
  const l7 = Math.min(l1, R.CAPITAL_GAIN_ZERO_TOP[fs])
  const l8 = Math.min(l5, l7)
  const l9 = l7 - l8
  const l10 = Math.min(l1, l4)
  const l12 = l10 - l9
  const l14 = Math.min(l1, R.CAPITAL_GAIN_FIFTEEN_TOP[fs])
  const l16 = pos(l14 - (l5 + l9))
  const l17 = Math.min(l12, l16)
  const l18 = l17 * 0.15
  const l20 = l10 - (l9 + l17)
  const l21 = l20 * 0.20
  const l22 = regularTax(l5, fs)
  const l23 = l18 + l21 + l22
  return r(Math.min(l23, regularTax(l1, fs)))
}

function scheduleC(b: ScheduleCBusiness): ScheduleCResult {
  const grossIncome = b.grossReceipts - b.returnsAndAllowances - b.costOfGoodsSold + b.otherIncome
  const totalExpenses = sum(Object.values(b.expenses))
  return { id: b.id, name: b.name || 'Business', owner: b.owner, grossIncome: r(grossIncome), totalExpenses: r(totalExpenses), netProfit: r(grossIncome - totalExpenses) }
}

export function computeReturn(input: TaxReturnInput): TaxReturnResult {
  const fs = input.filingStatus
  const joint = isJoint(fs)
  const issues: Issue[] = []
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const ownedBy = (o: Owner): boolean => owners.includes(o)

  // ── Validation ────────────────────────────────────────────────────────────
  if (!input.taxpayer.firstName.trim() || !input.taxpayer.lastName.trim()) issues.push({ level: 'warning', step: 'about', message: 'Enter your first and last name.' })
  if (joint && (!input.spouse.firstName.trim() || !input.spouse.lastName.trim())) issues.push({ level: 'warning', step: 'about', message: 'Enter your spouse’s name for a joint return.' })
  if (fs === 'hoh' && input.dependents.length === 0) issues.push({ level: 'warning', step: 'about', message: 'Head of household usually requires a qualifying person. Add a dependent or check your filing status.' })
  if (fs === 'qss' && input.dependents.length === 0) issues.push({ level: 'warning', step: 'about', message: 'Qualifying surviving spouse status requires a dependent child.' })
  input.w2s.forEach((w, i) => {
    if (!ownedBy(w.owner)) issues.push({ level: 'error', step: 'income', message: `W-2 #${i + 1} belongs to your spouse, but this is not a joint return. It is excluded.` })
    if (!w.employer.trim()) issues.push({ level: 'warning', step: 'income', message: `W-2 #${i + 1}: enter the employer name.` })
    if (w.federalWithholding > w.wages && w.wages > 0) issues.push({ level: 'warning', step: 'income', message: `W-2 #${i + 1}: federal withholding (box 2) is larger than wages (box 1). Double-check the form.` })
  })
  input.dividends.forEach((d, i) => {
    if (d.qualifiedDividends > d.ordinaryDividends) issues.push({ level: 'error', step: 'income', message: `1099-DIV #${i + 1}: qualified dividends (1b) cannot exceed ordinary dividends (1a). Qualified amount was capped.` })
  })
  input.businesses.forEach((b, i) => { if (!ownedBy(b.owner)) issues.push({ level: 'error', step: 'income', message: `Business #${i + 1} belongs to your spouse, but this is not a joint return. It is excluded.` }) })

  const w2s = input.w2s.filter((w) => ownedBy(w.owner))
  const businesses = input.businesses.filter((b) => ownedBy(b.owner))
  const medicareWages = (w: (typeof w2s)[number]): number => (w.medicareWages > 0 ? w.medicareWages : w.wages)
  const ssWages = (w: (typeof w2s)[number]): number => (w.socialSecurityWages > 0 ? w.socialSecurityWages : w.wages)

  // ── Income ────────────────────────────────────────────────────────────────
  const line1a = r(sum(w2s.map((w) => w.wages)))
  const line1z = line1a
  const line2a = r(sum(input.interest.map((i) => i.taxExemptInterest)))
  const line2b = r(sum(input.interest.map((i) => i.interest)))
  const line3b = r(sum(input.dividends.map((d) => d.ordinaryDividends)))
  const line3a = r(sum(input.dividends.map((d) => Math.min(d.qualifiedDividends, d.ordinaryDividends))))

  // Schedule D
  const stTx = sum(input.capitalTransactions.filter((t) => t.term === 'short').map((t) => t.proceeds - t.costBasis))
  const ltTx = sum(input.capitalTransactions.filter((t) => t.term === 'long').map((t) => t.proceeds - t.costBasis))
  const capGainDistributions = sum(input.dividends.map((d) => d.capitalGainDistributions))
  const shortTerm = r(stTx - input.capitalLossCarryover.shortTerm)
  const longTerm = r(ltTx + capGainDistributions - input.capitalLossCarryover.longTerm)
  const netCapital = shortTerm + longTerm
  const lossLimit = R.CAPITAL_LOSS_LIMIT[fs]
  const line7 = netCapital >= 0 ? netCapital : -Math.min(-netCapital, lossLimit)
  let carryoverShort = 0
  let carryoverLong = 0
  if (netCapital < -lossLimit) {
    // Capital Loss Carryover Worksheet (simplified ordering: short-term loss absorbs the allowed amount first)
    const stLoss = pos(-shortTerm) - pos(longTerm)
    const usedByShort = Math.min(pos(stLoss), lossLimit)
    carryoverShort = pos(stLoss - usedByShort)
    const ltLoss = pos(-longTerm) - pos(shortTerm)
    carryoverLong = pos(ltLoss - (lossLimit - usedByShort))
    issues.push({ level: 'info', step: 'income', message: `Your net capital loss exceeds the $${lossLimit.toLocaleString()} limit. About $${(carryoverShort + carryoverLong).toLocaleString()} carries over to 2026.` })
  }
  const preferentialGain = pos(Math.min(longTerm, netCapital))

  // Schedule C
  const scheduleCResults = businesses.map(scheduleC)
  const businessIncome = sum(scheduleCResults.map((b) => b.netProfit))

  // Schedule SE
  const scheduleSE: ScheduleSEResult[] = owners.map((owner) => {
    const profit = sum(scheduleCResults.filter((b) => b.owner === owner).map((b) => b.netProfit))
    const earnings = profit * R.SE_NET_EARNINGS_FACTOR
    if (earnings < R.SE_MINIMUM_NET_EARNINGS) return { owner, netEarnings: 0, socialSecurityTax: 0, medicareTax: 0, total: 0 }
    const wagesForSS = sum(w2s.filter((w) => w.owner === owner).map(ssWages))
    const ssBase = Math.min(earnings, pos(R.SOCIAL_SECURITY_WAGE_BASE - wagesForSS))
    const socialSecurityTax = r(ssBase * R.SOCIAL_SECURITY_RATE_SE)
    const medicareTax = r(earnings * R.MEDICARE_RATE_SE)
    return { owner, netEarnings: r(earnings), socialSecurityTax, medicareTax, total: socialSecurityTax + medicareTax }
  }).filter((s) => s.netEarnings > 0)
  const seTax = sum(scheduleSE.map((s) => s.total))
  const halfSeTax = r(seTax / 2)

  // Schedule 1, Part I
  const unemployment = r(input.unemployment)
  const otherIncome = r(input.otherIncome)
  const additionalIncome = r(businessIncome + unemployment + otherIncome)
  const line8 = additionalIncome
  const line9 = r(line1z + line2b + line3b + line7 + line8)

  // Schedule 1, Part II (adjustments)
  const a = input.adjustments
  const educatorCap = joint ? 600 : 300
  const educator = Math.min(pos(a.educatorExpenses), educatorCap)
  if (a.educatorExpenses > educatorCap) issues.push({ level: 'info', step: 'deductions', message: `Educator expenses are limited to $${educatorCap}.` })
  const seHealthLimit = pos(businessIncome - halfSeTax)
  const seHealth = Math.min(pos(a.selfEmployedHealthInsurance), seHealthLimit)
  if (a.selfEmployedHealthInsurance > seHealthLimit) issues.push({ level: 'info', step: 'deductions', message: 'Self-employed health insurance is limited to your net business profit minus half of SE tax.' })
  if (a.selfEmployedHealthInsurance > 0 && businesses.length === 0) issues.push({ level: 'warning', step: 'deductions', message: 'Self-employed health insurance requires self-employment income.' })
  const hsa = pos(a.hsaDeduction)
  const ira = pos(a.iraDeduction)
  // Student loan interest phases out on MAGI (AGI figured without this deduction)
  const magiBeforeSli = line9 - (educator + hsa + halfSeTax + seHealth + ira)
  let studentLoan = 0
  const sliRange = R.STUDENT_LOAN_PHASEOUT[fs]
  if (a.studentLoanInterest > 0) {
    if (!sliRange) issues.push({ level: 'warning', step: 'deductions', message: 'Student loan interest cannot be deducted when married filing separately.' })
    else {
      const base = Math.min(a.studentLoanInterest, R.STUDENT_LOAN_INTEREST_MAX)
      const fraction = Math.min(1, pos(magiBeforeSli - sliRange[0]) / (sliRange[1] - sliRange[0]))
      studentLoan = r(base * (1 - fraction))
    }
  }
  const adjustments = { educatorExpenses: r(educator), hsaDeduction: r(hsa), deductibleHalfOfSeTax: halfSeTax, selfEmployedHealthInsurance: r(seHealth), iraDeduction: r(ira), studentLoanInterest: studentLoan }
  const line10 = r(sum(Object.values(adjustments)))
  const line11 = r(line9 - line10)
  const agi = line11
  const magi = agi

  // ── Deductions ────────────────────────────────────────────────────────────
  const people = joint ? [input.taxpayer, input.spouse] : [input.taxpayer]
  const boxes = sum(people.map((p) => (p.age65OrOlder ? 1 : 0) + (p.blind ? 1 : 0)))
  const addlEach = fs === 'single' || fs === 'hoh' ? R.ADDITIONAL_STD_UNMARRIED : R.ADDITIONAL_STD_MARRIED
  let basicStd = R.STANDARD_DEDUCTION[fs]
  if (input.canBeClaimedAsDependent) {
    const earned = line1a + pos(businessIncome - halfSeTax)
    basicStd = Math.min(basicStd, Math.max(R.DEPENDENT_STD_MIN, earned + R.DEPENDENT_STD_EARNED_ADDON))
  }
  const standard = basicStd + boxes * addlEach

  const it = input.itemized
  const medical = r(pos(it.medical - agi * R.MEDICAL_AGI_FLOOR))
  const saltBeforeCap = r(it.stateLocalIncomeOrSalesTax + it.realEstateTax + it.personalPropertyTax)
  const saltCap = Math.max(R.SALT_FLOOR[fs], R.SALT_CAP[fs] - pos(magi - R.SALT_PHASEDOWN_THRESHOLD[fs]) * R.SALT_PHASEDOWN_RATE)
  const taxes = r(Math.min(saltBeforeCap, saltCap))
  const charity = r(it.charityCash + it.charityNonCash)
  if (it.charityCash > agi * 0.6 && it.charityCash > 0) issues.push({ level: 'warning', step: 'deductions', message: 'Cash gifts above 60% of AGI are limited; the excess carries forward. This return does not apply that limit.' })
  if (it.charityNonCash > 500) issues.push({ level: 'info', step: 'deductions', message: 'Noncash gifts over $500 require Form 8283 with your return.' })
  const itemizedTotal = r(medical + taxes + it.mortgageInterest + charity + it.other)

  let used: 'standard' | 'itemized'
  if (input.deductionChoice === 'standard') used = 'standard'
  else if (input.deductionChoice === 'itemized') used = 'itemized'
  else used = itemizedTotal > standard ? 'itemized' : 'standard'
  if (fs === 'mfs' && input.deductionChoice === 'auto') issues.push({ level: 'info', step: 'deductions', message: 'If your spouse itemizes on a separate return, you must itemize too. Choose “Itemize” in that case.' })
  if (input.deductionChoice !== 'auto' && used === 'itemized' && itemizedTotal < standard) issues.push({ level: 'info', step: 'deductions', message: 'Your itemized deductions are lower than the standard deduction.' })
  const line12 = used === 'itemized' ? itemizedTotal : standard

  // Schedule 1-A
  const s = input.schedule1A
  const marriedNotJoint = fs === 'mfs'
  if (marriedNotJoint && (s.qualifiedTips > 0 || s.qualifiedOvertime > 0)) issues.push({ level: 'warning', step: 'deductions', message: 'Married taxpayers must file jointly to deduct tips or overtime.' })
  const tipOtReduction = stepPhaseout(magi - R.TIPS_OVERTIME_PHASEOUT_START[fs], R.TIPS_OVERTIME_PHASEOUT_PER_1000)
  const tips = marriedNotJoint ? 0 : r(pos(Math.min(s.qualifiedTips, R.TIPS_MAX) - tipOtReduction))
  const overtime = marriedNotJoint ? 0 : r(pos(Math.min(s.qualifiedOvertime, R.OVERTIME_MAX[fs]) - tipOtReduction))
  const carLoan = r(pos(Math.min(s.carLoanInterest, R.CAR_LOAN_INTEREST_MAX) - stepPhaseout(magi - R.CAR_LOAN_PHASEOUT_START[fs], R.CAR_LOAN_PHASEOUT_PER_1000)))
  const seniors = marriedNotJoint ? 0 : sum((joint ? [input.taxpayer, input.spouse] : [input.taxpayer]).map((p) => (p.age65OrOlder ? 1 : 0)))
  const senior = r(pos(seniors * R.SENIOR_DEDUCTION - (seniors > 0 ? pos(magi - R.SENIOR_PHASEOUT_START[fs]) * R.SENIOR_PHASEOUT_RATE : 0)))
  if (marriedNotJoint && input.taxpayer.age65OrOlder) issues.push({ level: 'info', step: 'deductions', message: 'The $6,000 senior deduction is not available when married filing separately.' })
  if (s.carLoanInterest > 0) issues.push({ level: 'info', step: 'deductions', message: 'Car loan interest qualifies only for a new personal-use vehicle assembled in the U.S., bought after 2024. Keep the VIN for Schedule 1-A.' })
  const line13b = tips + overtime + carLoan + senior

  // QBI deduction (Form 8995)
  const tiBeforeQbi = pos(agi - line12 - line13b)
  const qbiAmount = pos(businessIncome - halfSeTax - seHealth)
  let line13a = 0
  if (qbiAmount > 0) {
    if (tiBeforeQbi > R.QBI_SIMPLE_THRESHOLD[fs]) {
      issues.push({ level: 'warning', step: 'review', message: 'Your taxable income is above the Form 8995 threshold. The QBI deduction needs Form 8995-A (wage and property limits), which this app does not calculate, so it is set to $0.' })
    } else {
      const netCapitalGainForQbi = line3a + preferentialGain
      line13a = r(Math.min(qbiAmount * R.QBI_RATE, pos(tiBeforeQbi - netCapitalGainForQbi) * R.QBI_RATE))
    }
  }
  const line14 = line12 + line13a + line13b
  const line15 = pos(line11 - line14)

  // ── Tax ───────────────────────────────────────────────────────────────────
  const usesWorksheet = line3a + preferentialGain > 0
  const line16 = usesWorksheet ? qualifiedDividendsTax(line15, line3a, preferentialGain, fs) : regularTax(line15, fs)
  const line17 = 0
  const line18 = line16 + line17

  // Schedule 8812
  const qualifyingChildren = input.dependents.filter((d) => d.qualifyingChild).length
  const otherDependents = input.dependents.length - qualifyingChildren
  const creditBeforePhaseout = qualifyingChildren * R.CTC_PER_CHILD + otherDependents * R.ODC_PER_DEPENDENT
  const phaseoutReduction = Math.min(creditBeforePhaseout, stepPhaseout(magi - R.CTC_PHASEOUT_START[fs], R.CTC_PHASEOUT_PER_1000))
  const creditAfterPhaseout = creditBeforePhaseout - phaseoutReduction
  const nonrefundable = Math.min(creditAfterPhaseout, line18)
  const unused = creditAfterPhaseout - nonrefundable
  const earnedIncome = line1a + pos(sum(scheduleSE.map((x) => x.netEarnings)) - halfSeTax)
  let refundable = 0
  if (qualifyingChildren > 0 && unused > 0) {
    refundable = r(Math.min(unused, qualifyingChildren * R.ACTC_REFUNDABLE_MAX_PER_CHILD, pos(earnedIncome - R.ACTC_EARNED_INCOME_FLOOR) * R.ACTC_EARNED_INCOME_RATE))
    if (qualifyingChildren >= 3) issues.push({ level: 'info', step: 'credits', message: 'With 3 or more children, the refundable child credit may be larger under the Social Security tax method (Schedule 8812, Part II-B), which is not calculated here.' })
  }
  const line19 = nonrefundable
  const line20 = 0
  const line21 = line19 + line20
  const line22 = pos(line18 - line21)

  // Schedule 2, Part II
  const threshold = R.HIGH_INCOME_THRESHOLD[fs]
  const totalMedicareWages = sum(w2s.map(medicareWages))
  const seEarnings = sum(scheduleSE.map((x) => x.netEarnings))
  const addlMedicare = r(pos(totalMedicareWages - threshold) * R.ADDITIONAL_MEDICARE_RATE + pos(seEarnings - pos(threshold - totalMedicareWages)) * R.ADDITIONAL_MEDICARE_RATE)
  const netInvestmentIncome = pos(line2b + line3b + line7)
  const niit = r(Math.min(netInvestmentIncome, pos(magi - threshold)) * R.NIIT_RATE)
  const schedule2Total = seTax + addlMedicare + niit
  const line23 = schedule2Total
  const line24 = line22 + line23

  // ── Payments ──────────────────────────────────────────────────────────────
  const line25a = r(sum(w2s.map((w) => w.federalWithholding)))
  const line25b = r(sum(input.interest.map((i) => i.federalWithholding)) + sum(input.dividends.map((d) => d.federalWithholding)) + input.payments.otherWithholding)
  const addlMedicareWithheld = r(pos(sum(w2s.map((w) => w.medicareWithheld)) - totalMedicareWages * R.MEDICARE_EMPLOYEE_RATE))
  const line25c = addlMedicareWithheld
  const line25d = line25a + line25b + line25c
  const line26 = r(input.payments.estimatedTaxPayments)
  const line28 = refundable
  // Excess Social Security withheld (Schedule 3 line 11), per person with 2+ employers
  const maxSsTax = r(R.SOCIAL_SECURITY_WAGE_BASE * 0.062 * 100) / 100
  const excessSs = r(sum(owners.map((o) => {
    const forms = w2s.filter((w) => w.owner === o)
    if (forms.length < 2) return 0
    return pos(sum(forms.map((w) => w.socialSecurityWithheld)) - maxSsTax)
  })))
  const line31 = excessSs
  const line32 = line28 + line31
  const line33 = line25d + line26 + line32

  const line34 = pos(line33 - line24)
  const line37 = pos(line24 - line33)

  // ── Coverage notes ────────────────────────────────────────────────────────
  const looksEicEligible = earnedIncome > 0 && agi < (qualifyingChildren > 0 ? 68675 : 19104) && line2b + line3b + pos(line7) <= 11950 && fs !== 'mfs'
  if (looksEicEligible) issues.push({ level: 'warning', step: 'credits', message: 'You may qualify for the Earned Income Credit. This app does not calculate it yet, so your refund may be understated.' })
  if (agi > 200000 && line15 > 0) issues.push({ level: 'info', step: 'review', message: 'Alternative Minimum Tax (Form 6251) is not calculated. Most filers at this income still owe none, but check if you have ISOs or large deductions.' })
  if (line37 > 1000 && line25d + line26 < Math.min(line24 * 0.9, line24)) issues.push({ level: 'info', step: 'review', message: 'You owe more than $1,000. An underpayment penalty (Form 2210) may apply; it is not calculated here.' })
  if (scheduleSE.length && businesses.length) issues.push({ level: 'info', step: 'income', message: 'Schedule C is figured on the cash method from the totals you enter. Depreciation (Form 4562) and inventory details are not itemized.' })
  if (w2s.some((w) => w.wages > 0 && (w.medicareWages === 0 || w.socialSecurityWages === 0))) issues.push({ level: 'info', step: 'income', message: 'For W-2s where box 3 or box 5 is blank, box 1 wages were used instead.' })
  if (input.dependents.some((d) => !d.name.trim())) issues.push({ level: 'warning', step: 'about', message: 'Enter a name for each dependent.' })

  const marginalRate = (() => {
    const b = R.BRACKETS[fs]
    let rate = 0
    for (const [lower, rt] of b) if (line15 > lower) rate = rt
    return rate
  })()

  return {
    f1040: {
      '1a': line1a, '1z': line1z, '2a': line2a, '2b': line2b, '3a': line3a, '3b': line3b,
      '7': line7, '8': line8, '9': line9, '10': line10, '11': line11, '12': line12, '13a': line13a, '13b': line13b,
      '14': line14, '15': line15, '16': line16, '17': line17, '18': line18, '19': line19, '20': line20,
      '21': line21, '22': line22, '23': line23, '24': line24, '25a': line25a, '25b': line25b, '25c': line25c,
      '25d': line25d, '26': line26, '27': 0, '28': line28, '29': 0, '31': line31, '32': line32, '33': line33,
      '34': line34, '37': line37
    },
    schedule1: { businessIncome: r(businessIncome), unemployment, otherIncome, additionalIncome, adjustments, totalAdjustments: line10 },
    schedule1A: { tips, overtime, carLoanInterest: carLoan, senior, total: line13b },
    scheduleA: { medical, taxes, saltBeforeCap, saltCap: r(saltCap), interest: r(it.mortgageInterest), charity, other: r(it.other), total: itemizedTotal },
    scheduleB: { interest: line2b, ordinaryDividends: line3b, required: line2b > 1500 || line3b > 1500 },
    scheduleC: scheduleCResults,
    scheduleD: { shortTerm, longTerm, net: netCapital, allowedLoss: line7 < 0 ? -line7 : 0, carryoverShort, carryoverLong, preferentialGain },
    scheduleSE,
    schedule2: { selfEmploymentTax: seTax, additionalMedicareTax: addlMedicare, netInvestmentIncomeTax: niit, total: schedule2Total },
    schedule8812: { qualifyingChildren, otherDependents, creditBeforePhaseout, phaseoutReduction, nonrefundable, refundable },
    qbi: { qualifiedBusinessIncome: r(qbiAmount), deduction: line13a },
    deduction: { standard, itemized: itemizedTotal, used },
    summary: {
      totalIncome: line9, agi, taxableIncome: line15, totalTax: line24, totalPayments: line33,
      refund: line34, amountOwed: line37,
      effectiveRate: line9 > 0 ? line24 / line9 : 0,
      marginalRate
    },
    issues
  }
}
