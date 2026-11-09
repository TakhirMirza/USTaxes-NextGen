/**
 * Federal individual income tax parameters for tax year 2025.
 *
 * Sources
 *  - Rev. Proc. 2024-40 (inflation adjustments for 2025)
 *  - Public Law 119-21 ("One Big Beautiful Bill Act" / Working Families Tax Cuts), signed 2025-07-04
 *      https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions-individuals-and-workers
 *  - IRS Topic 551, Standard deduction: https://www.irs.gov/taxtopics/tc551
 *  - 2025 Form 1040 instructions and Schedule 1-A: https://www.irs.gov/instructions/i1040gi
 *
 * All dollar amounts are whole dollars.
 */

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh' | 'qss'

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: 'Single',
  mfj: 'Married filing jointly',
  mfs: 'Married filing separately',
  hoh: 'Head of household',
  qss: 'Qualifying surviving spouse'
}

export type Bracket = readonly [lowerBound: number, rate: number]

export const TAX_YEAR = 2025

/** Ordinary income brackets (Rev. Proc. 2024-40, unchanged by P.L. 119-21 for 2025). */
export const BRACKETS: Record<FilingStatus, readonly Bracket[]> = {
  single: [[0, 0.10], [11925, 0.12], [48475, 0.22], [103350, 0.24], [197300, 0.32], [250525, 0.35], [626350, 0.37]],
  mfj: [[0, 0.10], [23850, 0.12], [96950, 0.22], [206700, 0.24], [394600, 0.32], [501050, 0.35], [751600, 0.37]],
  mfs: [[0, 0.10], [11925, 0.12], [48475, 0.22], [103350, 0.24], [197300, 0.32], [250525, 0.35], [375800, 0.37]],
  hoh: [[0, 0.10], [17000, 0.12], [64850, 0.22], [103350, 0.24], [197300, 0.32], [250500, 0.35], [626350, 0.37]],
  qss: [[0, 0.10], [23850, 0.12], [96950, 0.22], [206700, 0.24], [394600, 0.32], [501050, 0.35], [751600, 0.37]]
}

/** Standard deduction as amended by P.L. 119-21 §70102. */
export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 15750, mfj: 31500, mfs: 15750, hoh: 23625, qss: 31500
}
/** Additional standard deduction per box checked (age 65+ / blind). */
export const ADDITIONAL_STD_UNMARRIED = 2000
export const ADDITIONAL_STD_MARRIED = 1600
/** Dependent standard deduction: greater of $1,350 or earned income + $450. */
export const DEPENDENT_STD_MIN = 1350
export const DEPENDENT_STD_EARNED_ADDON = 450

/** Qualified dividends & capital gain: top of 0% and 15% zones (taxable income). */
export const CAPITAL_GAIN_ZERO_TOP: Record<FilingStatus, number> = {
  single: 48350, mfj: 96700, mfs: 48350, hoh: 64750, qss: 96700
}
export const CAPITAL_GAIN_FIFTEEN_TOP: Record<FilingStatus, number> = {
  single: 533400, mfj: 600050, mfs: 300000, hoh: 566700, qss: 600050
}
/** Net capital loss deductible against ordinary income. */
export const CAPITAL_LOSS_LIMIT: Record<FilingStatus, number> = {
  single: 3000, mfj: 3000, mfs: 1500, hoh: 3000, qss: 3000
}

/** Self-employment tax (Schedule SE). */
export const SE_NET_EARNINGS_FACTOR = 0.9235
export const SE_MINIMUM_NET_EARNINGS = 400
export const SOCIAL_SECURITY_WAGE_BASE = 176100
export const SOCIAL_SECURITY_RATE_SE = 0.124
export const MEDICARE_RATE_SE = 0.029

/** Additional Medicare Tax (Form 8959) and Net Investment Income Tax (Form 8960). */
export const ADDITIONAL_MEDICARE_RATE = 0.009
export const MEDICARE_EMPLOYEE_RATE = 0.0145
export const NIIT_RATE = 0.038
export const HIGH_INCOME_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000, mfj: 250000, mfs: 125000, hoh: 200000, qss: 250000
}

/** Itemized deductions (Schedule A). P.L. 119-21 §70120: SALT cap $40,000 for 2025. */
export const MEDICAL_AGI_FLOOR = 0.075
export const SALT_CAP: Record<FilingStatus, number> = {
  single: 40000, mfj: 40000, mfs: 20000, hoh: 40000, qss: 40000
}
export const SALT_PHASEDOWN_THRESHOLD: Record<FilingStatus, number> = {
  single: 500000, mfj: 500000, mfs: 250000, hoh: 500000, qss: 500000
}
export const SALT_PHASEDOWN_RATE = 0.30
export const SALT_FLOOR: Record<FilingStatus, number> = {
  single: 10000, mfj: 10000, mfs: 5000, hoh: 10000, qss: 10000
}

/** Schedule 1-A (P.L. 119-21 §§70103, 70201–70203). Married filers must file jointly to claim. */
export const TIPS_MAX = 25000
export const OVERTIME_MAX: Record<FilingStatus, number> = {
  single: 12500, mfj: 25000, mfs: 0, hoh: 12500, qss: 12500
}
export const TIPS_OVERTIME_PHASEOUT_START: Record<FilingStatus, number> = {
  single: 150000, mfj: 300000, mfs: 0, hoh: 150000, qss: 150000
}
/** Reduced by $100 for each $1,000 (or fraction) of MAGI above the threshold. */
export const TIPS_OVERTIME_PHASEOUT_PER_1000 = 100
export const CAR_LOAN_INTEREST_MAX = 10000
export const CAR_LOAN_PHASEOUT_START: Record<FilingStatus, number> = {
  single: 100000, mfj: 200000, mfs: 100000, hoh: 100000, qss: 100000
}
/** Reduced by $200 for each $1,000 (or fraction) of MAGI above the threshold. */
export const CAR_LOAN_PHASEOUT_PER_1000 = 200
export const SENIOR_DEDUCTION = 6000
export const SENIOR_PHASEOUT_START: Record<FilingStatus, number> = {
  single: 75000, mfj: 150000, mfs: 0, hoh: 75000, qss: 75000
}
export const SENIOR_PHASEOUT_RATE = 0.06

/** Child Tax Credit / Credit for Other Dependents (Schedule 8812), P.L. 119-21 §70104. */
export const CTC_PER_CHILD = 2200
export const ODC_PER_DEPENDENT = 500
export const ACTC_REFUNDABLE_MAX_PER_CHILD = 1700
export const ACTC_EARNED_INCOME_FLOOR = 2500
export const ACTC_EARNED_INCOME_RATE = 0.15
export const CTC_PHASEOUT_START: Record<FilingStatus, number> = {
  single: 200000, mfj: 400000, mfs: 200000, hoh: 200000, qss: 200000
}
/** Reduced by $50 for each $1,000 (or fraction) of MAGI above the threshold. */
export const CTC_PHASEOUT_PER_1000 = 50

/** Qualified business income deduction (Form 8995 simplified path). */
export const QBI_RATE = 0.20
export const QBI_SIMPLE_THRESHOLD: Record<FilingStatus, number> = {
  single: 197300, mfj: 394600, mfs: 197300, hoh: 197300, qss: 197300
}

/** Student loan interest deduction (Schedule 1 line 21). */
export const STUDENT_LOAN_INTEREST_MAX = 2500
export const STUDENT_LOAN_PHASEOUT: Record<FilingStatus, readonly [number, number] | null> = {
  single: [85000, 100000], mfj: [170000, 200000], mfs: null, hoh: [85000, 100000], qss: [85000, 100000]
}

/** Taxable Social Security benefits (Social Security Benefits Worksheet, Form 1040 line 6b). */
export const SS_BASE_AMOUNT: Record<FilingStatus, number> = {
  single: 25000, mfj: 32000, mfs: 0, hoh: 25000, qss: 25000
}
export const SS_ADJUSTED_BASE: Record<FilingStatus, number> = {
  single: 34000, mfj: 44000, mfs: 0, hoh: 34000, qss: 34000
}

/** Additional tax on early retirement distributions (Form 5329 / Schedule 2 line 8). */
export const EARLY_DISTRIBUTION_RATE = 0.10

/** Earned Income Credit, 2025 (Rev. Proc. 2024-40). Index = number of qualifying children (0..3). */
export const EIC_CREDIT_RATE = [0.0765, 0.34, 0.40, 0.45] as const
export const EIC_EARNED_INCOME_AMOUNT = [8490, 12730, 17880, 17880] as const
export const EIC_MAX_CREDIT = [649, 4328, 7152, 8046] as const
export const EIC_PHASEOUT_RATE = [0.0765, 0.1598, 0.2106, 0.2106] as const
export const EIC_PHASEOUT_START_OTHER = [10620, 23350, 23350, 23350] as const
export const EIC_PHASEOUT_START_JOINT = [17730, 30470, 30470, 30470] as const
export const EIC_INVESTMENT_INCOME_LIMIT = 11950
export const EIC_NO_CHILD_MIN_AGE = 25
export const EIC_NO_CHILD_MAX_AGE = 64

/** Child and Dependent Care Credit, 2025 (Form 2441). The P.L. 119-21 increase starts in 2026. */
export const CARE_EXPENSE_LIMIT_ONE = 3000
export const CARE_EXPENSE_LIMIT_TWO_PLUS = 6000
export const CARE_MAX_RATE = 0.35
export const CARE_MIN_RATE = 0.20
export const CARE_RATE_STEP_START = 15000
/** Rate drops one point for each $2,000 (or fraction) of AGI above $15,000. */
export const CARE_RATE_STEP = 2000
export const CARE_BENEFIT_EXCLUSION_LIMIT: Record<FilingStatus, number> = {
  single: 5000, mfj: 5000, mfs: 2500, hoh: 5000, qss: 5000
}
export const CARE_QUALIFYING_CHILD_MAX_AGE = 12

/** Education credits (Form 8863). */
export const AOTC_FULL_EXPENSES = 2000
export const AOTC_PARTIAL_EXPENSES = 2000
export const AOTC_PARTIAL_RATE = 0.25
export const AOTC_REFUNDABLE_SHARE = 0.40
export const LLC_EXPENSE_LIMIT = 10000
export const LLC_RATE = 0.20
export const EDUCATION_PHASEOUT: Record<FilingStatus, readonly [number, number] | null> = {
  single: [80000, 90000], mfj: [160000, 180000], mfs: null, hoh: [80000, 90000], qss: [80000, 90000]
}

/** Saver's Credit (Form 8880), 2025. AGI upper bounds for the 50%, 20% and 10% rates. */
export const SAVERS_RATE_LIMITS: Record<FilingStatus, readonly [number, number, number]> = {
  single: [23750, 25500, 39500], mfj: [47500, 51000, 79000], mfs: [23750, 25500, 39500],
  hoh: [35625, 38250, 59250], qss: [23750, 25500, 39500]
}
export const SAVERS_CONTRIBUTION_LIMIT = 2000
/** Must be born before January 2, 2008 (age 18 by the end of 2025). */
export const SAVERS_MIN_AGE = 18

/** Estimated tax penalty (Form 2210), 2025. Instructions for Form 2210 (2025), Penalty Worksheet. */
export const PENALTY_MIN_BALANCE = 1000
export const PENALTY_CURRENT_YEAR_SHARE = 0.90
export const PENALTY_HIGH_AGI: Record<FilingStatus, number> = {
  single: 150000, mfj: 150000, mfs: 75000, hoh: 150000, qss: 150000
}
export const PENALTY_HIGH_AGI_SHARE = 1.10
/** 7% for every rate period from April 16, 2025 through April 15, 2026. */
export const PENALTY_RATE = 0.07
export const INSTALLMENT_DUE_DATES = ['2025-04-15', '2025-06-15', '2025-09-15', '2026-01-15'] as const
export const RETURN_DUE_DATE = '2026-04-15'

/** Home office, simplified method (Rev. Proc. 2013-13): $5 per square foot, up to 300 square feet. */
export const HOME_OFFICE_SIMPLIFIED_RATE = 5
export const HOME_OFFICE_SIMPLIFIED_MAX_SQFT = 300

/** Rental real estate with active participation (Form 8582): $25,000 allowance, cut by 50% of MAGI over $100,000. */
export const PASSIVE_ALLOWANCE = 25000
export const PASSIVE_PHASEOUT_START = 100000
export const PASSIVE_PHASEOUT_RATE = 0.5

/** Health savings accounts, 2025 (Rev. Proc. 2024-25). */
export const HSA_LIMIT_SELF = 4300
export const HSA_LIMIT_FAMILY = 8550
export const HSA_CATCH_UP = 1000
export const HSA_CATCH_UP_AGE = 55
export const HSA_ADDITIONAL_TAX_RATE = 0.20

/** Alternative minimum tax, 2025 (Rev. Proc. 2024-40). */
export const AMT_EXEMPTION: Record<FilingStatus, number> = {
  single: 88100, mfj: 137000, mfs: 68500, hoh: 88100, qss: 137000
}
export const AMT_PHASEOUT_START: Record<FilingStatus, number> = {
  single: 626350, mfj: 1252700, mfs: 626350, hoh: 626350, qss: 1252700
}
export const AMT_PHASEOUT_RATE = 0.25
export const AMT_28_THRESHOLD: Record<FilingStatus, number> = {
  single: 239100, mfj: 239100, mfs: 119550, hoh: 239100, qss: 239100
}
export const AMT_RATE_LOW = 0.26
export const AMT_RATE_HIGH = 0.28
