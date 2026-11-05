/** Stage 59: conservative Schedule 8812 review for 2025.
 * This is NOT an IRS Schedule 8812 implementation for filing. In particular,
 * the three-or-more-children alternative ACTC worksheet and tax/credit ordering
 * are deliberately not resolved. No values are posted to Form 1040.
 */
import { DependentCreditInput2025, review2025ChildAndDependentCredits } from './childDependentCreditReview2025'

export interface Schedule8812ReviewInput2025 extends DependentCreditInput2025 {
  earnedIncomeForACTC: number | null
  threeOrMoreQualifyingChildren: boolean
  socialSecurityAndMedicareTaxWorksheetVerified: boolean
  nonrefundableCreditOrderingVerified: boolean
}
export interface Schedule8812Review2025 {
  year: 2025
  filingReady: false
  form1040Line19: null
  form1040Line28: null
  preliminaryCombinedCredit: number
  tentativeNonrefundableCredit: number | null
  unusedCreditAfterTentativeNonrefundable: number | null
  actcPerChildMaximum: number
  actcEarnedIncomeLimit: number | null
  tentativeAdditionalChildTaxCredit: number | null
  blockers: string[]
}
function money(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1e12 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    throw new RangeError(`${name} must be nonnegative and have at most two decimals`)
  }
  return value
}
export function review2025Schedule8812(input: Schedule8812ReviewInput2025): Schedule8812Review2025 {
  const base = review2025ChildAndDependentCredits(input)
  const blockers = [...base.blockers]
  const qualifyingChildren = input.dependents.filter(d =>
    d.claimedOnReturn && d.qualifyingChildUnder17 && !d.otherDependent &&
    d.relationshipResidenceSupportAndDependencyVerified && d.taxpayerIdValidForCredit &&
    d.childSSNValidForEmployment
  ).length
  const earned = input.earnedIncomeForACTC === null ? null : money(input.earnedIncomeForACTC, 'Earned income')
  if (earned === null) blockers.push('Earned income for Schedule 8812 ACTC is missing.')
  if (!input.nonrefundableCreditOrderingVerified) blockers.push('Nonrefundable credit ordering and Credit Limit Worksheet B have not been verified.')
  if (input.threeOrMoreQualifyingChildren !== (qualifyingChildren >= 3)) {
    blockers.push('Three-or-more qualifying children indicator does not match verified dependent count.')
  }
  if (qualifyingChildren >= 3 || input.threeOrMoreQualifyingChildren) {
    blockers.push('Special three-or-more-children ACTC Social Security/Medicare worksheet has not been implemented.')
  }
  if (!input.socialSecurityAndMedicareTaxWorksheetVerified) {
    blockers.push('Social Security and Medicare tax worksheet evidence has not been reviewed.')
  }
  const nonrefundable = base.tentativeTaxLimitedCredit
  const unused = nonrefundable === null ? null : Math.max(0, base.preliminaryCombinedCredit - nonrefundable)
  const earnedLimit = earned === null ? null : Math.max(0, Math.floor(Math.max(0, earned - 2500) * 0.15))
  // $1,700 per qualifying child in 2025. This is only an illustrative upper bound.
  const actc = unused === null || earnedLimit === null ? null :
    Math.min(unused, qualifyingChildren * 1700, earnedLimit)
  blockers.push('ACTC is a non-postable worksheet candidate; Schedule 8812 eligibility and IRS line instructions need full verification.')
  return {
    year: 2025, filingReady: false, form1040Line19: null, form1040Line28: null,
    preliminaryCombinedCredit: base.preliminaryCombinedCredit,
    tentativeNonrefundableCredit: nonrefundable,
    unusedCreditAfterTentativeNonrefundable: unused,
    actcPerChildMaximum: qualifyingChildren * 1700,
    actcEarnedIncomeLimit: earnedLimit,
    tentativeAdditionalChildTaxCredit: actc,
    blockers,
  }
}
