import { review2025ChildAndDependentCredits as review } from './childDependentCreditReview2025'
const child = { identifier:'a', qualifyingChildUnder17:true, otherDependent:false, relationshipResidenceSupportAndDependencyVerified:true, taxpayerIdValidForCredit:true, childSSNValidForEmployment:true, claimedOnReturn:true }
const base = { filingStatus:'single' as const, modifiedAdjustedGrossIncome:100000, dependents:[child], taxpayerSSNValidForEmployment:true, federalIncomeTaxAvailableBeforeCredits:10000, otherNonrefundableCreditsAndLimitationsReviewed:false }
test('2025 base credit is 2200, not filing-ready', () => { const x=review(base); expect(x.preliminaryCombinedCredit).toBe(2200); expect(x.form1040Line19).toBeNull(); expect(x.filingReady).toBe(false) })
test('phaseout rounds excess up to next 1000', () => expect(review({...base,modifiedAdjustedGrossIncome:200001}).preliminaryCombinedCredit).toBe(2150))
test('other dependent credit is 500', () => expect(review({...base,dependents:[{...child,qualifyingChildUnder17:false,otherDependent:true}]}).preliminaryCombinedCredit).toBe(500))
test('tax cap cannot exceed tax', () => expect(review({...base,federalIncomeTaxAvailableBeforeCredits:100}).tentativeTaxLimitedCredit).toBe(100))
test('joint threshold is 400000', () => expect(review({...base,filingStatus:'marriedJoint',spouseSSNValidForEmployment:true,modifiedAdjustedGrossIncome:400001}).preliminaryCombinedCredit).toBe(2150))
test('reject duplicate dependents', () => expect(() => review({...base,dependents:[child,child]})).toThrow())
test('unverified dependent is not counted', () => expect(review({...base,dependents:[{...child,childSSNValidForEmployment:false}]}).preliminaryCombinedCredit).toBe(0))
