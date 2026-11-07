/** Explicit evidence review for the 2025 Schedule 1-A enhanced senior deduction.
 * These declarations do not independently certify eligibility or authorize line 13b.
 */
export type EvidenceAnswer2025 = 'yes' | 'no' | 'unknown'
export interface SeniorEligibilityEvidence2025 {
  taxpayerHasValidWorkSSN: EvidenceAnswer2025
  taxpayerIsUSCitizenOrResident: EvidenceAnswer2025
  spouseHasValidWorkSSN?: EvidenceAnswer2025
  /** Confirmed joint return is necessary when married. */
  marriedFilingJointly: EvidenceAnswer2025
}
export interface SeniorEvidenceReview2025 {
  complete: boolean
  eligibleForFurtherReview: boolean
  blockers: string[]
}
export function review2025SeniorEligibilityEvidence(
  evidence: SeniorEligibilityEvidence2025 | undefined,
  married: boolean,
  spouseClaimed: boolean,
): SeniorEvidenceReview2025 {
  if (!evidence) return { complete: false, eligibleForFurtherReview: false,
    blockers: ['Senior deduction identity and residency evidence has not been reviewed.'] }
  const blockers: string[] = []
  // Runtime inputs can originate from JSON, not only TypeScript code.
  const check = (value: unknown, label: string): void => {
    if (value === undefined) {
      blockers.push(label + ' is unresolved.')
      return
    }
    if (value !== 'yes' && value !== 'no' && value !== 'unknown') {
      throw new TypeError(label + ' must be yes, no or unknown')
    }
    if (value !== 'yes') blockers.push(label + (value === 'unknown' ? ' is unresolved.' : ' is not satisfied.'))
  }
  check(evidence.taxpayerHasValidWorkSSN, 'Taxpayer SSN requirement')
  check(evidence.taxpayerIsUSCitizenOrResident, 'Taxpayer citizenship/residency requirement')
  if (married) check(evidence.marriedFilingJointly, 'Married filing jointly requirement')
  else if (evidence.marriedFilingJointly !== 'no') {
    if (evidence.marriedFilingJointly !== 'unknown') throw new TypeError('Unmarried filing status must not claim married filing jointly')
    blockers.push('Marital filing evidence is unresolved.')
  }
  if (spouseClaimed) check(evidence.spouseHasValidWorkSSN, 'Spouse SSN requirement')
  return { complete: blockers.length === 0, eligibleForFurtherReview: blockers.length === 0, blockers }
}
