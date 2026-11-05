import { calculate2025OvertimeDeductionCandidate as calc } from './schedule1AOvertime2025'
const base = {
  filingStatus: 'single' as const, married: false,
  qualifiedFlsaOvertimePremium: 15000, modifiedAdjustedGrossIncome: 150000,
  flsaPremiumVerified: true, eligibleEarnersHaveValidSsn: true,
}
test('single cap is 12500', () => expect(calc(base).calculatedCandidate).toBe(12500))
test('phaseout rounds excess up to next thousand', () => {
  expect(calc({...base, modifiedAdjustedGrossIncome: 150000.01}).calculatedCandidate).toBe(12400)
  expect(calc({...base, modifiedAdjustedGrossIncome: 151000}).calculatedCandidate).toBe(12400)
  expect(calc({...base, modifiedAdjustedGrossIncome: 151000.01}).calculatedCandidate).toBe(12300)
})
test('joint cap 25000 and higher threshold', () => {
  expect(calc({...base, filingStatus:'marriedJoint', married:true, qualifiedFlsaOvertimePremium:30000, modifiedAdjustedGrossIncome:300000}).calculatedCandidate).toBe(25000)
})
test('married filing separately is blocked', () => {
  expect(calc({...base, filingStatus:'marriedSeparate', married:true}).calculatedCandidate).toBeNull()
})
test('unverified FLSA evidence is blocked', () => {
  expect(calc({...base, flsaPremiumVerified:false}).calculatedCandidate).toBeNull()
})
test('invalid money is rejected', () => {
  expect(() => calc({...base, qualifiedFlsaOvertimePremium:12.345})).toThrow(RangeError)
})
test('never marks candidate filing-ready', () => {
  expect(calc(base).filingReady).toBe(false)
  expect(calc(base).form1040Line13b).toBeNull()
})
