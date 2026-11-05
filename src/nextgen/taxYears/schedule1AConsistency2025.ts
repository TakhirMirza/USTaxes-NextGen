/** Cross-check separately entered Schedule 1-A candidates and senior worksheet.
 * This is an audit only; it never approves a deduction or populates line 13b.
 */
import { Schedule1AStaging2025 } from './schedule1AWorksheet2025'
import { SeniorDeductionResult2025 } from './schedule1ASeniorDeduction2025'

export interface Schedule1AConsistency2025 {
  year: 2025
  filingReady: false
  consistent: boolean
  reviewedSeniorAmount: number | null
  stagedSeniorAmount: number | null
  form1040Line13b: null
  issues: string[]
}

export function review2025Schedule1AConsistency(
  staged: Schedule1AStaging2025 | null,
  senior: SeniorDeductionResult2025 | null,
): Schedule1AConsistency2025 {
  const issues: string[] = []
  const stagedSeniorAmount = staged === null ? null : staged.candidates.seniorDeductionCandidate
  const reviewedSeniorAmount = senior === null ? null : senior.calculatedCandidate
  if (staged === null) issues.push('Schedule 1-A candidate inventory is missing.')
  if (stagedSeniorAmount !== null && stagedSeniorAmount > 0 && senior === null) {
    issues.push('A senior candidate was entered without a senior deduction worksheet.')
  }
  if (senior !== null && senior.blockers.length) {
    issues.push('Senior deduction worksheet contains unresolved eligibility conditions.')
  }
  if (senior !== null && reviewedSeniorAmount !== null && stagedSeniorAmount !== null &&
      Math.round(reviewedSeniorAmount * 100) !== Math.round(stagedSeniorAmount * 100)) {
    issues.push('Entered senior candidate differs from the independently calculated senior candidate.')
  }
  if (senior !== null && reviewedSeniorAmount === null) {
    issues.push('Senior deduction amount cannot yet be calculated.')
  }
  return {
    year: 2025, filingReady: false, consistent: issues.length === 0,
    reviewedSeniorAmount, stagedSeniorAmount, form1040Line13b: null, issues,
  }
}
