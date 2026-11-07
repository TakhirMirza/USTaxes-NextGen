import { traceSchedule1040Lines2025 } from './schedules2025LineTrace'
import { emptySchedule1040Candidates2025 } from './schedules1040Bridge2025'
import { auditScheduleEntries2025 } from './schedules2025EntryAudit'
const audit = auditScheduleEntries2025([{ id: 1, section: 's1income', line: '8', description: 'Other income', amount: '12.34', source: 'Document', reviewed: true }])
test('produces a trace for all six 1040 lines without posting', () => {
  const trace = traceSchedule1040Lines2025({ ...emptySchedule1040Candidates2025(), line8: 12.34 }, audit)
  expect(trace).toHaveLength(6)
  expect(trace.find(x => x.form1040Line === '8')?.status).toBe('matched')
  expect(trace.find(x => x.form1040Line === '10')?.status).toBe('missing')
})
test('detects mismatch in cents', () => {
  const trace = traceSchedule1040Lines2025({ ...emptySchedule1040Candidates2025(), line8: 12.35 }, audit)
  expect(trace[0].status).toBe('mismatch')
  expect(trace[0].candidateCents).toBe(1235)
})
test('rejects fractional cents and non-finite values', () => {
  expect(traceSchedule1040Lines2025({ ...emptySchedule1040Candidates2025(), line8: 12.345 }, audit)[0].status).toBe('invalid')
  expect(traceSchedule1040Lines2025({ ...emptySchedule1040Candidates2025(), line8: Number.NaN }, audit)[0].status).toBe('invalid')
})
