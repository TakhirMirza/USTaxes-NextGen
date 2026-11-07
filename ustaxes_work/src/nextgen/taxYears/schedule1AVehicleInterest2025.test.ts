import { calculate2025VehicleInterestCandidate as calc } from './schedule1AVehicleInterest2025'
const loan = {vin:'1HGCM82633A004352',interestPaid2025:6000,interestDeductedElsewhere:1000,
 originatedAfter2024:true,loanOriginatedByTaxpayer:true,loanUsedToPurchaseVehicleNotLease:true,
 securedByFirstLien:true,originalUseBeganWithTaxpayer:true,eligibleVehicleTypeAndWeight:true,
 finalAssemblyInUnitedStatesVerified:true,predominantlyPersonalUse:true,qualifiedLoanAndRefinancingReviewed:true}
const base = {filingStatus:'single' as const,modifiedAdjustedGrossIncome:100000,loans:[loan]}
test('eligible interest excludes amount deducted elsewhere',()=>expect(calc(base).calculatedCandidate).toBe(5000))
test('caps at $10,000',()=>expect(calc({...base,loans:[{...loan,interestPaid2025:20000,interestDeductedElsewhere:0}]}).calculatedCandidate).toBe(10000))
test('phases out $200 for a partial $1,000',()=>expect(calc({...base,modifiedAdjustedGrossIncome:100000.01}).calculatedCandidate).toBe(4800))
test('joint MAGI threshold is $200,000',()=>expect(calc({...base,filingStatus:'marriedJoint',modifiedAdjustedGrossIncome:200000}).calculatedCandidate).toBe(5000))
test('blocks unverified US assembly',()=>expect(calc({...base,loans:[{...loan,finalAssemblyInUnitedStatesVerified:false}]}).calculatedCandidate).toBeNull())
test('blocks duplicate VIN',()=>expect(calc({...base,loans:[loan,loan]}).calculatedCandidate).toBeNull())
test('blocks interest deducted twice',()=>expect(calc({...base,loans:[{...loan,interestDeductedElsewhere:7000}]}).calculatedCandidate).toBeNull())
test('rejects fractional cents',()=>expect(()=>calc({...base,loans:[{...loan,interestPaid2025:1.001}]})).toThrow())
test('never populates Form 1040 line 13b',()=>expect(calc(base).form1040Line13b).toBeNull())
