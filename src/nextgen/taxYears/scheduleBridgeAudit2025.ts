/** Read-only schedule-to-1040 controls. Never authorizes a posting or filing. */
import type { Schedule1040Candidates2025 } from './schedules1040Bridge2025'
export type AuditSeverity = 'blocker' | 'review' | 'pass'
export interface ScheduleBridgeFinding { code: string; severity: AuditSeverity; title: string; detail: string; line?: string }
export interface ScheduleBridgeRow { schedule: string; line: string; valueCents: number | null; status: AuditSeverity; description: string }
export interface ScheduleBridgeAudit { findings: ScheduleBridgeFinding[]; rows: ScheduleBridgeRow[]; readyForPosting: false; blockerCount: number; reviewCount: number }
const mappings = [
  { key: 'line8', schedule: 'Schedule 1', line: '8', description: 'Additional income' },
  { key: 'line10', schedule: 'Schedule 1', line: '10', description: 'Adjustments to income' },
  { key: 'line17', schedule: 'Schedule 2', line: '17', description: 'Additional tax, Part I' },
  { key: 'line20', schedule: 'Schedule 3', line: '20', description: 'Nonrefundable credits' },
  { key: 'line23', schedule: 'Schedule 2', line: '23', description: 'Other taxes, Part II' },
  { key: 'line31', schedule: 'Schedule 3', line: '31', description: 'Other payments/refundable credits' }
] as const
export function auditScheduleBridge2025(year: string, c: Schedule1040Candidates2025, reconciled: boolean, upstreamBlockers: readonly string[]): ScheduleBridgeAudit {
  const findings: ScheduleBridgeFinding[] = []
  if (year !== '2025') findings.push({ code: 'YEAR_UNSUPPORTED', severity: 'blocker', title: 'Tax year not implemented', detail: 'Schedule-to-1040 mapping is supported only for tax year 2025.' })
  if (c.blocked) findings.push({ code: 'SCHEDULES_BLOCKED', severity: 'blocker', title: 'Schedule source review incomplete', detail: 'Resolve unsupported or unreviewed schedule inputs before considering any Form 1040 transfer.' })
  if (!reconciled) findings.push({ code: 'RECONCILIATION_PENDING', severity: 'blocker', title: 'Cross-step reconciliation pending', detail: 'The independent federal schedule reconciliation has not passed.' })
  if (!Number.isSafeInteger(c.entryCount) || c.entryCount < 0) findings.push({ code: 'ENTRY_COUNT_INVALID', severity: 'blocker', title: 'Invalid source entry count', detail: 'The schedule source entry count is invalid.' })
  if (c.entryCount === 0) findings.push({ code: 'NO_SCHEDULE_ENTRIES', severity: 'review', title: 'No schedule entries', detail: 'No schedule source entries are available. Confirm whether Schedules 1, 2, and 3 are applicable.' })
  const rows: ScheduleBridgeRow[] = mappings.map(m => {
    const amount = c[m.key]
    if (amount !== null && (!Number.isSafeInteger(amount) || !Number.isFinite(amount))) {
      findings.push({ code: `INVALID_${m.key.toUpperCase()}`, severity: 'blocker', title: `Invalid Form 1040 line ${m.line} candidate`, detail: 'Candidate must be a safe integer number of cents.', line: m.line })
    }
    if (amount === null) findings.push({ code: `UNRESOLVED_${m.key.toUpperCase()}`, severity: 'review', title: `Form 1040 line ${m.line} unresolved`, detail: 'Null is unknown, not zero. No amount is transferred.', line: m.line })
    return { schedule: m.schedule, line: m.line, valueCents: amount, status: amount === null ? 'review' : (!Number.isSafeInteger(amount) ? 'blocker' : 'pass'), description: m.description }
  })
  upstreamBlockers.forEach((detail, i) => findings.push({ code: `UPSTREAM_${i+1}`, severity: 'blocker', title: 'Federal reconciliation blocker', detail }))
  return { findings, rows, readyForPosting: false, blockerCount: findings.filter(f => f.severity === 'blocker').length, reviewCount: findings.filter(f => f.severity === 'review').length }
}
/** Privacy-safe: deliberately excludes amounts, source names and taxpayer identifiers. */
export function scheduleBridgeAuditCsv2025(audit: ScheduleBridgeAudit): string {
  const csv = (s: string): string => '"' + s.replace(/"/g, '""').replace(/[\r\n]+/g, ' ') + '"'
  return ['kind,code,severity,detail', ...audit.findings.map(f => ['finding', f.code, f.severity, f.title].map(csv).join(',')), ...audit.rows.map(r => ['mapping', `FORM1040_${r.line}`, r.status, r.schedule].map(csv).join(','))].join('\n')
}
