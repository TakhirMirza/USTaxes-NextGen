import { W2DocumentInput2025 } from './multipleW2Form1040Bridge2025'
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
  const groups = new Map<string, { employerLabel: string; positions: number[]; wagesCents: number; withholdingCents: number }>()
  for (let index = 0; index < documents.length; index += 1) {
    const document = documents[index]
    const label = document.employer.trim()
    if (!label || !document.id.trim()) return null
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
