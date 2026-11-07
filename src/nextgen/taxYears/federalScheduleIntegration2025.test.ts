import { reconcileFederalScheduleIncome2025, FederalScheduleIncomeInput2025 } from './federalScheduleIntegration2025'
const valid: FederalScheduleIncomeInput2025 = {
  year: 2025, wagesCents: 8000000, taxableInterestCents: 25000,
  schedule: { line8: 125000, line10: 35000, line17: 0, line20: 0, line23: 0, line31: 0, blocked: false, entryCount: 2 },
  schedulesReviewed: true, noOtherIncomeConfirmed: true, deductionCents: 1575000, deductionEligibilityReviewed: true
}
describe('2025 federal Schedule 1 income integration', () => {
  it('reconciles income, AGI and taxable income using integer cents', () => {
    const result = reconcileFederalScheduleIncome2025(valid)
    expect(result.status).toBe('reconciled')
    expect(result.lines).toMatchObject({ '8': 125000, '9': 8150000, '10': 35000, '11a': 8115000, '15': 6540000 })
    expect(result.filingReady).toBe(false)
  })
  it('blocks unreviewed schedule amounts', () => {
    expect(reconcileFederalScheduleIncome2025({ ...valid, schedulesReviewed: false }).lines).toBeNull()
  })
  it('blocks unknown income categories', () => {
    expect(reconcileFederalScheduleIncome2025({ ...valid, noOtherIncomeConfirmed: false }).status).toBe('blocked')
  })
  it('blocks adjustments exceeding total income', () => {
    expect(reconcileFederalScheduleIncome2025({ ...valid, schedule: { ...valid.schedule, line10: 9000000 } }).lines).toBeNull()
  })
  it('blocks unsafe and fractional-cent values', () => {
    expect(reconcileFederalScheduleIncome2025({ ...valid, wagesCents: 100.5 }).lines).toBeNull()
  })
  it('does not infer zero for a missing Schedule 1 amount', () => {
    expect(reconcileFederalScheduleIncome2025({ ...valid, schedule: { ...valid.schedule, line8: null } }).lines).toBeNull()
  })
})
