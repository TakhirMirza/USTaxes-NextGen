/** Stage 60: unified, fail-closed review of Schedule 8812 and Form 1040 credits.
 * Deliberately does not post candidate amounts to Form 1040 lines 19 or 28.
 */
import { Schedule8812ReviewInput2025, review2025Schedule8812 } from './schedule8812Review2025'

export interface Form1040Schedule8812Bridge2025 {
  year: 2025
  filingReady: false
  form1040Line19: null
  form1040Line28: null
  nonrefundableCandidate: number | null
  refundableCandidate: number | null
  combinedCandidate: number | null
  childTaxCreditBeforePhaseout: number
  otherDependentCreditBeforePhaseout: number
  phaseoutReduction: number
  availableTaxBeforeCredits: number | null
  unresolved: string[]
  readyForPosting: false
}

export function review2025Form1040Schedule8812Bridge(input: Schedule8812ReviewInput2025): Form1040Schedule8812Bridge2025 {
  const result = review2025Schedule8812(input)
  const children = input.dependents.filter(d => d.claimedOnReturn && d.qualifyingChildUnder17 && !d.otherDependent && d.relationshipResidenceSupportAndDependencyVerified && d.taxpayerIdValidForCredit && d.childSSNValidForEmployment).length
  const others = input.dependents.filter(d => d.claimedOnReturn && d.otherDependent && !d.qualifyingChildUnder17 && d.relationshipResidenceSupportAndDependencyVerified && d.taxpayerIdValidForCredit).length
  const phaseout = Math.ceil(Math.max(0, input.modifiedAdjustedGrossIncome - (input.filingStatus === 'marriedJoint' ? 400000 : 200000)) / 1000) * 50
  const unresolved = [...result.blockers]
  // The Stage 59 candidate treats unused ODC as potentially refundable ACTC.
  // Without the official Schedule 8812 worksheet allocation, the result cannot be posted.
  if (others > 0) unresolved.push('ODC must be excluded from refundable ACTC; verify allocation with the official Schedule 8812 worksheet.')
  if (input.otherNonrefundableCreditsAndLimitationsReviewed !== true || input.nonrefundableCreditOrderingVerified !== true) {
    unresolved.push('Other nonrefundable credits and IRS credit-limit ordering must be reconciled before Form 1040 posting.')
  }
  const nonrefundable = result.tentativeNonrefundableCredit
  // A deliberately conservative display bound: the refundable candidate cannot
  // exceed the remaining phased-out child credit, even when ODC is present.
  const remainingChildCreditUpperBound = Math.max(0, children * 2200 - phaseout)
  const refundable = result.tentativeAdditionalChildTaxCredit === null ? null :
    Math.min(result.tentativeAdditionalChildTaxCredit, remainingChildCreditUpperBound)
  return {
    year: 2025, filingReady: false, form1040Line19: null, form1040Line28: null,
    nonrefundableCandidate: nonrefundable, refundableCandidate: refundable,
    combinedCandidate: nonrefundable === null || refundable === null ? null : nonrefundable + refundable,
    childTaxCreditBeforePhaseout: children * 2200,
    otherDependentCreditBeforePhaseout: others * 500,
    phaseoutReduction: phaseout,
    availableTaxBeforeCredits: input.federalIncomeTaxAvailableBeforeCredits,
    unresolved: [...new Set(unresolved)], readyForPosting: false,
  }
}
