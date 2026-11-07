import { Schedule1040Candidates2025 } from './schedules1040Bridge2025'
import { ScheduleAudit2025 } from './schedules2025EntryAudit'

export type PostingGateIssue2025 = { code: string; message: string }
export type PostingGateResult2025 = {
  readyForCalculation: false
  candidateLines: Readonly<Record<'8' | '10' | '17' | '20' | '23' | '31', number | null>>
  issues: PostingGateIssue2025[]
}

/** Fail-closed handoff: amounts are for review only, never posted to the filed return. */
export const evaluateSchedules2025PostingGate = (
  candidates: Schedule1040Candidates2025,
  audit: ScheduleAudit2025
): PostingGateResult2025 => {
  const lines = {
    '8': candidates.line8, '10': candidates.line10, '17': candidates.line17,
    '20': candidates.line20, '23': candidates.line23, '31': candidates.line31
  }
  const issues: PostingGateIssue2025[] = []
  if (audit.blocked) issues.push({ code: 'SOURCE_AUDIT', message: 'Resolve all source reconciliation issues.' })
  if (candidates.blocked) issues.push({ code: 'REVIEW', message: 'Complete schedule reviews and cross-form confirmations.' })
  if (candidates.entryCount < 0 || !Number.isSafeInteger(candidates.entryCount))
    issues.push({ code: 'COUNT', message: 'Invalid entry count.' })
  Object.entries(lines).forEach(([line, value]) => {
    if (value === null) issues.push({ code: 'MISSING_LINE', message: `Form 1040 line ${line} has no reviewed candidate.` })
    else if (!Number.isFinite(value) || value < 0 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001 || !Number.isSafeInteger(Math.round(value * 100)))
      issues.push({ code: 'INVALID_AMOUNT', message: `Form 1040 line ${line} has an invalid dollar amount.` })
  })
  issues.push({ code: 'IRS_RULES_PENDING', message: 'Line-specific IRS eligibility, limitations and worksheet dependencies require verification before posting.' })
  return { readyForCalculation: false, candidateLines: lines, issues }
}
