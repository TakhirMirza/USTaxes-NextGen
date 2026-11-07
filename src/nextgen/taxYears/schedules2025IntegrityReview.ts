import { Schedule1040Candidates2025 } from './schedules1040Bridge2025'
import { ScheduleAudit2025, ScheduleSection2025 } from './schedules2025EntryAudit'
import { evaluateSchedules2025PostingGate } from './schedules2025PostingGate'

/** Independent source-to-1040 reconciliation. Diagnostic only: never authorizes posting. */
export interface ScheduleIntegrityResult2025 {
  postingAuthorized: false
  matchingLines: string[]
  issues: { code: string; message: string }[]
}
const mapping: ReadonlyArray<{ section: ScheduleSection2025; line: keyof Schedule1040Candidates2025; label: string }> = [
  { section: 's1income', line: 'line8', label: '8' },
  { section: 's1adjustments', line: 'line10', label: '10' },
  { section: 's2additional', line: 'line17', label: '17' },
  { section: 's2other', line: 'line23', label: '23' },
  { section: 's3credits', line: 'line20', label: '20' },
  { section: 's3payments', line: 'line31', label: '31' }
]
export function reviewSchedules2025Integrity(candidates: Schedule1040Candidates2025, audit: ScheduleAudit2025): ScheduleIntegrityResult2025 {
  const gate = evaluateSchedules2025PostingGate(candidates, audit)
  const issues = gate.issues.map(issue => ({ code: issue.code, message: issue.message }))
  const matchingLines: string[] = []
  for (const item of mapping) {
    const amount = candidates[item.line]
    const cents = audit.totalsCents[item.section]
    if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isSafeInteger(cents)) continue
    const candidateCents = Math.round(amount * 100)
    if (!Number.isSafeInteger(candidateCents) || Math.abs(amount * 100 - candidateCents) > 0.000001) continue
    if (candidateCents === cents) matchingLines.push(item.label)
    else issues.push({ code: 'SOURCE_TOTAL_MISMATCH', message: `Form 1040 line ${item.label} differs from Schedule source totals; reconcile the worksheet and eligibility rules.` })
  }
  return { postingAuthorized: false, matchingLines, issues }
}
