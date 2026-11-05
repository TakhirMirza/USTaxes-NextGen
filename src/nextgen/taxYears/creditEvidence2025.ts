/** 2025 Form 1040 credit source review. This is not a credit eligibility calculator. */
export type CreditEvidenceStatus2025 = 'not-reviewed' | 'confirmed-none' | 'requires-worksheet' | 'verified-worksheet'
export type CreditKind2025 = 'child-and-dependent' | 'schedule3-nonrefundable' | 'earned-income' | 'additional-child' | 'american-opportunity' | 'adoption-refundable' | 'schedule3-refundable'
export const CREDIT_KINDS_2025: readonly CreditKind2025[] = [
  'child-and-dependent', 'schedule3-nonrefundable', 'earned-income',
  'additional-child', 'american-opportunity', 'adoption-refundable', 'schedule3-refundable',
]
export interface CreditEvidence2025 {
  kind: CreditKind2025
  status: CreditEvidenceStatus2025
  /** Amount from a separately reviewed worksheet. Required for verified-worksheet, even when zero. */
  amount?: number
  /** Human-readable document/worksheet identifier; required for verified-worksheet. */
  worksheetReference?: string
}
export interface CreditEvidenceReview2025 {
  complete: boolean
  amounts: Partial<Record<CreditKind2025, number>>
  blockers: string[]
}
export function review2025CreditEvidence(entries: readonly CreditEvidence2025[]): CreditEvidenceReview2025 {
  const seen = new Set<CreditKind2025>()
  const blockers: string[] = []
  const amounts: Partial<Record<CreditKind2025, number>> = {}
  for (const entry of entries) {
    if (!CREDIT_KINDS_2025.includes(entry.kind)) throw new RangeError('Unknown credit kind')
    if (seen.has(entry.kind)) throw new RangeError('Duplicate credit kind: ' + entry.kind)
    seen.add(entry.kind)
    if (entry.amount !== undefined && (!Number.isFinite(entry.amount) || entry.amount < 0 || entry.amount > 1e10 || Math.abs(entry.amount * 100 - Math.round(entry.amount * 100)) > 1e-6)) {
      throw new RangeError('Invalid credit amount: ' + entry.kind)
    }
    if (entry.status === 'confirmed-none') {
      if (entry.amount !== undefined && entry.amount !== 0) throw new RangeError('Confirmed absent credit has nonzero amount')
      amounts[entry.kind] = 0
    } else if (entry.status === 'verified-worksheet') {
      if (entry.amount === undefined || !entry.worksheetReference?.trim()) {
        blockers.push(entry.kind + ': verified worksheet requires amount and source reference')
      } else amounts[entry.kind] = entry.amount
    } else {
      if (entry.amount !== undefined) throw new RangeError('Unverified credit must not carry an amount')
      blockers.push(entry.kind + ': ' + entry.status)
    }
  }
  for (const kind of CREDIT_KINDS_2025) if (!seen.has(kind)) blockers.push(kind + ': missing explicit review')
  return {complete: blockers.length === 0, amounts, blockers}
}
