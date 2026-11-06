/** Multiple W-2 documents for the restricted educational Form 1040 preview only.
 * Duplicate identifiers are blocked; equal employer names are NOT duplicates.
 */
import { FilingStatus2025 } from './preview2025'
import { reviewW2PreviewInputs2025 } from './livePreviewScenario2025'
import { makeRestricted2025Draft, RestrictedDraft2025 } from './form1040Draft2025'
import { W2Entry2025 } from './income2025'

export interface W2DocumentInput2025 {
  id: string
  employer: string
  box1Wages: string
  box2FederalWithholding: string
}

export type MultipleW2Bridge2025 =
  | { kind: 'blocked'; reason: string; documentIndex?: number }
  | { kind: 'mapped'; draft: RestrictedDraft2025; documentCount: number; withholdingConfirmed: true }

export function bridgeMultipleW2ToRestricted1040_2025(
  documents: readonly W2DocumentInput2025[],
  status: FilingStatus2025,
  ordinaryConfirmed = false,
  specialRuledOut = false
): MultipleW2Bridge2025 {
  if (documents.length === 0 || documents.length > 100) {
    return { kind: 'blocked', reason: 'Provide between 1 and 100 W-2 documents.' }
  }
  const seen = new Set<string>()
  const entries: W2Entry2025[] = []
  let wagesCents = 0
  let withholdingCents = 0
  for (let index = 0; index < documents.length; index += 1) {
    const doc = documents[index]
    const id = doc.id.trim()
    if (!id || !doc.employer.trim()) return { kind: 'blocked', reason: 'W-2 document ID and employer are required.', documentIndex: index }
    if (seen.has(id)) return { kind: 'blocked', reason: 'Duplicate W-2 document ID; verify whether the document was imported twice.', documentIndex: index }
    seen.add(id)
    const reviewed = reviewW2PreviewInputs2025(doc.box1Wages, doc.box2FederalWithholding)
    if (reviewed.kind !== 'valid') return { kind: 'blocked', reason: reviewed.kind, documentIndex: index }
    if (reviewed.withholding === null) return { kind: 'blocked', reason: 'W-2 Box 2 must be explicitly verified, including zero.', documentIndex: index }
    const wagePart = Math.round(reviewed.wages * 100)
    const withholdingPart = Math.round(reviewed.withholding * 100)
    wagesCents += wagePart
    withholdingCents += withholdingPart
    if (!Number.isSafeInteger(wagesCents) || !Number.isSafeInteger(withholdingCents) || wagesCents > 1e14 || withholdingCents > 1e14) {
      return { kind: 'blocked', reason: 'Combined W-2 amounts exceed the supported preview range.', documentIndex: index }
    }
    entries.push({ id, employer: doc.employer.trim(), box1Wages: wagePart / 100, box2FederalWithholding: withholdingPart / 100 })
  }
  // The restricted draft remains non-filing-ready and never calculates a refund.
  try {
    const draft = makeRestricted2025Draft(entries, [], status, ordinaryConfirmed, specialRuledOut)
    return { kind: 'mapped', draft, documentCount: entries.length, withholdingConfirmed: true }
  } catch (_error) {
    return { kind: 'blocked', reason: 'The combined documents cannot be represented safely in the restricted preview.' }
  }
}
