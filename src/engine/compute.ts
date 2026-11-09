/**
 * Form 1040 (tax year 2025) calculation engine.
 *
 * One pure function: TaxReturnInput → TaxReturnResult. Every Form 1040 line and supporting
 * schedule is derived here, in IRS order, with whole-dollar rounding at each line.
 */
import type { Dependent, Owner, Person, ScheduleCBusiness, TaxReturnInput } from './model.ts'
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
  schedule1A: {
    magi: number
    tipsCapped: number; tipOtExcess: number; tipOtReduction: number; tips: number
    overtimeCapped: number; overtime: number
    carCapped: number; carExcess: number; carReduction: number; carLoanInterest: number
    seniorExcess: number; seniorEach: number; seniorTaxpayer: number; seniorSpouse: number; senior: number
    total: number
  }
  scheduleA: { medical: number; taxes: number; saltBeforeCap: number; saltCap: number; interest: number; charity: number; other: number; total: number }
  scheduleB: { interest: number; ordinaryDividends: number; required: boolean }
  scheduleC: ScheduleCResult[]
  scheduleD: { shortTerm: number; longTerm: number; net: number; allowedLoss: number; carryoverShort: number; carryoverLong: number; preferentialGain: number }
  scheduleSE: ScheduleSEResult[]
  schedule2: { selfEmploymentTax: number; additionalMedicareTax: number; netInvestmentIncomeTax: number; earlyDistributionTax: number; total: number }
  schedule3: { dependentCare: number; education: number; excessSocialSecurity: number }
  form2441: {
    qualifyingPersons: number; expensesUsed: number; rate: number; credit: number
    line3: number; line4: number; line5: number
    partIII: { line12: number; line16: number; line17: number; line18: number; line19: number; line20: number; line21: number; line25: number; line26: number; line27: number; line28: number; line29: number; line30: number; line31: number } | null
  }
  form8863Detail: { phaseoutFraction: number; aotcTentative: number; llcTentative: number; llcExpenses: number }
  form8863: { aotc: number; aotcRefundable: number; llc: number; nonrefundableAllowed: number }
  eic: { qualifyingChildren: number; earnedIncome: number; investmentIncome: number; credit: number; notEligibleBecause: string[] }
  schedule8812: { qualifyingChildren: number; otherDependents: number; creditBeforePhaseout: number; phaseoutReduction: number; nonrefundable: number; refundable: number }
  qbi: { qualifiedBusinessIncome: number; deduction: number; taxableIncomeBeforeQbi: number; netCapitalGain: number }
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
const is65 = (p: Person): boolean => p.age >= 65 || p.age65OrOlder
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

/** Child Tax Credit child: under 17, SSN, lived with you more than half the year, child-type relationship. */
export const ctcChild = (d: Dependent): boolean => d.age < 17 && d.hasSsn && d.childRelationship && d.monthsLivedWithYou > 6
/** EIC qualifying child: relationship, residency, and under 19 / under 24 student / any age disabled. */
export const eicChild = (d: Dependent): boolean =>
  d.childRelationship && d.hasSsn && d.monthsLivedWithYou > 6 && (d.age < 19 || (d.student && d.age < 24) || d.disabled)
/** Form 2441 qualifying person: dependent under 13, or disabled, who lived with you more than half the year. */
export const careQualifyingPerson = (d: Dependent): boolean => d.monthsLivedWithYou > 6 && (d.age <= R.CARE_QUALIFYING_CHILD_MAX_AGE || d.disabled)

/** EIC from the IRS table: credit on the midpoint of the $50 row containing `amount`. */
export function eicFromTable(amount: number, children: number, phaseoutStart: number): number {
  if (amount <= 0) return 0
  const mid = Math.floor(amount / 50) * 50 + 25
  const k = Math.min(3, Math.max(0, children))
  const credit = Math.min(mid * R.EIC_CREDIT_RATE[k], R.EIC_MAX_CREDIT[k]) - pos(mid - phaseoutStart) * R.EIC_PHASEOUT_RATE[k]
  return r(pos(credit))
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
  const ssnOk = (v: string): boolean => /^\d{9}$/.test(v.replace(/\D/g, ''))
  if (!ssnOk(input.taxpayer.ssn)) issues.push({ level: 'warning', step: 'about', message: 'Enter your 9-digit Social Security number. The IRS forms need it.' })
  if (joint && !ssnOk(input.spouse.ssn)) issues.push({ level: 'warning', step: 'about', message: 'Enter your spouse’s Social Security number.' })
  if (input.dependents.some((d) => !ssnOk(d.ssn))) issues.push({ level: 'warning', step: 'about', message: 'Enter a Social Security number for each dependent.' })
  if (!input.contact.street.trim() || !input.contact.city.trim() || !input.contact.zip.trim()) issues.push({ level: 'warning', step: 'about', message: 'Enter your home address for the IRS forms.' })
  if (input.digitalAssets === null) issues.push({ level: 'warning', step: 'income', message: 'Answer the digital assets question. Form 1040 requires a Yes or No.' })
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
  input.businesses.forEach((b, i) => {
    const who = b.name.trim() || `Business ${i + 1}`
    if (!/^\d{6}$/.test(b.businessCode)) issues.push({ level: 'warning', step: 'income', message: `${who}: enter the 6-digit principal business code from the Schedule C instructions (box B).` })
    if (b.required1099s === null) issues.push({ level: 'warning', step: 'income', message: `${who}: answer whether you made payments that require Forms 1099 (Schedule C, line I).` })
    if (b.expenses.carAndTruck > 0 && (!b.vehicle.placedInService.trim() || b.vehicle.businessMiles <= 0)) issues.push({ level: 'warning', step: 'income', message: `${who}: car and truck expenses need the vehicle details (Schedule C, Part IV).` })
    if (b.costOfGoodsSold > 0) issues.push({ level: 'info', step: 'income', message: `${who}: cost of goods sold is printed on Schedule C line 4 and 42. Fill in the inventory lines 33–41 on the printed form by hand.` })
    if (b.expenses.homeOffice > 0) issues.push({ level: 'info', step: 'income', message: `${who}: home office expenses (line 30) need Form 8829 or the simplified-method worksheet; attach it or enter the square footage on the printed form.` })
    if (!b.materiallyParticipated) issues.push({ level: 'warning', step: 'income', message: `${who}: if you did not materially participate, passive activity loss limits (Form 8582) may apply. They are not figured here.` })
  })
  input.businesses.forEach((b, i) => { if (!ownedBy(b.owner)) issues.push({ level: 'error', step: 'income', message: `Business #${i + 1} belongs to your spouse, but this is not a joint return. It is excluded.` }) })

  const w2s = input.w2s.filter((w) => ownedBy(w.owner))
  const businesses = input.businesses.filter((b) => ownedBy(b.owner))
  const medicareWages = (w: (typeof w2s)[number]): number => (w.medicareWages > 0 ? w.medicareWages : w.wages)
  const ssWages = (w: (typeof w2s)[number]): number => (w.socialSecurityWages > 0 ? w.socialSecurityWages : w.wages)

  // ── Income ────────────────────────────────────────────────────────────────
  const line1a = r(sum(w2s.map((w) => w.wages)))
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

  // Earned income per person (wages + net SE earnings less the deductible half of SE tax)
  const earnedOf = (o: Owner): number => {
    const wages = sum(w2s.filter((w) => w.owner === o).map((w) => w.wages))
    const se = scheduleSE.find((x) => x.owner === o)
    return wages + (se ? se.netEarnings - se.total / 2 : 0)
  }
  const earnedIncome = r(sum(owners.map(earnedOf)))

  // Form 2441 Part III — dependent care benefits. Benefits above the exclusion are taxable wages (line 1e).
  const care = input.dependentCare
  const earnedTaxpayer = r(earnedOf('taxpayer'))
  const earnedSpouse = joint ? r(earnedOf('spouse')) : earnedTaxpayer
  const p3 = { line12: 0, line16: 0, line17: 0, line18: 0, line19: 0, line20: 0, line21: 0, line25: 0, line26: 0 }
  if (care.employerBenefits > 0) {
    p3.line12 = r(care.employerBenefits)
    p3.line16 = r(care.expenses)
    p3.line17 = Math.min(p3.line12, p3.line16)
    p3.line18 = earnedTaxpayer
    p3.line19 = earnedSpouse
    p3.line20 = Math.max(0, Math.min(p3.line17, p3.line18, p3.line19))
    p3.line21 = R.CARE_BENEFIT_EXCLUSION_LIMIT[fs]
    p3.line25 = Math.min(p3.line20, p3.line21)
    p3.line26 = pos(p3.line12 - p3.line25)
    if (p3.line26 > 0) issues.push({ level: 'info', step: 'credits', message: `$${p3.line26.toLocaleString()} of your dependent care benefits is taxable and was added to Form 1040 line 1e.` })
  }
  const line1e = p3.line26
  const line1z = line1a + line1e

  // Retirement distributions (1099-R → lines 4a/4b, 5a/5b)
  input.retirement.forEach((d, i) => {
    if (!ownedBy(d.owner)) issues.push({ level: 'error', step: 'income', message: `1099-R #${i + 1} belongs to your spouse, but this is not a joint return. It is excluded.` })
    if (d.taxableAmount > d.grossDistribution && d.grossDistribution > 0) issues.push({ level: 'warning', step: 'income', message: `1099-R #${i + 1}: the taxable amount (box 2a) is larger than the gross distribution (box 1).` })
    const code = d.code.trim().toUpperCase()
    if (code.includes('G')) issues.push({ level: 'info', step: 'income', message: `1099-R #${i + 1} is a direct rollover (code G). It is usually not taxable; box 2a should be $0.` })
    if (code === '') issues.push({ level: 'warning', step: 'income', message: `1099-R #${i + 1}: enter the distribution code from box 7.` })
  })
  const retirement = input.retirement.filter((d) => ownedBy(d.owner))
  const iraForms = retirement.filter((d) => d.ira)
  const pensionForms = retirement.filter((d) => !d.ira)
  const line4a = r(sum(iraForms.map((d) => d.grossDistribution)))
  const line4b = r(sum(iraForms.map((d) => d.taxableAmount)))
  const line5a = r(sum(pensionForms.map((d) => d.grossDistribution)))
  const line5b = r(sum(pensionForms.map((d) => d.taxableAmount)))
  const earlyDistributionBase = sum(retirement.filter((d) => d.code.trim().toUpperCase().includes('1')).map((d) => d.taxableAmount))
  const earlyDistributionTax = r(earlyDistributionBase * R.EARLY_DISTRIBUTION_RATE)
  if (earlyDistributionTax > 0) issues.push({ level: 'warning', step: 'income', message: `A 10% additional tax of $${earlyDistributionTax.toLocaleString()} applies to early distributions (code 1). If an exception applies (disability, first home, medical costs and others), Form 5329 can reduce it; that is not figured here.` })

  // Schedule 1, Part I
  const unemployment = r(input.unemployment)
  const otherIncome = r(input.otherIncome)
  const additionalIncome = r(businessIncome + unemployment + otherIncome)
  const line8 = additionalIncome

  // Schedule 1, Part II (adjustments other than student loan interest)
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
  const adjustmentsBeforeSli = educator + hsa + halfSeTax + seHealth + ira

  // Social Security Benefits Worksheet (lines 6a/6b)
  const ssForms = input.socialSecurity.filter((x) => ownedBy(x.owner))
  const line6a = r(sum(ssForms.map((x) => x.netBenefits)))
  let line6b = 0
  if (line6a > 0) {
    const half = line6a / 2
    const otherIncomeForSs = line1z + line2b + line3b + line4b + line5b + line7 + line8
    const combined = half + otherIncomeForSs + line2a - adjustmentsBeforeSli
    if (fs === 'mfs') {
      line6b = r(Math.min(pos(combined) * 0.85, line6a * 0.85))
      issues.push({ level: 'info', step: 'income', message: 'Married filing separately: Social Security was figured as if you lived with your spouse in 2025. If you lived apart all year, the $25,000 base applies instead.' })
    } else {
      const overBase = pos(combined - R.SS_BASE_AMOUNT[fs])
      if (overBase > 0) {
        const tier = R.SS_ADJUSTED_BASE[fs] - R.SS_BASE_AMOUNT[fs]
        const l11 = pos(overBase - tier)
        const l13 = Math.min(overBase, tier) / 2
        const l16 = Math.min(half, l13) + l11 * 0.85
        line6b = r(Math.min(l16, line6a * 0.85))
      }
    }
    if (a.iraDeduction > 0) issues.push({ level: 'info', step: 'deductions', message: 'With Social Security benefits and an IRA deduction, check the IRA limit with the Pub. 590-A worksheets.' })
  }

  const line9 = r(line1z + line2b + line3b + line4b + line5b + line6b + line7 + line8)

  // Student loan interest phases out on MAGI (AGI figured without this deduction)
  const magiBeforeSli = line9 - adjustmentsBeforeSli
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
  const boxes = sum(people.map((p) => (is65(p) ? 1 : 0) + (p.blind ? 1 : 0)))
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
  // Tips (lines 4–13) and overtime (lines 14–21): reduced $100 per FULL $1,000 of MAGI over the threshold
  const tipOtExcess = marriedNotJoint ? 0 : pos(magi - R.TIPS_OVERTIME_PHASEOUT_START[fs])
  const tipOtReduction = Math.floor(tipOtExcess / 1000) * R.TIPS_OVERTIME_PHASEOUT_PER_1000
  const tipsCapped = marriedNotJoint ? 0 : r(Math.min(pos(s.qualifiedTips), R.TIPS_MAX))
  const overtimeCapped = marriedNotJoint ? 0 : r(Math.min(pos(s.qualifiedOvertime), R.OVERTIME_MAX[fs]))
  const tips = pos(tipsCapped - tipOtReduction)
  const overtime = pos(overtimeCapped - tipOtReduction)
  // Car loan interest (lines 22–30): reduced $200 per $1,000 or fraction of MAGI over the threshold
  const carCapped = r(Math.min(pos(s.carLoanInterest), R.CAR_LOAN_INTEREST_MAX))
  const carExcess = pos(magi - R.CAR_LOAN_PHASEOUT_START[fs])
  const carReduction = stepPhaseout(carExcess, R.CAR_LOAN_PHASEOUT_PER_1000)
  const carLoan = pos(carCapped - carReduction)
  // Seniors (lines 31–37): $6,000 per qualifying person, each reduced by 6% of MAGI over the threshold
  const seniorExcess = pos(magi - R.SENIOR_PHASEOUT_START[fs])
  const seniorEach = r(pos(R.SENIOR_DEDUCTION - seniorExcess * R.SENIOR_PHASEOUT_RATE))
  const seniorTaxpayer = !marriedNotJoint && is65(input.taxpayer) ? seniorEach : 0
  const seniorSpouse = joint && is65(input.spouse) ? seniorEach : 0
  const senior = seniorTaxpayer + seniorSpouse
  if (marriedNotJoint && is65(input.taxpayer)) issues.push({ level: 'info', step: 'deductions', message: 'The $6,000 senior deduction is not available when married filing separately.' })
  if (s.carLoanInterest > 0) issues.push({ level: 'info', step: 'deductions', message: 'Car loan interest qualifies only for a new personal-use vehicle assembled in the U.S., bought after 2024. Keep the VIN for Schedule 1-A.' })
  const line13b = tips + overtime + carLoan + senior

  // QBI deduction (Form 8995)
  const tiBeforeQbi = pos(agi - line12 - line13b)
  const qbiAmount = pos(businessIncome - halfSeTax - seHealth)
  let line13a = 0
  const netCapitalGainForQbi = line3a + preferentialGain
  if (qbiAmount > 0) {
    if (tiBeforeQbi > R.QBI_SIMPLE_THRESHOLD[fs]) {
      issues.push({ level: 'warning', step: 'review', message: 'Your taxable income is above the Form 8995 threshold. The QBI deduction needs Form 8995-A (wage and property limits), which this app does not calculate, so it is set to $0.' })
    } else {
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

  // Form 2441 Parts II and III (lines 27–31) — Child and Dependent Care Credit (Schedule 3 line 2)
  const carePersons = input.dependents.filter(careQualifyingPerson).length
  const f2441 = { line3: 0, line4: earnedTaxpayer, line5: earnedSpouse, line6: 0, rate: 0, line9a: 0, line27: 0, line28: 0, line29: 0, line30: 0, line31: 0 }
  if (care.expenses > 0 || care.employerBenefits > 0) {
    if (carePersons === 0) issues.push({ level: 'warning', step: 'credits', message: 'Child care expenses need a qualifying person: a dependent under 13, or a dependent who is disabled.' })
    else if (fs === 'mfs') issues.push({ level: 'warning', step: 'credits', message: 'The child care credit is generally not available when married filing separately.' })
    else {
      const limit = carePersons >= 2 ? R.CARE_EXPENSE_LIMIT_TWO_PLUS : R.CARE_EXPENSE_LIMIT_ONE
      if (care.employerBenefits > 0) {
        f2441.line27 = limit
        f2441.line28 = p3.line25
        f2441.line29 = pos(limit - p3.line25)
        f2441.line30 = r(pos(care.expenses - p3.line25))
        f2441.line31 = Math.min(f2441.line29, f2441.line30)
        f2441.line3 = f2441.line31
      } else {
        f2441.line3 = r(Math.min(care.expenses, limit))
      }
      f2441.line6 = pos(Math.min(f2441.line3, f2441.line4, f2441.line5))
      f2441.rate = Math.max(R.CARE_MIN_RATE, R.CARE_MAX_RATE - 0.01 * Math.ceil(pos(agi - R.CARE_RATE_STEP_START) / R.CARE_RATE_STEP))
      f2441.line9a = r(f2441.line6 * f2441.rate)
      if (joint && Math.min(earnedTaxpayer, earnedSpouse) <= 0) issues.push({ level: 'info', step: 'credits', message: 'Both spouses need earned income for the child care credit, unless one was a full-time student or disabled (not figured here).' })
      const providerTotal = sum(care.providers.map((p) => p.amountPaid))
      if (care.providers.length === 0) issues.push({ level: 'warning', step: 'credits', message: 'Form 2441 requires the name, address and SSN or EIN of each care provider. Add them under Child and dependent care.' })
      else if (Math.abs(providerTotal - care.expenses) > 1) issues.push({ level: 'info', step: 'credits', message: `Amounts paid to care providers (${'$'}${r(providerTotal).toLocaleString()}) differ from the care expenses you entered (${'$'}${r(care.expenses).toLocaleString()}).` })
      if (care.providers.some((p) => p.householdEmployee)) issues.push({ level: 'info', step: 'credits', message: 'A care provider who is your household employee may require Schedule H (household employment taxes), which this app does not prepare.' })
    }
  }
  const careCredit = f2441.line9a
  const careRate = f2441.rate
  const careExpensesUsed = f2441.line6

  // Form 8863 — Education credits
  input.students.filter((st) => st.qualifiedExpenses > 0).forEach((st, i) => {
    const who = st.name.trim() || `Student ${i + 1}`
    if (!ssnOk(st.ssn)) issues.push({ level: 'warning', step: 'credits', message: `${who}: enter the student’s Social Security number for Form 8863.` })
    if (!st.institution.trim()) issues.push({ level: 'warning', step: 'credits', message: `${who}: enter the school’s name for Form 8863.` })
    if (st.aotcEligible && !/^\d{9}$/.test(st.institutionEin.replace(/\D/g, ''))) issues.push({ level: 'warning', step: 'credits', message: `${who}: the American Opportunity Credit requires the school’s EIN from Form 1098-T.` })
  })
  let aotcTentative = 0
  let llcExpenses = 0
  for (const st of input.students) {
    const x = pos(st.qualifiedExpenses)
    if (st.aotcEligible) aotcTentative += Math.min(x, R.AOTC_FULL_EXPENSES) + R.AOTC_PARTIAL_RATE * Math.min(pos(x - R.AOTC_FULL_EXPENSES), R.AOTC_PARTIAL_EXPENSES)
    else llcExpenses += x
  }
  const llcTentative = Math.min(llcExpenses, R.LLC_EXPENSE_LIMIT) * R.LLC_RATE
  let aotc = 0
  let llc = 0
  let eduFraction = 0
  if (aotcTentative + llcTentative > 0) {
    const range = R.EDUCATION_PHASEOUT[fs]
    if (!range) issues.push({ level: 'warning', step: 'credits', message: 'Education credits are not available when married filing separately.' })
    else if (input.canBeClaimedAsDependent) issues.push({ level: 'warning', step: 'credits', message: 'If someone can claim you as a dependent, they claim your education credits instead.' })
    else {
      const fraction = Math.min(1, Math.max(0, Math.round(((range[1] - magi) / (range[1] - range[0])) * 1000) / 1000))
      eduFraction = fraction
      aotc = r(aotcTentative * fraction)
      llc = r(llcTentative * fraction)
    }
  }
  const aotcRefundable = r(aotc * R.AOTC_REFUNDABLE_SHARE)
  if (aotcRefundable > 0 && input.taxpayer.age > 0 && input.taxpayer.age < 24) issues.push({ level: 'info', step: 'credits', message: 'Students under 24 may not get the refundable part of the AOTC (Form 8863 line 7). Check that rule if it applies to you.' })

  // Nonrefundable credits in IRS order: Schedule 3 (care, education), then Schedule 8812
  let remaining = line18
  const take = (amount: number): number => { const used = Math.min(amount, remaining); remaining -= used; return used }
  const careAllowed = take(careCredit)
  const educationAllowed = take(aotc - aotcRefundable + llc)
  const schedule3Part1 = careAllowed + educationAllowed

  // Schedule 8812
  const qualifyingChildren = input.dependents.filter(ctcChild).length
  const otherDependents = input.dependents.length - qualifyingChildren
  const creditBeforePhaseout = qualifyingChildren * R.CTC_PER_CHILD + otherDependents * R.ODC_PER_DEPENDENT
  const phaseoutReduction = Math.min(creditBeforePhaseout, stepPhaseout(magi - R.CTC_PHASEOUT_START[fs], R.CTC_PHASEOUT_PER_1000))
  const creditAfterPhaseout = creditBeforePhaseout - phaseoutReduction
  const nonrefundable = take(creditAfterPhaseout)
  const unused = creditAfterPhaseout - nonrefundable
  let refundable = 0
  if (qualifyingChildren > 0 && unused > 0) {
    refundable = r(Math.min(unused, qualifyingChildren * R.ACTC_REFUNDABLE_MAX_PER_CHILD, pos(earnedIncome - R.ACTC_EARNED_INCOME_FLOOR) * R.ACTC_EARNED_INCOME_RATE))
    if (qualifyingChildren >= 3) issues.push({ level: 'info', step: 'credits', message: 'With 3 or more children, the refundable child credit may be larger under the Social Security tax method (Schedule 8812, Part II-B), which is not calculated here.' })
  }
  input.dependents.forEach((d) => {
    if (d.age > 0 && d.age < 17 && !d.hasSsn) issues.push({ level: 'info', step: 'about', message: `${d.name || 'A dependent'} has no SSN valid for employment, so the $500 credit for other dependents applies instead of the Child Tax Credit.` })
  })
  const line19 = nonrefundable
  const line20 = schedule3Part1
  const line21 = line19 + line20
  const line22 = pos(line18 - line21)

  // Schedule 2, Part II
  const threshold = R.HIGH_INCOME_THRESHOLD[fs]
  const totalMedicareWages = sum(w2s.map(medicareWages))
  const seEarnings = sum(scheduleSE.map((x) => x.netEarnings))
  const addlMedicare = r(pos(totalMedicareWages - threshold) * R.ADDITIONAL_MEDICARE_RATE + pos(seEarnings - pos(threshold - totalMedicareWages)) * R.ADDITIONAL_MEDICARE_RATE)
  const netInvestmentIncome = pos(line2b + line3b + line7)
  const niit = r(Math.min(netInvestmentIncome, pos(magi - threshold)) * R.NIIT_RATE)
  const schedule2Total = seTax + addlMedicare + niit + earlyDistributionTax
  const line23 = schedule2Total
  const line24 = line22 + line23

  // Earned Income Credit
  const eicChildren = Math.min(3, input.dependents.filter(eicChild).length)
  const investmentIncome = line2a + line2b + line3b + pos(line7)
  let eic = 0
  const eicReasons: string[] = []
  if (earnedIncome <= 0) eicReasons.push('no earned income')
  if (fs === 'mfs') eicReasons.push('married filing separately (allowed only if you lived apart from your spouse for the last 6 months of 2025)')
  if (input.canBeClaimedAsDependent) eicReasons.push('someone can claim you as a dependent')
  if (investmentIncome > R.EIC_INVESTMENT_INCOME_LIMIT) eicReasons.push(`investment income is over $${R.EIC_INVESTMENT_INCOME_LIMIT.toLocaleString()}`)
  if (eicChildren === 0) {
    const ages = (joint ? [input.taxpayer, input.spouse] : [input.taxpayer]).map((p) => p.age)
    const inRange = ages.some((age) => age >= R.EIC_NO_CHILD_MIN_AGE && age <= R.EIC_NO_CHILD_MAX_AGE)
    if (ages.every((age) => age === 0)) eicReasons.push('age not entered')
    else if (!inRange) eicReasons.push('without a qualifying child, you (or your spouse) must be 25 to 64')
  }
  if (eicReasons.length === 0) {
    const start = (joint ? R.EIC_PHASEOUT_START_JOINT : R.EIC_PHASEOUT_START_OTHER)[eicChildren]
    const byEarned = eicFromTable(earnedIncome, eicChildren, start)
    eic = agi < start ? byEarned : Math.min(byEarned, eicFromTable(agi, eicChildren, start))
  } else if (earnedIncome > 0 && agi < 68675 && eicReasons.includes('age not entered')) {
    issues.push({ level: 'warning', step: 'about', message: 'Enter your age so the Earned Income Credit can be checked.' })
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  const line25a = r(sum(w2s.map((w) => w.federalWithholding)))
  const line25b = r(sum(input.interest.map((i) => i.federalWithholding)) + sum(input.dividends.map((d) => d.federalWithholding)) +
    sum(retirement.map((d) => d.federalWithholding)) + sum(ssForms.map((x) => x.federalWithholding)) + input.payments.otherWithholding)
  const addlMedicareWithheld = r(pos(sum(w2s.map((w) => w.medicareWithheld)) - totalMedicareWages * R.MEDICARE_EMPLOYEE_RATE))
  const line25c = addlMedicareWithheld
  const line25d = line25a + line25b + line25c
  const line26 = r(input.payments.estimatedTaxPayments)
  const line27 = eic
  const line28 = refundable
  const line29 = aotcRefundable
  // Excess Social Security withheld (Schedule 3 line 11), per person with 2+ employers
  const maxSsTax = r(R.SOCIAL_SECURITY_WAGE_BASE * 0.062 * 100) / 100
  const excessSs = r(sum(owners.map((o) => {
    const forms = w2s.filter((w) => w.owner === o)
    if (forms.length < 2) return 0
    return pos(sum(forms.map((w) => w.socialSecurityWithheld)) - maxSsTax)
  })))
  const line31 = excessSs
  const line32 = line27 + line28 + line29 + line31
  const line33 = line25d + line26 + line32

  const line34 = pos(line33 - line24)
  const line37 = pos(line24 - line33)

  // ── Coverage notes ────────────────────────────────────────────────────────
  if (eic > 0) issues.push({ level: 'info', step: 'credits', message: 'Earned Income Credit is included. Attach Schedule EIC for each qualifying child, and confirm each child lived with you in the U.S. for more than half of 2025.' })
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
      '1a': line1a, '1e': line1e, '1z': line1z, '2a': line2a, '2b': line2b, '3a': line3a, '3b': line3b,
      '4a': line4a, '4b': line4b, '5a': line5a, '5b': line5b, '6a': line6a, '6b': line6b,
      '7a': line7, '8': line8, '9': line9, '10': line10, '11a': line11, '11b': line11, '12e': line12, '13a': line13a, '13b': line13b,
      '14': line14, '15': line15, '16': line16, '17': line17, '18': line18, '19': line19, '20': line20,
      '21': line21, '22': line22, '23': line23, '24': line24, '25a': line25a, '25b': line25b, '25c': line25c,
      '25d': line25d, '26': line26, '27a': line27, '28': line28, '29': line29, '31': line31, '32': line32, '33': line33,
      '34': line34, '37': line37
    },
    schedule1: { businessIncome: r(businessIncome), unemployment, otherIncome, additionalIncome, adjustments, totalAdjustments: line10 },
    schedule1A: {
      magi, tipsCapped, tipOtExcess, tipOtReduction, tips, overtimeCapped, overtime,
      carCapped, carExcess, carReduction, carLoanInterest: carLoan,
      seniorExcess, seniorEach, seniorTaxpayer, seniorSpouse, senior, total: line13b
    },
    scheduleA: { medical, taxes, saltBeforeCap, saltCap: r(saltCap), interest: r(it.mortgageInterest), charity, other: r(it.other), total: itemizedTotal },
    scheduleB: { interest: line2b, ordinaryDividends: line3b, required: line2b > 1500 || line3b > 1500 },
    scheduleC: scheduleCResults,
    scheduleD: { shortTerm, longTerm, net: netCapital, allowedLoss: line7 < 0 ? -line7 : 0, carryoverShort, carryoverLong, preferentialGain },
    scheduleSE,
    schedule2: { selfEmploymentTax: seTax, additionalMedicareTax: addlMedicare, netInvestmentIncomeTax: niit, earlyDistributionTax, total: schedule2Total },
    schedule3: { dependentCare: careAllowed, education: educationAllowed, excessSocialSecurity: line31 },
    form2441: {
      qualifyingPersons: carePersons, expensesUsed: careExpensesUsed, rate: careRate, credit: careCredit,
      line3: f2441.line3, line4: f2441.line4, line5: f2441.line5,
      partIII: care.employerBenefits > 0 ? { ...p3, line27: f2441.line27, line28: f2441.line28, line29: f2441.line29, line30: f2441.line30, line31: f2441.line31 } : null
    },
    form8863Detail: { phaseoutFraction: eduFraction, aotcTentative: r(aotcTentative), llcTentative: r(llcTentative), llcExpenses: r(Math.min(llcExpenses, R.LLC_EXPENSE_LIMIT)) },
    form8863: { aotc, aotcRefundable, llc, nonrefundableAllowed: educationAllowed },
    eic: { qualifyingChildren: eicChildren, earnedIncome, investmentIncome, credit: eic, notEligibleBecause: eic > 0 ? [] : eicReasons },
    schedule8812: { qualifyingChildren, otherDependents, creditBeforePhaseout, phaseoutReduction, nonrefundable, refundable },
    qbi: { qualifiedBusinessIncome: r(qbiAmount), deduction: line13a, taxableIncomeBeforeQbi: tiBeforeQbi, netCapitalGain: netCapitalGainForQbi },
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
