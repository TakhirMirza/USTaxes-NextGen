import { W2DocumentInput2025, MultipleW2Bridge2025 } from './multipleW2Form1040Bridge2025'
import { reviewW2PreviewInputs2025 } from './livePreviewScenario2025'

export interface W2EmployerSummary2025 {
  employerLabel: string
  documentPositions: number[]
  box1Wages: number
  box2FederalWithholding: number
}

/** Informational source inventory. Never deduplicates, corrects or authorizes W-2 mapping.
 * Fail closed: no partial totals when any source entry is incomplete or invalid.
 */
export function summarizeW2ByEmployer2025(documents: readonly W2DocumentInput2025[]): W2EmployerSummary2025[] | null {
  if (documents.length > 100) return null
  const seenIds = new Set<string>()
  const groups = new Map<string, { employerLabel: string; positions: number[]; wagesCents: number; withholdingCents: number }>()
  for (let index = 0; index < documents.length; index += 1) {
    const document = documents[index]
    const label = document.employer.trim()
    const id = document.id.trim()
    if (!label || !id || seenIds.has(id)) return null
    seenIds.add(id)
    const review = reviewW2PreviewInputs2025(document.box1Wages, document.box2FederalWithholding)
    if (review.kind !== 'valid' || review.withholding === null) return null
    const wages = Math.round(review.wages * 100)
    const withholding = Math.round(review.withholding * 100)
    if (!Number.isSafeInteger(wages) || !Number.isSafeInteger(withholding)) return null
    const key = label.toLocaleLowerCase('en-US')
    const current = groups.get(key) || { employerLabel: label, positions: [], wagesCents: 0, withholdingCents: 0 }
    const nextWages = current.wagesCents + wages
    const nextWithholding = current.withholdingCents + withholding
    if (!Number.isSafeInteger(nextWages) || !Number.isSafeInteger(nextWithholding)) return null
    current.positions.push(index + 1)
    current.wagesCents = nextWages
    current.withholdingCents = nextWithholding
    groups.set(key, current)
  }
  return Array.from(groups.values()).map(group => ({
    employerLabel: group.employerLabel,
    documentPositions: group.positions,
    box1Wages: group.wagesCents / 100,
    box2FederalWithholding: group.withholdingCents / 100,
  }))
}


export type W2EmployerTotalsCheck2025 =
  | { kind: 'matched'; documentCount: number; box1Wages: number; box2FederalWithholding: number }
  | { kind: 'blocked'; reason: string }

/** Independently checks the employer inventory against every W-2 source entry.
 * No mapping or filing authorization is implied by a match.
 */
export function checkW2EmployerTotals2025(documents: readonly W2DocumentInput2025[]): W2EmployerTotalsCheck2025 {
  if (documents.length === 0) return { kind: 'blocked', reason: 'No W-2 documents supplied.' }
  if (documents.length > 100) return { kind: 'blocked', reason: 'W-2 document limit exceeded (100).' }
  const ids = new Set<string>()
  let sourceWagesCents = 0
  let sourceWithholdingCents = 0
  for (const document of documents) {
    const id = document.id.trim()
    if (!id || ids.has(id)) return { kind: 'blocked', reason: 'Missing or repeated W-2 document ID.' }
    ids.add(id)
    if (!document.employer.trim()) return { kind: 'blocked', reason: 'Missing employer label.' }
    const review = reviewW2PreviewInputs2025(document.box1Wages, document.box2FederalWithholding)
    if (review.kind !== 'valid' || review.withholding === null) return { kind: 'blocked', reason: 'Incomplete or invalid W-2 amounts.' }
    const wages = Math.round(review.wages * 100)
    const withholding = Math.round(review.withholding * 100)
    if (!Number.isSafeInteger(wages) || !Number.isSafeInteger(withholding)) return { kind: 'blocked', reason: 'Unsafe W-2 cent amount.' }
    sourceWagesCents += wages
    sourceWithholdingCents += withholding
    if (!Number.isSafeInteger(sourceWagesCents) || !Number.isSafeInteger(sourceWithholdingCents)) return { kind: 'blocked', reason: 'Unsafe combined W-2 totals.' }
  }
  const summary = summarizeW2ByEmployer2025(documents)
  if (summary === null) return { kind: 'blocked', reason: 'Employer inventory is incomplete.' }
  let groupedWagesCents = 0
  let groupedWithholdingCents = 0
  const positions = new Set<number>()
  for (const group of summary) {
    for (const position of group.documentPositions) {
      if (!Number.isInteger(position) || position < 1 || position > documents.length || positions.has(position)) return { kind: 'blocked', reason: 'Employer inventory positions do not match source entries.' }
      positions.add(position)
    }
    groupedWagesCents += Math.round(group.box1Wages * 100)
    groupedWithholdingCents += Math.round(group.box2FederalWithholding * 100)
    if (!Number.isSafeInteger(groupedWagesCents) || !Number.isSafeInteger(groupedWithholdingCents)) return { kind: 'blocked', reason: 'Unsafe employer inventory totals.' }
  }
  if (positions.size !== documents.length || groupedWagesCents !== sourceWagesCents || groupedWithholdingCents !== sourceWithholdingCents) {
    return { kind: 'blocked', reason: 'Employer inventory and W-2 source totals do not reconcile.' }
  }
  return { kind: 'matched', documentCount: documents.length, box1Wages: sourceWagesCents / 100, box2FederalWithholding: sourceWithholdingCents / 100 }
}


export type W2EmployerMappingCheck2025 =
  | { kind: 'matched'; documentCount: number; box1Wages: number; box2FederalWithholding: number }
  | { kind: 'blocked'; reason: string }

/** Stage 135: separately compare the employer source inventory with the restricted
 * Form 1040 draft. Fail closed when the draft is blocked or any amount diverges.
 * This check does not validate employer identity or authorize filing.
 */
export function checkW2EmployerMapping2025(
  documents: readonly W2DocumentInput2025[],
  bridge: MultipleW2Bridge2025
): W2EmployerMappingCheck2025 {
  const totals = checkW2EmployerTotals2025(documents)
  if (totals.kind !== 'matched') return { kind: 'blocked', reason: totals.reason }
  if (bridge.kind !== 'mapped') return { kind: 'blocked', reason: 'Restricted Form 1040 draft is unavailable.' }
  if (bridge.documentCount !== totals.documentCount) return { kind: 'blocked', reason: 'W-2 document counts differ between inventory and draft.' }
  const wagesCents = Math.round(totals.box1Wages * 100)
  const withholdingCents = Math.round(totals.box2FederalWithholding * 100)
  const line1a = Math.round(bridge.draft.lines['1a'] * 100)
  const line25a = Math.round(bridge.draft.lines['25a'] * 100)
  const line25d = Math.round(bridge.draft.lines['25d'] * 100)
  if (![wagesCents, withholdingCents, line1a, line25a, line25d].every(Number.isSafeInteger)) {
    return { kind: 'blocked', reason: 'Unsafe cent amount in W-2 inventory or restricted draft.' }
  }
  if (wagesCents !== line1a || withholdingCents !== line25a || withholdingCents !== line25d) {
    return { kind: 'blocked', reason: 'Employer W-2 inventory does not match restricted Form 1040 lines 1a, 25a and 25d.' }
  }
  return { kind: 'matched', documentCount: totals.documentCount, box1Wages: totals.box1Wages, box2FederalWithholding: totals.box2FederalWithholding }
}
