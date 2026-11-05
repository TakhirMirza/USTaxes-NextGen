/** Stage 62: restricted arithmetic reconciliation of 2025 Form 1040 balance.
 * All amounts are diagnostic only. This module never posts official return lines.
 * A null candidate means evidence is absent, NOT zero.
 */
import { IntegratedReview2025 } from './form1040IntegratedReview2025'

export interface BalanceReviewInput2025 {
  integrated: IntegratedReview2025
  /** Other nonrefundable credits, line 20; explicit zero requires review. */
  otherNonrefundableCredits: number | null
  /** Other taxes, line 23, including Schedule 2; explicit zero requires review. */
  otherTaxes: number | null
  /** Other refundable credits and payments, lines 26-32 excluding line 28 and 25d. */
  otherPayments: number | null
  /** Affirmative evidence that tax, credit ordering, payments and withholding were reviewed. */
  creditOrderingConfirmed: boolean
  otherTaxesReviewed: boolean
  paymentsAndWithholdingReviewed: boolean
}
export interface BalanceReview2025 {
  year: 2025
  filingReady: false
  postingAuthorized: false
  officialLines: { '16': null; '19': null; '20': null; '22': null; '23': null; '24': null; '28': null; '33': null; '34': null; '37': null }
  candidates: {
    line16Tax: number | null
    line19ChildAndDependentCredit: number | null
    line20OtherNonrefundableCredits: number | null
    line22TaxAfterCredits: number | null
    line23OtherTaxes: number | null
    line24TotalTax: number | null
    line25dWithholding: number
    line28AdditionalChildTaxCredit: number | null
    line33TotalPayments: number | null
    line34Overpayment: number | null
    line37AmountOwed: number | null
  }
  blockers: string[]
}
function cents(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1e12 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
    throw new RangeError(`${name} must be a finite nonnegative dollar amount with at most two decimals`)
  }
  return Math.round(value * 100)
}
const dollars = (value: number | null): number | null => value === null ? null : value / 100
export function review2025Form1040Balance(input: BalanceReviewInput2025): BalanceReview2025 {
  const r = input.integrated
  if (r.year !== 2025 || r.filingReady !== false || r.postingAuthorized !== false ||
      Object.values(r.officialLines).some(value => value !== null)) throw new Error('Restricted integrated review required')
  const blockers = [...r.blockers]
  const withholding = cents(r.withholdingForReviewOnly, 'withholding')
  const line16 = r.provisionalLine16 && r.provisionalLine16.kind !== 'blocked'
    ? cents(r.provisionalLine16.tax, 'line 16') : null
  const line19 = r.candidateNonrefundableCredit === null ? null : cents(r.candidateNonrefundableCredit, 'line 19')
  const line28 = r.candidateRefundableCredit === null ? null : cents(r.candidateRefundableCredit, 'line 28')
  const line20 = input.otherNonrefundableCredits === null ? null : cents(input.otherNonrefundableCredits, 'line 20')
  const line23 = input.otherTaxes === null ? null : cents(input.otherTaxes, 'line 23')
  const otherPayments = input.otherPayments === null ? null : cents(input.otherPayments, 'other payments')
  if (line16 === null) blockers.push('Line 16 tax has no usable candidate.')
  if (line19 === null || line28 === null) blockers.push('Schedule 8812 credit candidates are incomplete.')
  if (line20 === null) blockers.push('Other nonrefundable credits have not been reviewed.')
  if (line23 === null) blockers.push('Other taxes have not been reviewed.')
  if (otherPayments === null) blockers.push('Other payments have not been reviewed.')
  if (!input.creditOrderingConfirmed) blockers.push('Nonrefundable credit ordering is not confirmed.')
  if (!input.otherTaxesReviewed) blockers.push('Schedule 2 and other taxes are not confirmed.')
  if (!input.paymentsAndWithholdingReviewed) blockers.push('Withholding and payments are not confirmed.')
  // Never silently cap a claimed credit: an excessive candidate is an inconsistency.
  const availableForChildCredit = line16 !== null && line20 !== null ? line16 - line20 : null
  if (availableForChildCredit !== null && availableForChildCredit < 0) blockers.push('Other nonrefundable credits exceed available tax.')
  if (availableForChildCredit !== null && line19 !== null && line19 > availableForChildCredit) {
    blockers.push('Child/dependent credit exceeds tax remaining after other nonrefundable credits; credit ordering requires recalculation.')
  }
  // These are arithmetic-only numbers, even if the upstream review has blockers.
  const line22 = line16 !== null && line19 !== null && line20 !== null &&
    line19 + line20 <= line16 ? line16 - line19 - line20 : null
  const line24 = line22 !== null && line23 !== null ? line22 + line23 : null
  const line33 = line28 !== null && otherPayments !== null ? withholding + line28 + otherPayments : null
  const line34 = line24 !== null && line33 !== null ? Math.max(0, line33 - line24) : null
  const line37 = line24 !== null && line33 !== null ? Math.max(0, line24 - line33) : null
  if (line24 === null || line33 === null) blockers.push('Total tax or total payments cannot be reconciled.')
  // Upstream blocks must never be interpreted as filing authorization.
  blockers.push('Balance is diagnostic only; official Form 1040 lines and filing remain blocked.')
  return {
    year: 2025, filingReady: false, postingAuthorized: false,
    officialLines: { '16': null, '19': null, '20': null, '22': null, '23': null, '24': null,
      '28': null, '33': null, '34': null, '37': null },
    candidates: {
      line16Tax: dollars(line16), line19ChildAndDependentCredit: dollars(line19),
      line20OtherNonrefundableCredits: dollars(line20), line22TaxAfterCredits: dollars(line22),
      line23OtherTaxes: dollars(line23), line24TotalTax: dollars(line24),
      line25dWithholding: withholding / 100, line28AdditionalChildTaxCredit: dollars(line28),
      line33TotalPayments: dollars(line33), line34Overpayment: dollars(line34),
      line37AmountOwed: dollars(line37),
    },
    blockers: [...new Set(blockers)],
  }
}
