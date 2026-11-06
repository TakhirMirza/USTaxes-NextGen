/** Independent cent-precision check of the restricted W-2 -> Form 1040 bridge. */
import { W2DocumentInput2025, MultipleW2Bridge2025 } from './multipleW2Form1040Bridge2025'
import { reviewW2PreviewInputs2025 } from './livePreviewScenario2025'

export type W2Reconciliation2025 =
  | { kind: 'blocked'; reason: string }
  | { kind: 'matched'; wagesCents: number; withholdingCents: number; documentCount: number }
  | { kind: 'mismatch'; reason: string }

export function reconcileMultipleW2_2025(documents: readonly W2DocumentInput2025[], bridge: MultipleW2Bridge2025): W2Reconciliation2025 {
  if (bridge.kind === 'blocked') return { kind: 'blocked', reason: bridge.reason }
  if (documents.length < 1 || documents.length > 100 || documents.length !== bridge.documentCount) return { kind: 'mismatch', reason: 'Document count does not match the mapped Form 1040 draft.' }
  const seen = new Set<string>()
  let wagesCents = 0
  let withholdingCents = 0
  for (const document of documents) {
    const id = document.id.trim()
    if (!id || !document.employer.trim() || seen.has(id)) return { kind: 'mismatch', reason: 'Document IDs or employer labels are incomplete or duplicated.' }
    seen.add(id)
    const review = reviewW2PreviewInputs2025(document.box1Wages, document.box2FederalWithholding)
    if (review.kind !== 'valid' || review.withholding === null) return { kind: 'mismatch', reason: 'W-2 amounts require explicit valid Box 1 and Box 2 values.' }
    wagesCents += Math.round(review.wages * 100)
    withholdingCents += Math.round(review.withholding * 100)
    if (!Number.isSafeInteger(wagesCents) || !Number.isSafeInteger(withholdingCents) || wagesCents > 1e14 || withholdingCents > 1e14) return { kind: 'mismatch', reason: 'W-2 totals exceed the supported safe range.' }
  }
  const lines = bridge.draft.lines
  const mappedWagesCents = Math.round(lines['1a'] * 100)
  const mappedWithholdingCents = Math.round(lines['25a'] * 100)
  const mappedTotalWithholdingCents = Math.round(lines['25d'] * 100)
  if (mappedWagesCents !== wagesCents || mappedWithholdingCents !== withholdingCents || mappedTotalWithholdingCents !== withholdingCents) return { kind: 'mismatch', reason: 'Form 1040 lines 1a, 25a or restricted 25d differ from the independently summed W-2 amounts.' }
  return { kind: 'matched', wagesCents, withholdingCents, documentCount: documents.length }
}
