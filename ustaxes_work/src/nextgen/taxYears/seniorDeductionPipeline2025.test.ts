import { build2025Form1040Review } from './form1040Pipeline2025'

const base = {
  w2: [], interest1099: [], filingStatus: 'single' as const,
  schedule1: [], schedule1A: [],
  seniorDeductionFacts: {
    filingStatus: 'single' as const, modifiedAdjustedGrossIncome: 50000,
    taxpayerAge65ByYearEnd: true, spouseAge65ByYearEnd: false,
    taxpayerEligible: true, spouseEligible: false, married: false,
  },
}
test('pipeline exposes senior candidate but never fills line 13b', () => {
  const result = build2025Form1040Review(base)
  expect(result.seniorDeduction?.calculatedCandidate).toBe(6000)
  expect(result.seniorDeduction?.form1040Line13b).toBeNull()
  expect(result.blockers.some(x => x.includes('candidate only'))).toBe(true)
  expect(result.draft.line16.kind).toBe('blocked')
})
test('filing-status mismatch is blocked', () => {
  const result = build2025Form1040Review({
    ...base, seniorDeductionFacts: {...base.seniorDeductionFacts, filingStatus: 'headOfHousehold' as const},
  })
  expect(result.blockers.some(x => x.includes('differs from Form 1040'))).toBe(true)
})
test('senior facts remain optional', () => {
  const result = build2025Form1040Review({...base, seniorDeductionFacts: undefined})
  expect(result.seniorDeduction).toBeNull()
})
