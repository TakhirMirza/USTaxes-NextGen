import { review2025Schedule1AConsistency } from './schedule1AConsistency2025'
import { stage2025Schedule1ACandidates } from './schedule1AWorksheet2025'
import { calculate2025SeniorDeduction } from './schedule1ASeniorDeduction2025'

const senior = calculate2025SeniorDeduction({
  filingStatus: 'single', modifiedAdjustedGrossIncome: 75000,
  taxpayerAge65ByYearEnd: true, spouseAge65ByYearEnd: false,
  taxpayerEligible: true, spouseEligible: false, married: false,
})

test('matching independently calculated senior candidate remains unapproved', () => {
  const staged = stage2025Schedule1ACandidates([{ category: 'seniorDeductionCandidate', amount: 6000 }])
  const result = review2025Schedule1AConsistency(staged, senior)
  expect(result.consistent).toBe(true)
  expect(result.form1040Line13b).toBeNull()
  expect(result.filingReady).toBe(false)
})

test('mismatched candidate is detected', () => {
  const staged = stage2025Schedule1ACandidates([{ category: 'seniorDeductionCandidate', amount: 5000 }])
  expect(review2025Schedule1AConsistency(staged, senior).consistent).toBe(false)
})

test('senior amount without supporting worksheet is detected', () => {
  const staged = stage2025Schedule1ACandidates([{ category: 'seniorDeductionCandidate', amount: 6000 }])
  expect(review2025Schedule1AConsistency(staged, null).consistent).toBe(false)
})

test('missing Schedule 1-A inventory is detected', () => {
  expect(review2025Schedule1AConsistency(null, senior).consistent).toBe(false)
})
