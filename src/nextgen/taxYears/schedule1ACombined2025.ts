/**
 * Stage 56: evidence-gated Schedule 1-A four-part reconciliation.
 * This reconciles preliminary candidate results; it does NOT authorize
 * Form 1040 line 13b or override official Schedule 1-A worksheet rules.
 */
import { QualifiedTipsCandidate2025 } from './schedule1ATips2025'
import { OvertimeDeductionCandidate2025 } from './schedule1AOvertime2025'
import { VehicleInterestCandidate2025 } from './schedule1AVehicleInterest2025'
import { SeniorDeductionResult2025 } from './schedule1ASeniorDeduction2025'
import { Schedule1AStaging2025, Schedule1ACategory2025 } from './schedule1AWorksheet2025'

export interface CombinedSchedule1AFacts2025 {
  tips: QualifiedTipsCandidate2025 | null
  overtime: OvertimeDeductionCandidate2025 | null
  vehicleInterest: VehicleInterestCandidate2025 | null
  senior: SeniorDeductionResult2025 | null
  staged: Schedule1AStaging2025 | null
}
export interface CombinedSchedule1AReview2025 {
  year: 2025
  filingReady: false
  reviewComplete: boolean
  candidateAmounts: Record<Schedule1ACategory2025, number | null>
  preliminaryTotal: number | null
  /** Deliberately unpopulated: independent statutory review is outstanding. */
  form1040Line13b: null
  blockers: string[]
}
const keys: readonly Schedule1ACategory2025[] = [
  'qualifiedTips', 'qualifiedOvertimePremium',
  'qualifiedPassengerVehicleLoanInterest', 'seniorDeductionCandidate',
]
function validatedCents(value: number, label: string): number {
  const cents = Math.round(value * 100)
  if (!Number.isFinite(value) || value < 0 || value > 1e12 ||
      !Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 1e-7) {
    throw new RangeError(`${label} is not a valid nonnegative cent amount`)
  }
  return cents
}
export function reviewCombined2025Schedule1A(facts: CombinedSchedule1AFacts2025): CombinedSchedule1AReview2025 {
  const blockers: string[] = []
  const sources = [facts.tips, facts.overtime, facts.vehicleInterest, facts.senior]
  const amounts = sources.map((source, i) => {
    if (source === null) {
      blockers.push(`${keys[i]}: missing category worksheet; supply explicit zero-result evidence if inapplicable.`)
      return null
    }
    if (source.year !== 2025 || source.filingReady !== false || source.form1040Line13b !== null) {
      blockers.push(`${keys[i]}: invalid worksheet provenance or unsafe filing state.`)
      return null
    }
    source.blockers.forEach(reason => blockers.push(`${keys[i]}: ${reason}`))
    const amount = source.calculatedCandidate
    if (amount === null) {
      blockers.push(`${keys[i]}: candidate cannot be determined.`)
      return null
    }
    validatedCents(amount, keys[i])
    return amount
  })
  const candidateAmounts = {
    qualifiedTips: amounts[0], qualifiedOvertimePremium: amounts[1],
    qualifiedPassengerVehicleLoanInterest: amounts[2], seniorDeductionCandidate: amounts[3],
  }
  if (facts.staged === null) {
    blockers.push('Schedule 1-A source evidence inventory is missing.')
  } else {
    if (facts.staged.year !== 2025 || facts.staged.filingReady !== false ||
        facts.staged.form1040Line13b !== null || facts.staged.eligibleDeductionCalculated !== false) {
      blockers.push('Schedule 1-A source evidence inventory has an unsafe status.')
    }
    const stagedFacts = facts.staged
    keys.forEach((key, i) => {
      const staged = stagedFacts.candidates[key]
      validatedCents(staged, `staged ${key}`)
      const candidate = amounts[i]
      if (candidate !== null && Math.round(staged * 100) !== Math.round(candidate * 100)) {
        blockers.push(`${key}: staged evidence differs from calculated candidate.`)
      }
    })
  }
  let preliminaryTotal: number | null = null
  if (amounts.every(amount => amount !== null)) {
    const total = amounts.reduce<number>((sum, amount) =>
      sum + (amount === null ? 0 : validatedCents(amount, 'candidate')), 0)
    if (!Number.isSafeInteger(total)) throw new RangeError('Schedule 1-A total exceeds safe integer precision')
    preliminaryTotal = total / 100
  }
  return {
    year: 2025, filingReady: false, reviewComplete: blockers.length === 0,
    candidateAmounts, preliminaryTotal, form1040Line13b: null, blockers,
  }
}
