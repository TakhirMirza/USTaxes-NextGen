import { calculate2025SeniorDeduction } from './schedule1ASeniorDeduction2025'
const base = {
  filingStatus: 'single' as const, modifiedAdjustedGrossIncome: 50000,
  taxpayerAge65ByYearEnd: true, spouseAge65ByYearEnd: false,
  taxpayerEligible: true, spouseEligible: false, married: false,
}
test('single senior below phaseout threshold has 6000 candidate', () => {
  const result = calculate2025SeniorDeduction(base)
  expect(result.calculatedCandidate).toBe(6000)
  expect(result.form1040Line13b).toBeNull()
  expect(result.filingReady).toBe(false)
})
test('single senior candidate phases out at six percent', () => {
  expect(calculate2025SeniorDeduction({...base, modifiedAdjustedGrossIncome: 100000}).calculatedCandidate).toBe(4500)
  expect(calculate2025SeniorDeduction({...base, modifiedAdjustedGrossIncome: 175000}).calculatedCandidate).toBe(0)
})
test('joint eligible seniors have 12000 maximum and 150000 threshold', () => {
  const joint = {...base, filingStatus: 'marriedJoint' as const, married: true,
    spouseAge65ByYearEnd: true, spouseEligible: true, modifiedAdjustedGrossIncome: 160000}
  expect(calculate2025SeniorDeduction(joint).calculatedCandidate).toBe(11400)
})
test('married filing separately is blocked', () => {
  const result = calculate2025SeniorDeduction({...base, filingStatus: 'marriedSeparate' as const, married: true})
  expect(result.calculatedCandidate).toBeNull()
  expect(result.blockers.length).toBeGreaterThan(0)
})
test('unconfirmed eligibility is blocked', () => {
  expect(calculate2025SeniorDeduction({...base, taxpayerEligible: false}).calculatedCandidate).toBeNull()
})
test('invalid MAGI is rejected', () => {
  expect(() => calculate2025SeniorDeduction({...base, modifiedAdjustedGrossIncome: NaN})).toThrow()
  expect(() => calculate2025SeniorDeduction({...base, modifiedAdjustedGrossIncome: 100.001})).toThrow()
})
