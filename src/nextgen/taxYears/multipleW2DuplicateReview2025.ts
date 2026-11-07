import { W2DocumentInput2025 } from './multipleW2Form1040Bridge2025'
import { reviewW2PreviewInputs2025 } from './livePreviewScenario2025'

/** A review signal, not proof of duplication: two legitimate W-2s can have identical values. */
export function findPotentialRepeatedW2_2025(documents: readonly W2DocumentInput2025[]): number[][] {
  const groups = new Map<string, number[]>()
  documents.forEach((document, index) => {
    const employer = document.employer.trim().toLocaleLowerCase('en-US')
    if (!employer) return
    const review = reviewW2PreviewInputs2025(document.box1Wages, document.box2FederalWithholding)
    if (review.kind !== 'valid' || review.withholding === null) return
    const wagesCents = Math.round(review.wages * 100)
    const withholdingCents = Math.round(review.withholding * 100)
    if (!Number.isSafeInteger(wagesCents) || !Number.isSafeInteger(withholdingCents)) return
    const key = JSON.stringify([employer, wagesCents, withholdingCents])
    const indexes = groups.get(key) || []
    indexes.push(index)
    groups.set(key, indexes)
  })
  return Array.from(groups.values()).filter(indexes => indexes.length > 1)
}

/** Acknowledgement applies only to the exact current reviewed entries. */
export function repeatedW2ReviewSignature2025(documents: readonly W2DocumentInput2025[], filingStatus: string = ''): string | null {
  const groups = findPotentialRepeatedW2_2025(documents)
  if (groups.length === 0) return null
  // Include ALL documents, not only flagged entries: even an unflagged W-2
  // can change the restricted totals after the user acknowledged a review.
  // Keep original order and raw strings so any edit invalidates the acknowledgement.
  return JSON.stringify({
    filingStatus,
    documents: documents.map(document => [document.id, document.employer, document.box1Wages, document.box2FederalWithholding]),
    groups,
  })
}

/** The restricted mapping must be hidden while a duplicate review is unresolved. */
export function isRepeatedW2ReviewAcknowledged2025(signature: string | null, acknowledgedSignature: string | null): boolean {
  return signature === null || (acknowledgedSignature !== null && acknowledgedSignature === signature)
}
