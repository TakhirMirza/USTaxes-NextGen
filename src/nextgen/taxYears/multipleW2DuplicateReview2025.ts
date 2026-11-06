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
