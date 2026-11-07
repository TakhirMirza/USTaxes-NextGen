import { reviewSchedules2025Integrity } from './schedules2025IntegrityReview'
import { emptySchedule1040Candidates2025 } from './schedules1040Bridge2025'
import { auditScheduleEntries2025 } from './schedules2025EntryAudit'
const audit = auditScheduleEntries2025([{ id: 1, section: 's1income', line: '8', description: 'Other income', amount: '12.34', source: '1099', reviewed: true }])
test('matches source totals in cents without authorizing posting', () => {
  const result = reviewSchedules2025Integrity({ ...emptySchedule1040Candidates2025(), line8: 12.34 }, audit)
  expect(result.matchingLines).toContain('8')
  expect(result.postingAuthorized).toBe(false)
})
test('flags a mismatch without altering Form 1040', () => {
  const result = reviewSchedules2025Integrity({ ...emptySchedule1040Candidates2025(), line8: 12.35 }, audit)
  expect(result.issues.some(issue => issue.code === 'SOURCE_TOTAL_MISMATCH')).toBe(true)
  expect(result.postingAuthorized).toBe(false)
})
