import { Schedule1040Candidates2025 } from './schedules1040Bridge2025'
import { ScheduleAudit2025 } from './schedules2025EntryAudit'
import { traceSchedule1040Lines2025 } from './schedules2025LineTrace'

export type DependencyStatus2025 = 'missing' | 'invalid' | 'mismatch' | 'requires-irs-review'
export interface ScheduleDependency2025 {
  line: '8' | '10' | '17' | '20' | '23' | '31'
  status: DependencyStatus2025
  checks: string[]
  candidateCents: number | null
}

const requirements: Record<ScheduleDependency2025['line'], readonly string[]> = {
  '8': ['Schedule 1 Part I: income category, supporting forms, exclusions and carryovers'],
  '10': ['Schedule 1 Part II: adjustment eligibility, limitations and supporting worksheets'],
  '17': ['Schedule 2 Part I: AMT and excess advance premium tax credit worksheets'],
  '20': ['Schedule 3 Part I: nonrefundable credit eligibility, ordering and limitations'],
  '23': ['Schedule 2 Part II: self-employment and other tax calculations'],
  '31': ['Schedule 3 Part II: refundable credits and payments; exclude duplicate withholding']
}

/** Audit-only dependency matrix. A matching amount does NOT authorize tax posting. */
export function inspectSchedules2025Dependencies(
  candidates: Schedule1040Candidates2025,
  audit: ScheduleAudit2025
): ScheduleDependency2025[] {
  return traceSchedule1040Lines2025(candidates, audit).map(trace => ({
    line: trace.form1040Line,
    status: trace.status === 'matched' ? 'requires-irs-review' : trace.status,
    checks: [...requirements[trace.form1040Line], ...(audit.blocked || candidates.blocked ? ['Resolve source audit and schedule review blockers'] : [])],
    candidateCents: trace.candidateCents
  }))
}
