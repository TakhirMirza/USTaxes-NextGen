import { review2025Schedules2And3, Schedule2And3Input2025 } from './schedule2And3Review2025'
const a = (amount: number | null) => ({ amount, reviewed: true, sourceReference: 'Reviewed worksheet' })
const input = (): Schedule2And3Input2025 => ({
  schedule2PartIAdditionalTax: a(100), schedule2PartIIOtherTaxes: a(200),
  schedule3PartINonrefundableCredits: a(50), schedule3PartIIRefundableCreditsAndPayments: a(75),
  noDuplicatePaymentsConfirmed: true, creditOrderingConfirmed: true,
})
test('Schedule 2 Part I maps to 1040 line 17, Part II maps to line 23', () => {
  const r = review2025Schedules2And3(input())
  expect(r.candidates.form1040Line17).toBe(100)
  expect(r.candidates.form1040Line23).toBe(200)
  expect(r.candidates.form1040Line20).toBe(50)
  expect(r.candidates.form1040Line31).toBe(75)
  expect(r.filingReady).toBe(false)
})
test('missing is not zero', () => {
  const i = input(); i.schedule2PartIIOtherTaxes = a(null)
  const r = review2025Schedules2And3(i)
  expect(r.candidates.form1040Line23).toBeNull()
  expect(r.blockers.some(b => b.includes('missing amount'))).toBe(true)
})
test('unreviewed zero is blocked', () => {
  const i = input(); i.schedule3PartINonrefundableCredits = {amount: 0, reviewed: false, sourceReference: null}
  expect(review2025Schedules2And3(i).candidates.form1040Line20).toBeNull()
})
test('duplicate payments flag blocks', () => {
  const i = input(); i.noDuplicatePaymentsConfirmed = false
  expect(review2025Schedules2And3(i).blockers.some(b => b.includes('duplicate'))).toBe(true)
})
test('invalid cents rejected', () => {
  const i = input(); i.schedule2PartIAdditionalTax = a(12.345)
  expect(() => review2025Schedules2And3(i)).toThrow(RangeError)
})
