import { inspectSchedules2025Dependencies } from './schedules2025DependencyMatrix'
import { emptySchedule1040Candidates2025 } from './schedules1040Bridge2025'
import { auditScheduleEntries2025 } from './schedules2025EntryAudit'

const audit = auditScheduleEntries2025([{ id: 1, section: 's1income', line: '8', description: 'Other income', amount: '12.34', source: 'Document', reviewed: true }])
test('returns six line-specific IRS dependencies', () => {
  const result = inspectSchedules2025Dependencies({ ...emptySchedule1040Candidates2025(), line8: 12.34 }, audit)
  expect(result).toHaveLength(6)
  expect(result.find(x => x.line === '8')?.status).toBe('requires-irs-review')
  expect(result.find(x => x.line === '10')?.status).toBe('missing')
  expect(result.find(x => x.line === '23')?.checks.join(' ')).toContain('self-employment')
})
test('mismatched source amounts are not considered eligible', () => {
  const result = inspectSchedules2025Dependencies({ ...emptySchedule1040Candidates2025(), line8: 12.35 }, audit)
  expect(result.find(x => x.line === '8')?.status).toBe('mismatch')
})
test('invalid cent precision is rejected', () => {
  const result = inspectSchedules2025Dependencies({ ...emptySchedule1040Candidates2025(), line8: 12.345 }, audit)
  expect(result.find(x => x.line === '8')?.status).toBe('invalid')
})
