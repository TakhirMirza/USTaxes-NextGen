import { calculate2025QualifiedTipsCandidate as calc } from './schedule1ATips2025'
const base = {filingStatus:'single' as const, married:false, verifiedEmployeeTips:12000,
 verifiedBusinessTipsAfterNetIncomeLimit:0, modifiedAdjustedGrossIncome:150000,
 eligibleOccupationVerified:true, voluntaryTipsAndRecordsVerified:true,
 eligibleEarnersHaveValidSsn:true, businessNetIncomeLimitsVerified:true}
test('basic qualified tips candidate',()=>expect(calc(base).calculatedCandidate).toBe(12000))
test('caps tips at $25,000',()=>expect(calc({...base,verifiedEmployeeTips:30000}).calculatedCandidate).toBe(25000))
test('phases out per partial $1,000 MAGI',()=>expect(calc({...base,modifiedAdjustedGrossIncome:150000.01}).calculatedCandidate).toBe(11900))
test('married separate is blocked',()=>expect(calc({...base,married:true,filingStatus:'marriedSeparate'}).calculatedCandidate).toBeNull())
test('business tips require net income review',()=>expect(calc({...base,verifiedBusinessTipsAfterNetIncomeLimit:100,businessNetIncomeLimitsVerified:false}).blockers.length).toBeGreaterThan(0))
test('rejects fractions of cents',()=>expect(()=>calc({...base,verifiedEmployeeTips:2.001})).toThrow())
test('does not populate Form 1040 line 13b',()=>expect(calc(base).form1040Line13b).toBeNull())
