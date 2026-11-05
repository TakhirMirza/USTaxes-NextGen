/**
 * 2025 standard deduction applicability gate. This does NOT calculate an allowed
 * deduction. Basic amounts alone cannot establish entitlement to Form 1040 line 12e.
 * Source: IRS 2025 Form 1040 instructions, Standard Deduction Chart and worksheets.
 */
import { FilingStatus2025 } from './preview2025'

export interface StandardDeductionFacts2025 {
  /** Whether the taxpayer can be claimed as a dependent on another return. */
  canBeClaimedAsDependent: boolean
  /** Whether taxpayer or spouse was born before January 2, 1961. */
  taxpayerAge65OrOlder: boolean
  spouseAge65OrOlder: boolean
  taxpayerBlind: boolean
  spouseBlind: boolean
  /** Married filing separately: spouse itemizes deductions. */
  spouseItemizes: boolean
  /** Whether the taxpayer was a nonresident alien during any part of the year. */
  nonresidentAlienDuringYear: boolean
  /** Whether taxpayer intends to itemize instead of taking the standard deduction. */
  itemizing: boolean
}

export interface StandardDeductionReview2025 {
  year: 2025
  basicAmountUsableWithoutFurtherWorksheet: boolean
  reasons: string[]
  filingReady: false
}

export function review2025StandardDeduction(
  status: FilingStatus2025,
  facts?: StandardDeductionFacts2025
): StandardDeductionReview2025 {
  const reasons: string[] = []
  if (!facts) reasons.push('Standard deduction eligibility questions have not been reviewed.')
  else {
    const fields: (keyof StandardDeductionFacts2025)[] = [
      'canBeClaimedAsDependent', 'taxpayerAge65OrOlder', 'spouseAge65OrOlder',
      'taxpayerBlind', 'spouseBlind', 'spouseItemizes',
      'nonresidentAlienDuringYear', 'itemizing',
    ]
    if (fields.some(field => typeof facts[field] !== 'boolean')) {
      reasons.push('All standard deduction eligibility answers must be explicit booleans.')
    } else {
      if (facts.canBeClaimedAsDependent) reasons.push('Dependent standard deduction worksheet required.')
      if (facts.taxpayerAge65OrOlder || facts.taxpayerBlind ||
          (['marriedJoint', 'marriedSeparate', 'qualifyingSurvivingSpouse'].includes(status) &&
           (facts.spouseAge65OrOlder || facts.spouseBlind))) {
        reasons.push('Additional standard deduction for age or blindness requires a separate calculation.')
      }
      if (status === 'marriedSeparate' && facts.spouseItemizes) {
        reasons.push('Married filing separately with an itemizing spouse generally cannot use the standard deduction.')
      }
      if (facts.nonresidentAlienDuringYear) {
        reasons.push('Nonresident alien status requires separate standard deduction eligibility review.')
      }
      if (facts.itemizing) reasons.push('Itemized deductions must be calculated instead of the basic standard deduction.')
    }
  }
  return { year: 2025, basicAmountUsableWithoutFurtherWorksheet: reasons.length === 0,
    reasons, filingReady: false }
}
