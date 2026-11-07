import { auditScheduleEntries2025, ScheduleEntryAuditInput2025 } from './schedules2025EntryAudit'
const entry: ScheduleEntryAuditInput2025 = { id: 1, section: 's1income', line: '3', description: 'Business income', amount: '123.45', source: 'Schedule C', reviewed: true }
describe('Schedules 2025 source audit', () => {
  it('adds exact cents and accepts separate supported sources', () => {
    const result = auditScheduleEntries2025([entry, { ...entry, id: 2, amount: '0.55', source: 'Schedule C - second business' }])
    expect(result.blocked).toBe(false)
    expect(result.totalsCents.s1income).toBe(12400)
  })
  it('blocks an exact potential duplicate rather than double-posting', () => {
    const result = auditScheduleEntries2025([entry, { ...entry, id: 2, source: ' schedule   c ' }])
    expect(result.issues.some(issue => issue.code === 'POTENTIAL_DUPLICATE')).toBe(true)
  })
  it('blocks invalid cents and unreviewed sources', () => {
    const result = auditScheduleEntries2025([{ ...entry, amount: '1.234', reviewed: false }])
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['AMOUNT', 'REVIEW']))
  })
  it('blocks duplicated IDs', () => {
    expect(auditScheduleEntries2025([entry, entry]).issues.some(issue => issue.code === 'ID')).toBe(true)
  })
  it('does not infer eligibility from a reviewed amount', () => {
    const result = auditScheduleEntries2025([entry])
    expect(result).not.toHaveProperty('filingApproved')
  })
})
