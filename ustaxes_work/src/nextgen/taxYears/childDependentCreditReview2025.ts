/** Stage 58: conservative 2025 Child Tax Credit / Credit for Other Dependents review.
 * A worksheet candidate, not an IRS-approved Form 1040 line 19 amount.
 * Does not compute Additional Child Tax Credit (Schedule 8812 refundable portion).
 */
import { FilingStatus2025 } from './preview2025'

export interface DependentCreditEvidence2025 {
  identifier: string
  qualifyingChildUnder17: boolean
  otherDependent: boolean
  relationshipResidenceSupportAndDependencyVerified: boolean
  taxpayerIdValidForCredit: boolean
  childSSNValidForEmployment: boolean
  claimedOnReturn: boolean
}
export interface DependentCreditInput2025 {
  filingStatus: FilingStatus2025
  modifiedAdjustedGrossIncome: number
  dependents: DependentCreditEvidence2025[]
  taxpayerSSNValidForEmployment: boolean
  spouseSSNValidForEmployment?: boolean
  federalIncomeTaxAvailableBeforeCredits: number | null
  otherNonrefundableCreditsAndLimitationsReviewed: boolean
}
export interface DependentCreditReview2025 {
  year: 2025
  filingReady: false
  form1040Line19: null
  childTaxCreditBeforePhaseout: number
  otherDependentCreditBeforePhaseout: number
  phaseoutReduction: number
  preliminaryCombinedCredit: number
  tentativeTaxLimitedCredit: number | null
  eligibleToPost: false
  blockers: string[]
}
function dollars(n: number, name: string): number {
  if (!Number.isFinite(n) || n < 0 || n > 1e12 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
    throw new RangeError(`${name} must be a nonnegative monetary amount with at most two decimal places`)
  }
  return n
}
export function review2025ChildAndDependentCredits(input: DependentCreditInput2025): DependentCreditReview2025 {
  const validStatuses: FilingStatus2025[] = ['single','marriedJoint','marriedSeparate','headOfHousehold','qualifyingSurvivingSpouse']
  if (!validStatuses.includes(input.filingStatus)) throw new RangeError('Invalid filing status')
  const magi = dollars(input.modifiedAdjustedGrossIncome, 'MAGI')
  if (!Array.isArray(input.dependents) || input.dependents.length > 100) throw new RangeError('Invalid dependents list')
  const seen = new Set<string>()
  const blockers: string[] = []
  let children = 0
  let other = 0
  for (const dependent of input.dependents) {
    if (!dependent.identifier || seen.has(dependent.identifier)) throw new Error('Missing or duplicate dependent identifier')
    seen.add(dependent.identifier)
    if (dependent.qualifyingChildUnder17 && dependent.otherDependent) throw new Error('Dependent cannot be both CTC and ODC')
    if (!dependent.claimedOnReturn) { blockers.push(`Dependent ${dependent.identifier}: not claimed on return`); continue }
    if (!dependent.relationshipResidenceSupportAndDependencyVerified || !dependent.taxpayerIdValidForCredit) {
      blockers.push(`Dependent ${dependent.identifier}: eligibility or taxpayer ID not verified`)
      continue
    }
    if (dependent.qualifyingChildUnder17) {
      if (!dependent.childSSNValidForEmployment) blockers.push(`Dependent ${dependent.identifier}: qualifying SSN not verified`)
      else children++
    } else if (dependent.otherDependent) other++
    else blockers.push(`Dependent ${dependent.identifier}: credit category not established`)
  }
  if (!input.taxpayerSSNValidForEmployment || (input.filingStatus === 'marriedJoint' && !input.spouseSSNValidForEmployment)) {
    blockers.push('Taxpayer/spouse SSN eligibility for the 2025 credit has not been verified.')
  }
  const ctc = children * 2200
  const odc = other * 500
  const threshold = input.filingStatus === 'marriedJoint' ? 400000 : 200000
  const phaseout = Math.ceil(Math.max(0, magi - threshold) / 1000) * 50
  const preliminary = Math.max(0, ctc + odc - phaseout)
  const tax = input.federalIncomeTaxAvailableBeforeCredits === null ? null : dollars(input.federalIncomeTaxAvailableBeforeCredits, 'Tax before credits')
  if (tax === null) blockers.push('Verified tax available for nonrefundable credits is missing.')
  if (!input.otherNonrefundableCreditsAndLimitationsReviewed) blockers.push('Schedule 8812 ordering and other credit limitations require review.')
  blockers.push('Schedule 8812, qualifying dependent rules, MAGI worksheet and refundable ACTC require full independent verification.')
  return {
    year: 2025, filingReady: false, form1040Line19: null,
    childTaxCreditBeforePhaseout: ctc, otherDependentCreditBeforePhaseout: odc,
    phaseoutReduction: phaseout, preliminaryCombinedCredit: preliminary,
    tentativeTaxLimitedCredit: tax === null ? null : Math.min(preliminary, tax),
    eligibleToPost: false, blockers,
  }
}
