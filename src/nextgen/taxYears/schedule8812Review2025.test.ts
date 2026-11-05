import { review2025Schedule8812 as review } from './schedule8812Review2025'
const child = { identifier: 'child1', qualifyingChildUnder17: true, otherDependent: false, relationshipResidenceSupportAndDependencyVerified: true, taxpayerIdValidForCredit: true, childSSNValidForEmployment: true, claimedOnReturn: true }
const base = { filingStatus: 'single' as const, modifiedAdjustedGrossIncome: 30000, dependents: [child], taxpayerSSNValidForEmployment: true, federalIncomeTaxAvailableBeforeCredits: 0, otherNonrefundableCreditsAndLimitationsReviewed: false, earnedIncomeForACTC: 20000, threeOrMoreQualifyingChildren: false, socialSecurityAndMedicareTaxWorksheetVerified: false, nonrefundableCreditOrderingVerified: false }
test('ACTC candidate limited to $1700 per child', () => expect(review(base).tentativeAdditionalChildTaxCredit).toBe(1700))
test('earned income threshold produces zero at $2500', () => expect(review({...base, earnedIncomeForACTC: 2500}).tentativeAdditionalChildTaxCredit).toBe(0))
test('earned income limit applies below child cap', () => expect(review({...base, earnedIncomeForACTC: 3500}).tentativeAdditionalChildTaxCredit).toBe(150))
test('nonrefundable credit reduces unused balance', () => expect(review({...base, federalIncomeTaxAvailableBeforeCredits: 2000}).tentativeAdditionalChildTaxCredit).toBe(200))
test('never posts lines 19 or 28', () => { const result = review(base); expect(result.form1040Line19).toBeNull(); expect(result.form1040Line28).toBeNull(); expect(result.filingReady).toBe(false) })
test('missing earned income remains unknown', () => expect(review({...base, earnedIncomeForACTC: null}).tentativeAdditionalChildTaxCredit).toBeNull())
test('three or more children triggers special worksheet blocker', () => { const dependents=[child,{...child,identifier:'child2'},{...child,identifier:'child3'}]; expect(review({...base,dependents,threeOrMoreQualifyingChildren:true}).blockers.some(x=>x.includes('Special three-or-more'))).toBe(true) })
test('invalid negative earned income rejected', () => expect(() => review({...base,earnedIncomeForACTC:-1})).toThrow())
