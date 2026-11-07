/** Stage 63: explicit evidence-gated Schedule 2 / Schedule 3 reconciliation.
 * Values are candidates only; this does not determine eligibility or authorize posting.
 */
export type ReviewedAmount2025 = {
  amount: number | null
  reviewed: boolean
  sourceReference: string | null
}
export interface Schedule2And3Input2025 {
  schedule2PartIAdditionalTax: ReviewedAmount2025
  schedule2PartIIOtherTaxes: ReviewedAmount2025
  schedule3PartINonrefundableCredits: ReviewedAmount2025
  schedule3PartIIRefundableCreditsAndPayments: ReviewedAmount2025
  /** Explicitly confirms Schedule 3 Part II excludes ACTC and withholding. */
  noDuplicatePaymentsConfirmed: boolean
  /** Explicitly confirms line 20 credit ordering against Schedule 8812. */
  creditOrderingConfirmed: boolean
}
export interface Schedule2And3Review2025 {
  year: 2025
  filingReady: false
  postingAuthorized: false
  candidates: {
    schedule2Line3: number | null
    schedule2Line21: number | null
    form1040Line17: number | null
    form1040Line23: number | null
    form1040Line20: number | null
    form1040Line31: number | null
  }
  blockers: string[]
}
function validateAmount(input: ReviewedAmount2025, label: string, blockers: string[]): number | null {
  if (input.amount === null) {
    blockers.push(`${label}: missing amount; zero must be explicitly reviewed.`)
    return null
  }
  if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 1e12 ||
      Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.000001) {
    throw new RangeError(`${label}: amount must be nonnegative with at most two decimal places.`)
  }
  if (!input.reviewed || !input.sourceReference || !input.sourceReference.trim()) {
    blockers.push(`${label}: review and source reference required.`)
    return null
  }
  return Math.round(input.amount * 100)
}
const dollars = (cents: number | null) => cents === null ? null : cents / 100
export function review2025Schedules2And3(input: Schedule2And3Input2025): Schedule2And3Review2025 {
  const blockers: string[] = []
  const additionalTax = validateAmount(input.schedule2PartIAdditionalTax, 'Schedule 2 Part I', blockers)
  const otherTaxes = validateAmount(input.schedule2PartIIOtherTaxes, 'Schedule 2 Part II', blockers)
  const nonrefundable = validateAmount(input.schedule3PartINonrefundableCredits, 'Schedule 3 Part I', blockers)
  const refundable = validateAmount(input.schedule3PartIIRefundableCreditsAndPayments, 'Schedule 3 Part II', blockers)
  if (!input.noDuplicatePaymentsConfirmed) blockers.push('Schedule 3 payments may duplicate ACTC or withholding.')
  if (!input.creditOrderingConfirmed) blockers.push('Schedule 3 and Schedule 8812 nonrefundable credit ordering not confirmed.')
  // Schedule 2 Part I belongs to Form 1040 line 17 and must NOT be added to line 23.
  // Form 1040 line 23 receives Schedule 2 Part II only.
  blockers.push('Schedule 2/3 amounts are review-only; filing and official posting are blocked.')
  return {
    year: 2025, filingReady: false, postingAuthorized: false,
    candidates: {
      schedule2Line3: dollars(additionalTax), schedule2Line21: dollars(otherTaxes),
      form1040Line17: dollars(additionalTax), form1040Line23: dollars(otherTaxes),
      form1040Line20: dollars(nonrefundable), form1040Line31: dollars(refundable),
    }, blockers,
  }
}
