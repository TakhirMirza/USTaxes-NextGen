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
export function repeatedW2ReviewSignature2025(documents: readonly W2DocumentInput2025[], filingStatus = ''): string | null {
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

/** Human-readable, one-based group references for source-document review.
 * These labels never deduplicate, accept or modify any W-2 values.
 */
export function describePotentialRepeatedW2Groups2025(documents: readonly W2DocumentInput2025[]): string[] {
  return findPotentialRepeatedW2_2025(documents).map(group =>
    `W-2 documents ${group.map(index => index + 1).join(', ')}`
  )
}

/** Source-review details are informational only; they never authorize a tax mapping. */
export interface PotentialRepeatedW2ReviewDetail2025 {
  documentPositions: number[]
  employerLabel: string
  box1Wages: number
  box2FederalWithholding: number
}

export function potentialRepeatedW2ReviewDetails2025(documents: readonly W2DocumentInput2025[]): PotentialRepeatedW2ReviewDetail2025[] {
  return findPotentialRepeatedW2_2025(documents).map(group => {
    const representative = documents[group[0]]
    const reviewed = reviewW2PreviewInputs2025(representative.box1Wages, representative.box2FederalWithholding)
    // findPotentialRepeatedW2_2025 only includes validated amounts, but fail closed
    // if that invariant ever changes.
    if (reviewed.kind !== 'valid' || reviewed.withholding === null) {
      throw new Error('Potential W-2 group contains an invalid representative')
    }
    return {
      documentPositions: group.map(index => index + 1),
      employerLabel: representative.employer.trim(),
      box1Wages: reviewed.wages,
      box2FederalWithholding: reviewed.withholding,
    }
  })
}

/** Informational signal for equal employer + Box 1 but differing Box 2.
 * A different withholding amount is NOT proof of a corrected or duplicate W-2.
 * Exclude exact repeats (handled by the acknowledgement gate) and invalid inputs.
 */
export interface PotentialW2WithholdingDifference2025 {
  documentPositions: number[]
  employerLabel: string
  box1Wages: number
  box2Withholdings: number[]
}

export function potentialW2WithholdingDifferences2025(documents: readonly W2DocumentInput2025[]): PotentialW2WithholdingDifference2025[] {
  const groups = new Map<string, Array<{ index: number; withholdingCents: number }>>()
  documents.forEach((document, index) => {
    const employer = document.employer.trim().toLocaleLowerCase('en-US')
    if (!employer) return
    const reviewed = reviewW2PreviewInputs2025(document.box1Wages, document.box2FederalWithholding)
    if (reviewed.kind !== 'valid' || reviewed.withholding === null) return
    const wagesCents = Math.round(reviewed.wages * 100)
    const withholdingCents = Math.round(reviewed.withholding * 100)
    if (!Number.isSafeInteger(wagesCents) || !Number.isSafeInteger(withholdingCents)) return
    const key = JSON.stringify([employer, wagesCents])
    const group = groups.get(key) || []
    group.push({ index, withholdingCents })
    groups.set(key, group)
  })
  return Array.from(groups.values()).filter(group =>
    group.length > 1 && new Set(group.map(item => item.withholdingCents)).size > 1
  ).map(group => {
    const representative = documents[group[0].index]
    const reviewed = reviewW2PreviewInputs2025(representative.box1Wages, representative.box2FederalWithholding)
    if (reviewed.kind !== 'valid') throw new Error('Invalid W-2 comparison group')
    return {
      documentPositions: group.map(item => item.index + 1),
      employerLabel: representative.employer.trim(),
      box1Wages: reviewed.wages,
      box2Withholdings: group.map(item => item.withholdingCents / 100),
    }
  })
}
