/**
 * Federal individual income tax parameters for tax year 2026.
 *
 * Sources
 *  - Rev. Proc. 2025-32 (inflation adjustments for 2026), Notice 2025-67, Rev. Proc. 2025-19 (HSA)
 *  - Social Security Administration 2026 contribution and benefit base
 *  - IRS quarterly interest rates (underpayment rate 7% / 6% / 7% / 7% for the quarters of 2026)
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

export const TAX_YEAR = 2026

/** Ordinary income brackets (Rev. Proc. 2025-32 §4.01). */
export const BRACKETS: Record<FilingStatus, readonly Bracket[]> = {
  single: [[0, 0.10], [12400, 0.12], [50400, 0.22], [105700, 0.24], [201775, 0.32], [256225, 0.35], [640600, 0.37]],
  mfj: [[0, 0.10], [24800, 0.12], [100800, 0.22], [211400, 0.24], [403550, 0.32], [512450, 0.35], [768700, 0.37]],
  mfs: [[0, 0.10], [12400, 0.12], [50400, 0.22], [105700, 0.24], [201775, 0.32], [256225, 0.35], [384350, 0.37]],
  hoh: [[0, 0.10], [17700, 0.12], [67450, 0.22], [105700, 0.24], [201750, 0.32], [256200, 0.35], [640600, 0.37]],
  qss: [[0, 0.10], [24800, 0.12], [100800, 0.22], [211400, 0.24], [403550, 0.32], [512450, 0.35], [768700, 0.37]]
}

/** Standard deduction (Rev. Proc. 2025-32 §4.15). */
export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 16100, mfj: 32200, mfs: 16100, hoh: 24150, qss: 32200
}
/** Additional standard deduction per box checked (age 65+ / blind). */
export const ADDITIONAL_STD_UNMARRIED = 2050
export const ADDITIONAL_STD_MARRIED = 1650
/** Dependent standard deduction: greater of $1,350 or earned income + $450. */
export const DEPENDENT_STD_MIN = 1350
export const DEPENDENT_STD_EARNED_ADDON = 450

/** Qualified dividends & capital gain: top of 0% and 15% zones (taxable income). */
export const CAPITAL_GAIN_ZERO_TOP: Record<FilingStatus, number> = {
  single: 49450, mfj: 98900, mfs: 49450, hoh: 66200, qss: 98900
}
export const CAPITAL_GAIN_FIFTEEN_TOP: Record<FilingStatus, number> = {
  single: 545500, mfj: 613700, mfs: 306850, hoh: 579600, qss: 613700
}
/** Net capital loss deductible against ordinary income. */
export const CAPITAL_LOSS_LIMIT: Record<FilingStatus, number> = {
  single: 3000, mfj: 3000, mfs: 1500, hoh: 3000, qss: 3000
}

/** Self-employment tax (Schedule SE). */
export const SE_NET_EARNINGS_FACTOR = 0.9235
export const SE_MINIMUM_NET_EARNINGS = 400
export const SOCIAL_SECURITY_WAGE_BASE = 184500
export const SOCIAL_SECURITY_RATE_SE = 0.124
export const MEDICARE_RATE_SE = 0.029

/** Additional Medicare Tax (Form 8959) and Net Investment Income Tax (Form 8960). */
export const ADDITIONAL_MEDICARE_RATE = 0.009
export const MEDICARE_EMPLOYEE_RATE = 0.0145
export const NIIT_RATE = 0.038
export const HIGH_INCOME_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000, mfj: 250000, mfs: 125000, hoh: 200000, qss: 250000
}

/** Itemized deductions (Schedule A). P.L. 119-21 §70120: SALT cap and threshold rise 1% a year: $40,400 / $505,000 for 2026. */
export const MEDICAL_AGI_FLOOR = 0.075
export const SALT_CAP: Record<FilingStatus, number> = {
  single: 40400, mfj: 40400, mfs: 20200, hoh: 40400, qss: 40400
}
export const SALT_PHASEDOWN_THRESHOLD: Record<FilingStatus, number> = {
  single: 505000, mfj: 505000, mfs: 252500, hoh: 505000, qss: 505000
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
  single: 201750, mfj: 403500, mfs: 201775, hoh: 201750, qss: 201750
}
/** Form 8995-A phase-in range above the threshold (P.L. 119-21 §70105: $75,000 / $150,000 from 2026). */
export const QBI_PHASE_IN_RANGE: Record<FilingStatus, number> = {
  single: 75000, mfj: 150000, mfs: 75000, hoh: 75000, qss: 75000
}

/** Student loan interest deduction (Schedule 1 line 21). */
export const STUDENT_LOAN_INTEREST_MAX = 2500
export const STUDENT_LOAN_PHASEOUT: Record<FilingStatus, readonly [number, number] | null> = {
  single: [85000, 100000], mfj: [175000, 205000], mfs: null, hoh: [85000, 100000], qss: [85000, 100000]
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

/** Earned Income Credit, 2026 (Rev. Proc. 2025-32 §4.06). Index = number of qualifying children (0..3). */
export const EIC_CREDIT_RATE = [0.0765, 0.34, 0.40, 0.45] as const
export const EIC_EARNED_INCOME_AMOUNT = [8680, 13020, 18290, 18290] as const
export const EIC_MAX_CREDIT = [664, 4427, 7316, 8231] as const
export const EIC_PHASEOUT_RATE = [0.0765, 0.1598, 0.2106, 0.2106] as const
export const EIC_PHASEOUT_START_OTHER = [10860, 23890, 23890, 23890] as const
export const EIC_PHASEOUT_START_JOINT = [18140, 31160, 31160, 31160] as const
export const EIC_INVESTMENT_INCOME_LIMIT = 12200
export const EIC_NO_CHILD_MIN_AGE = 25
export const EIC_NO_CHILD_MAX_AGE = 64

/** Child and Dependent Care Credit, 2026 (Form 2441, as amended by P.L. 119-21 §70405). */
export const CARE_EXPENSE_LIMIT_ONE = 3000
export const CARE_EXPENSE_LIMIT_TWO_PLUS = 6000
export const CARE_MAX_RATE = 0.50
export const CARE_MIN_RATE = 0.20
export const CARE_RATE_STEP_START = 15000
/** Rate drops one point for each $2,000 (or fraction) of AGI above $15,000. */
export const CARE_RATE_STEP = 2000
export const CARE_BENEFIT_EXCLUSION_LIMIT: Record<FilingStatus, number> = {
  single: 7500, mfj: 7500, mfs: 3750, hoh: 7500, qss: 7500
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

/** Saver's Credit (Form 8880), 2026 (Notice 2025-67). AGI upper bounds for the 50%, 20% and 10% rates. */
export const SAVERS_RATE_LIMITS: Record<FilingStatus, readonly [number, number, number]> = {
  single: [24250, 26250, 40250], mfj: [48500, 52500, 80500], mfs: [24250, 26250, 40250],
  hoh: [36375, 39375, 60375], qss: [24250, 26250, 40250]
}
export const SAVERS_CONTRIBUTION_LIMIT = 2000
/** Must be born before January 2, 2009 (age 18 by the end of 2026). */
export const SAVERS_MIN_AGE = 18

/** Estimated tax penalty (Form 2210), 2026. */
export const PENALTY_MIN_BALANCE = 1000
export const PENALTY_CURRENT_YEAR_SHARE = 0.90
export const PENALTY_HIGH_AGI: Record<FilingStatus, number> = {
  single: 150000, mfj: 150000, mfs: 75000, hoh: 150000, qss: 150000
}
export const PENALTY_HIGH_AGI_SHARE = 1.10
/** 7% for 2026 except 6% for April–June 2026; the 2027 rate is not yet announced, so 7% is assumed. */
export const PENALTY_RATE = 0.07
export const INSTALLMENT_DUE_DATES = ['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'] as const
export const RETURN_DUE_DATE = '2027-04-15'

/** Home office, simplified method (Rev. Proc. 2013-13): $5 per square foot, up to 300 square feet. */
export const HOME_OFFICE_SIMPLIFIED_RATE = 5
export const HOME_OFFICE_SIMPLIFIED_MAX_SQFT = 300

/** Rental real estate with active participation (Form 8582): $25,000 allowance, cut by 50% of MAGI over $100,000. */
export const PASSIVE_ALLOWANCE = 25000
export const PASSIVE_PHASEOUT_START = 100000
export const PASSIVE_PHASEOUT_RATE = 0.5

/** Health savings accounts, 2026 (Rev. Proc. 2025-19). */
export const HSA_LIMIT_SELF = 4400
export const HSA_LIMIT_FAMILY = 8750
export const HSA_CATCH_UP = 1000
export const HSA_CATCH_UP_AGE = 55
export const HSA_ADDITIONAL_TAX_RATE = 0.20
/** Form 5329 excise tax on excess contributions (Parts III–VII). */
export const EXCESS_CONTRIBUTION_RATE = 0.06

/** Alternative minimum tax, 2026 (Rev. Proc. 2025-32; P.L. 119-21 §70107 resets the phaseout and doubles its rate). */
export const AMT_EXEMPTION: Record<FilingStatus, number> = {
  single: 90100, mfj: 140200, mfs: 70100, hoh: 90100, qss: 140200
}
export const AMT_PHASEOUT_START: Record<FilingStatus, number> = {
  single: 500000, mfj: 1000000, mfs: 500000, hoh: 500000, qss: 1000000
}
export const AMT_PHASEOUT_RATE = 0.5
export const AMT_28_THRESHOLD: Record<FilingStatus, number> = {
  single: 244500, mfj: 244500, mfs: 122250, hoh: 244500, qss: 244500
}
export const AMT_RATE_LOW = 0.26
export const AMT_RATE_HIGH = 0.28

/** Educator expense deduction (Schedule 1 line 11), per eligible educator. */
export const EDUCATOR_MAX = 350

/** Child and dependent care credit rate schedule (Form 2441 line 8). The first step lowers the rate from
 *  CARE_MAX_RATE to CARE_FIRST_FLOOR; above CARE_SECOND_TIER_START a second step lowers it to CARE_MIN_RATE. */
export const CARE_FIRST_FLOOR = 0.35
export const CARE_SECOND_TIER_START: Record<FilingStatus, number> = {
  single: 75000, mfj: 150000, mfs: 75000, hoh: 75000, qss: 75000
}
export const CARE_SECOND_STEP: Record<FilingStatus, number> = { single: 2000, mfj: 4000, mfs: 2000, hoh: 2000, qss: 2000 }

/** Charitable contributions: deduction for non-itemizers (starts 2026) and the 0.5%-of-AGI floor for itemizers. */
export const CHARITY_NONITEMIZER_MAX: Record<FilingStatus, number> = { single: 1000, mfj: 2000, mfs: 1000, hoh: 1000, qss: 1000 }
export const CHARITY_AGI_FLOOR = 0.005

/** Limitation on itemized deductions for the 37% bracket (starts 2026): reduction rate (2/37). */
export const ITEMIZED_LIMIT_RATE = 2 / 37

/** Minimum QBI deduction (starts 2026) when active QBI is at least QBI_MINIMUM_ACTIVE. */
export const QBI_MINIMUM_DEDUCTION = 400
export const QBI_MINIMUM_ACTIVE = 1000

/** Section 179 (Form 4562 Part I): maximum, investment phase-out threshold and the limit for SUVs over 6,000 pounds. */
export const SECTION_179_LIMIT = 2560000
export const SECTION_179_THRESHOLD = 4090000
export const HEAVY_SUV_179_LIMIT = 32000
