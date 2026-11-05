import { stage2025Schedule1ACandidates } from './schedule1AWorksheet2025'

describe('2025 Schedule 1-A candidate staging (not a deduction)', () => {
  it('aggregates candidate amounts without claiming a deduction', () => {
    const result = stage2025Schedule1ACandidates([
      { category: 'qualifiedTips', amount: 100.25 },
      { category: 'qualifiedTips', amount: 0.75 },
      { category: 'qualifiedOvertimePremium', amount: 50 },
    ])
    expect(result.candidates.qualifiedTips).toBe(101)
    expect(result.unverifiedCandidateTotal).toBe(151)
    expect(result.form1040Line13b).toBeNull()
    expect(result.filingReady).toBe(false)
    expect(result.eligibleDeductionCalculated).toBe(false)
  })
  it('rejects invalid amounts', () => {
    expect(() => stage2025Schedule1ACandidates([{ category: 'qualifiedTips', amount: -1 }])).toThrow()
    expect(() => stage2025Schedule1ACandidates([{ category: 'qualifiedTips', amount: NaN }])).toThrow()
    expect(() => stage2025Schedule1ACandidates([{ category: 'qualifiedTips', amount: 1.001 }])).toThrow()
  })
  it('rejects unknown categories', () => {
    expect(() => stage2025Schedule1ACandidates([{ category: 'unknown' as any, amount: 1 }])).toThrow()
  })
  it('starts with no authorized deductions', () => {
    const result = stage2025Schedule1ACandidates([])
    expect(result.unverifiedCandidateTotal).toBe(0)
    expect(result.form1040Line13b).toBeNull()
  })
})
