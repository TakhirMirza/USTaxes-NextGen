/**
 * Stage 57 — restricted Form 1040 / Schedule 1-A review bridge.
 * The provisional Schedule 1-A total is displayed for audit only. It is never
 * posted to Form 1040 line 13b, line 14, or taxable income until an independently
 * approved IRS worksheet and eligibility workflow is available.
 */
import { RestrictedDraft2025 } from './form1040Draft2025'
import { CombinedSchedule1AReview2025 } from './schedule1ACombined2025'

export interface RestrictedSchedule1ABridge2025 {
  year: 2025
  filingReady: false
  form1040Line13b: null
  provisionalSchedule1ATotal: number | null
  draftLine15Unchanged: number
  provisionalLine15IfAllowed: number | null
  eligibleToPost: false
  blockers: string[]
}

function safeMoney(value: number, label: string): number {
  const cents = Math.round(value * 100)
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 1e-7) {
    throw new RangeError(`${label}: invalid monetary amount`)
  }
  return cents
}

export function review2025Schedule1AForForm1040(
  draft: RestrictedDraft2025,
  review: CombinedSchedule1AReview2025 | null,
): RestrictedSchedule1ABridge2025 {
  if (draft.year !== 2025 || draft.filingReady !== false) {
    throw new Error('Only a restricted 2025 Form 1040 draft can be reviewed')
  }
  const draftTaxableCents = safeMoney(draft.lines['15'], 'draft line 15')
  const blockers = [
    'Schedule 1-A deduction is not approved for Form 1040 line 13b.',
    'Form 1040 line 14 and line 15 must be recomputed only after statutory eligibility and worksheet validation.',
    'Complete income, adjustments, deductions and credits are not yet validated.',
  ]
  let provisionalSchedule1ATotal: number | null = null
  let provisionalLine15IfAllowed: number | null = null
  if (review === null) {
    blockers.push('Schedule 1-A review is missing.')
  } else {
    if (review.year !== 2025 || review.filingReady !== false || review.form1040Line13b !== null) {
      throw new Error('Schedule 1-A review has unsafe provenance or filing status')
    }
    blockers.push(...review.blockers.map(blocker => `Schedule 1-A: ${blocker}`))
    if (!review.reviewComplete) blockers.push('Schedule 1-A reconciliation is incomplete.')
    if (review.preliminaryTotal !== null) {
      const deductionCents = safeMoney(review.preliminaryTotal, 'Schedule 1-A provisional total')
      if (review.reviewComplete && review.blockers.length === 0) {
        provisionalSchedule1ATotal = deductionCents / 100
        provisionalLine15IfAllowed = Math.max(0, draftTaxableCents - deductionCents) / 100
      }
    }
  }
  return {
    year: 2025,
    filingReady: false,
    form1040Line13b: null,
    provisionalSchedule1ATotal,
    draftLine15Unchanged: draft.lines['15'],
    provisionalLine15IfAllowed,
    eligibleToPost: false,
    blockers,
  }
}
