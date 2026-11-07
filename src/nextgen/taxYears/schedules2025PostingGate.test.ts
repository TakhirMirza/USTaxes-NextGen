import { evaluateSchedules2025PostingGate } from './schedules2025PostingGate'
import { emptySchedule1040Candidates2025 } from './schedules1040Bridge2025'
import { auditScheduleEntries2025 } from './schedules2025EntryAudit'

describe('Schedules 2025 fail-closed posting gate', () => {
  it('blocks empty, unreviewed candidates', () => {
    const result = evaluateSchedules2025PostingGate(emptySchedule1040Candidates2025(), auditScheduleEntries2025([]))
    expect(result.readyForCalculation).toBe(false)
    expect(result.issues.some(issue => issue.code === 'MISSING_LINE')).toBe(true)
  })
  it('never authorizes posting even for fully populated candidates', () => {
    const candidate = { line8: 100, line10: 20, line17: 5, line20: 2, line23: 4, line31: 0, blocked: false, entryCount: 1 }
    const result = evaluateSchedules2025PostingGate(candidate, auditScheduleEntries2025([]))
    expect(result.readyForCalculation).toBe(false)
    expect(result.candidateLines['8']).toBe(100)
    expect(result.issues.some(issue => issue.code === 'IRS_RULES_PENDING')).toBe(true)
  })
  it('rejects non-cent amounts and negative values', () => {
    const candidate = { line8: 1.001, line10: -1, line17: 0, line20: 0, line23: 0, line31: 0, blocked: false, entryCount: 1 }
    const result = evaluateSchedules2025PostingGate(candidate, auditScheduleEntries2025([]))
    expect(result.issues.filter(issue => issue.code === 'INVALID_AMOUNT')).toHaveLength(2)
  })
})
