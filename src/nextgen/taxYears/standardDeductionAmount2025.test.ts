import { calculate2025StandardDeduction } from './standardDeductionAmount2025'
import { StandardDeductionFacts2025 } from './standardDeductionReview2025'
const facts: StandardDeductionFacts2025 = {
  canBeClaimedAsDependent: false, taxpayerAge65OrOlder: false,
  spouseAge65OrOlder: false, taxpayerBlind: false, spouseBlind: false,
  spouseItemizes: false, nonresidentAlienDuringYear: false, itemizing: false,
}
test('single basic 2025 amount', () => {
  expect(calculate2025StandardDeduction('single', facts).amount).toBe(15750)
})
test('single senior and blind each add 2000', () => {
  expect(calculate2025StandardDeduction('single', {...facts, taxpayerAge65OrOlder:true, taxpayerBlind:true}).amount).toBe(19750)
})
test('joint four age/blind boxes add 6400', () => {
  expect(calculate2025StandardDeduction('marriedJoint', {...facts, taxpayerAge65OrOlder:true, taxpayerBlind:true, spouseAge65OrOlder:true, spouseBlind:true}).amount).toBe(37900)
})
test('head of household senior adds 2000', () => {
  expect(calculate2025StandardDeduction('headOfHousehold', {...facts, taxpayerAge65OrOlder:true}).amount).toBe(25625)
})
test('MFS spouse boxes cannot be presumed eligible', () => {
  expect(calculate2025StandardDeduction('marriedSeparate', {...facts, spouseBlind:true}).amount).toBeNull()
})
test('dependent requires special worksheet', () => {
  expect(calculate2025StandardDeduction('single', {...facts, canBeClaimedAsDependent:true}).amount).toBeNull()
})
test('unreviewed or itemized returns are blocked', () => {
  expect(calculate2025StandardDeduction('single').amount).toBeNull()
  expect(calculate2025StandardDeduction('single', {...facts, itemizing:true}).amount).toBeNull()
})
