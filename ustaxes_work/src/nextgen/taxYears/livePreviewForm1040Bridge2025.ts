/** Read-only W-2-to-1040 mapping for the single-document educational preview.
 * Never creates a reconciliation, refund, posting, or filing-ready return.
 */
import { LivePreviewScenario2025, reviewW2PreviewInputs2025 } from './livePreviewScenario2025'
import { makeRestricted2025Draft, RestrictedDraft2025 } from './form1040Draft2025'

export type LivePreviewForm1040Bridge2025 =
  | { kind: 'blocked'; reason: string }
  | { kind: 'mapped'; draft: RestrictedDraft2025; withholdingConfirmed: boolean }

export function bridgeLiveW2ToRestricted1040_2025(state: LivePreviewScenario2025): LivePreviewForm1040Bridge2025 {
  const reviewed = reviewW2PreviewInputs2025(state.wages, state.federalWithholding ?? '')
  if (reviewed.kind !== 'valid') return { kind: 'blocked', reason: reviewed.kind }
  // An omitted Box 2 must not silently become a confirmed zero withholding amount.
  if (reviewed.withholding === null) return { kind: 'blocked', reason: 'W-2 Box 2 is missing; enter the verified amount, including zero.' }
  const draft = makeRestricted2025Draft(
    [{ id: 'preview-w2', employer: 'Unverified preview employer', box1Wages: reviewed.wages,
      box2FederalWithholding: reviewed.withholding }],
    [], state.status, state.ordinaryConfirmed, state.specialRuledOut
  )
  return { kind: 'mapped', draft, withholdingConfirmed: true }
}
