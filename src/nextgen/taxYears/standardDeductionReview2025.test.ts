import { review2025StandardDeduction, StandardDeductionFacts2025 } from './standardDeductionReview2025'
const base: StandardDeductionFacts2025 = {
  canBeClaimedAsDependent: false, taxpayerAge65OrOlder: false,
  spouseAge65OrOlder: false, taxpayerBlind: false, spouseBlind: false,
  spouseItemizes: false, nonresidentAlienDuringYear: false, itemizing: false,
}
test('unknown facts cannot clear basic deduction', () => {
  expect(review2025StandardDeduction('single').basicAmountUsableWithoutFurtherWorksheet).toBe(false)
})
test('explicitly reviewed ordinary case can use basic amount as illustration', () => {
  expect(review2025StandardDeduction('single', base).basicAmountUsableWithoutFurtherWorksheet).toBe(true)
})
test('dependent requires separate worksheet', () => {
  expect(review2025StandardDeduction('single', {...base, canBeClaimedAsDependent: true}).reasons).toContain('Dependent standard deduction worksheet required.')
})
test('MFS with itemizing spouse cannot use basic standard deduction', () => {
  expect(review2025StandardDeduction('marriedSeparate', {...base, spouseItemizes: true}).basicAmountUsableWithoutFurtherWorksheet).toBe(false)
})
test('senior and blind flags trigger additional deduction review', () => {
  expect(review2025StandardDeduction('marriedJoint', {...base, spouseBlind: true}).basicAmountUsableWithoutFurtherWorksheet).toBe(false)
})
test('itemizing and nonresident status block automatic basic amount', () => {
  expect(review2025StandardDeduction('single', {...base, itemizing: true, nonresidentAlienDuringYear: true}).reasons).toHaveLength(2)
})
