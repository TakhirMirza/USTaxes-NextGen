/**
 * Schedule 1-A (2025) evidence staging ONLY. These categories are subject to
 * different eligibility, phaseout, identification, and income limitations.
 * NEVER treat staged amounts as an allowed deduction without independent
 * eligibility and limitation calculations.
 * https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf
 */
export type Schedule1ACategory2025 =
  | 'qualifiedTips' | 'qualifiedOvertimePremium' | 'qualifiedPassengerVehicleLoanInterest'
  | 'seniorDeductionCandidate'

export interface Schedule1ACandidate2025 {
  category: Schedule1ACategory2025
  amount: number
  evidenceReference?: string
}

export interface Schedule1AStaging2025 {
  year: 2025
  filingReady: false
  eligibleDeductionCalculated: false
  candidates: Record<Schedule1ACategory2025, number>
  unverifiedCandidateTotal: number
  /** No amount here may be copied to Form 1040 line 13b. */
  form1040Line13b: null
  warnings: string[]
}

const categories: readonly Schedule1ACategory2025[] = [
  'qualifiedTips', 'qualifiedOvertimePremium',
  'qualifiedPassengerVehicleLoanInterest', 'seniorDeductionCandidate',
]

export function stage2025Schedule1ACandidates(entries: readonly Schedule1ACandidate2025[]): Schedule1AStaging2025 {
  const sums: Record<Schedule1ACategory2025, number> = {
    qualifiedTips: 0, qualifiedOvertimePremium: 0,
    qualifiedPassengerVehicleLoanInterest: 0, seniorDeductionCandidate: 0,
  }
  for (const entry of entries) {
    if (!categories.includes(entry.category)) throw new RangeError('Unsupported Schedule 1-A category')
    const cents = entry.amount * 100
    if (!Number.isFinite(entry.amount) || entry.amount < 0 || entry.amount > 1e12 ||
        Math.abs(cents - Math.round(cents)) > 1e-7) {
      throw new RangeError('Schedule 1-A candidates must be nonnegative amounts in cents')
    }
    const next = Math.round(sums[entry.category] * 100) + Math.round(cents)
    if (!Number.isSafeInteger(next)) throw new RangeError('Schedule 1-A candidate sum exceeds safe precision')
    sums[entry.category] = next / 100
  }
  const totalCents = categories.reduce((acc, category) => acc + Math.round(sums[category] * 100), 0)
  if (!Number.isSafeInteger(totalCents)) throw new RangeError('Schedule 1-A total exceeds safe precision')
  return {
    year: 2025, filingReady: false, eligibleDeductionCalculated: false,
    candidates: sums, unverifiedCandidateTotal: totalCents / 100, form1040Line13b: null,
    warnings: [
      'Candidate amounts are not deductions; eligibility, MAGI phaseouts and statutory limits have not been evaluated',
      'Tips, overtime, vehicle loan interest and senior deductions require distinct evidence and eligibility checks',
      'Form 1040 line 13b must remain unpopulated until official Schedule 1-A calculations are implemented',
    ],
  }
}
