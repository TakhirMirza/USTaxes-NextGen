import { reconcile2025SchedulesWith1040 } from './form1040SchedulesReconciliation2025'
import { BalanceReview2025 } from './form1040BalanceReview2025'
import { Schedule2And3Review2025 } from './schedule2And3Review2025'
const balance = (): BalanceReview2025 => ({
  year: 2025, filingReady: false, postingAuthorized: false,
  officialLines: { '16': null, '19': null, '20': null, '22': null, '23': null, '24': null, '28': null, '33': null, '34': null, '37': null },
  candidates: { line16Tax: 1000, line19ChildAndDependentCredit: 100, line20OtherNonrefundableCredits: 50, line22TaxAfterCredits: 850, line23OtherTaxes: 25, line24TotalTax: 875, line25dWithholding: 400, line28AdditionalChildTaxCredit: 200, line33TotalPayments: 650, line34Overpayment: 0, line37AmountOwed: 225 }, blockers: []
})
const schedules = (): Schedule2And3Review2025 => ({ year: 2025, filingReady: false, postingAuthorized: false,
  candidates: { schedule2Line3: 30, schedule2Line21: 25, form1040Line17: 30, form1040Line23: 25, form1040Line20: 50, form1040Line31: 50 }, blockers: [] })
const input = () => ({ balance: balance(), schedules: schedules(), line18TaxBeforeNonrefundableCredits: 1030, additionalPaymentsExcludingSchedule3: 0, creditOrderReviewed: true, paymentSourcesReviewed: true })
test('line 17 flows into line 18 and line 24', () => {
  const r = reconcile2025SchedulesWith1040(input())
  expect(r.candidates.line18).toBe(1030)
  expect(r.candidates.line24).toBe(905)
  expect(r.candidates.line33).toBe(650)
  expect(r.candidates.line37).toBe(255)
  expect(r.postingAuthorized).toBe(false)
  expect(Object.values(r.officialLines).every(x => x === null)).toBe(true)
})
test('mismatched line 18 is flagged', () => {
  const i = input(); i.line18TaxBeforeNonrefundableCredits = 1000
  expect(reconcile2025SchedulesWith1040(i).blockers.join(' ')).toMatch(/line 18/)
})
test('Schedule 3 mismatches are flagged', () => {
  const i = input(); i.schedules.candidates.form1040Line20 = 60
  expect(reconcile2025SchedulesWith1040(i).blockers.join(' ')).toMatch(/line 20 disagrees/)
})
test('missing payment is not treated as zero', () => {
  const i = input(); i.additionalPaymentsExcludingSchedule3 = null as unknown as number
  expect(reconcile2025SchedulesWith1040(i).candidates.line33).toBeNull()
})
test('nonrefundable credit excess blocks line 22', () => {
  const i = input(); i.balance.candidates.line19ChildAndDependentCredit = 1100
  const r = reconcile2025SchedulesWith1040(i)
  expect(r.candidates.line22).toBeNull()
  expect(r.blockers.join(' ')).toMatch(/exceed line 18/)
})
