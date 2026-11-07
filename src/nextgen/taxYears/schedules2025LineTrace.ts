import { Schedule1040Candidates2025 } from './schedules1040Bridge2025'
import { ScheduleAudit2025, ScheduleSection2025 } from './schedules2025EntryAudit'

export type LineTraceStatus2025 = 'matched' | 'mismatch' | 'missing' | 'invalid'
export interface ScheduleLineTrace2025 {
  form1040Line: '8' | '10' | '17' | '20' | '23' | '31'
  sourceSection: ScheduleSection2025
  sourceCents: number
  candidateCents: number | null
  status: LineTraceStatus2025
}

const links: ReadonlyArray<{ line: ScheduleLineTrace2025['form1040Line']; section: ScheduleSection2025; key: keyof Schedule1040Candidates2025 }> = [
  { line: '8', section: 's1income', key: 'line8' },
  { line: '10', section: 's1adjustments', key: 'line10' },
  { line: '17', section: 's2additional', key: 'line17' },
  { line: '23', section: 's2other', key: 'line23' },
  { line: '20', section: 's3credits', key: 'line20' },
  { line: '31', section: 's3payments', key: 'line31' }
]

/** Diagnostic trace only. Never posts amounts to a tax return or establishes IRS eligibility. */
export function traceSchedule1040Lines2025(candidates: Schedule1040Candidates2025, audit: ScheduleAudit2025): ScheduleLineTrace2025[] {
  return links.map(({ line, section, key }) => {
    const sourceCents = audit.totalsCents[section]
    const raw = candidates[key]
    if (raw === null) return { form1040Line: line, sourceSection: section, sourceCents, candidateCents: null, status: 'missing' }
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || !Number.isSafeInteger(sourceCents))
      return { form1040Line: line, sourceSection: section, sourceCents, candidateCents: null, status: 'invalid' }
    const cents = Math.round(raw * 100)
    if (!Number.isSafeInteger(cents) || Math.abs(raw * 100 - cents) > 0.000001)
      return { form1040Line: line, sourceSection: section, sourceCents, candidateCents: null, status: 'invalid' }
    return { form1040Line: line, sourceSection: section, sourceCents, candidateCents: cents, status: cents === sourceCents ? 'matched' : 'mismatch' }
  })
}
