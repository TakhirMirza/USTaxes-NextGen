import { reviewCombined2025Schedule1A } from './schedule1ACombined2025'
import { stage2025Schedule1ACandidates } from './schedule1AWorksheet2025'

const base = () => ({
  tips: {year:2025 as const,filingReady:false as const,calculatedCandidate:100,form1040Line13b:null,blockers:[]},
  overtime: {year:2025 as const,filingReady:false as const,calculatedCandidate:200,form1040Line13b:null,blockers:[]},
  vehicleInterest: {year:2025 as const,filingReady:false as const,calculatedCandidate:300,form1040Line13b:null,blockers:[]},
  senior: {year:2025 as const,filingReady:false as const,calculatedCandidate:400,form1040Line13b:null,blockers:[]},
  staged: stage2025Schedule1ACandidates([
    {category:'qualifiedTips',amount:100},{category:'qualifiedOvertimePremium',amount:200},
    {category:'qualifiedPassengerVehicleLoanInterest',amount:300},
    {category:'seniorDeductionCandidate',amount:400},
  ]),
})
test('four categories reconcile but never authorize 1040 line 13b', () => {
  const result = reviewCombined2025Schedule1A(base())
  expect(result.reviewComplete).toBe(true)
  expect(result.preliminaryTotal).toBe(1000)
  expect(result.form1040Line13b).toBeNull()
  expect(result.filingReady).toBe(false)
})
test('missing worksheet is blocked', () => {
  const result = reviewCombined2025Schedule1A({...base(),tips:null})
  expect(result.reviewComplete).toBe(false)
  expect(result.preliminaryTotal).toBeNull()
})
test('discrepant staged amount is blocked', () => {
  const facts = base()
  facts.staged.candidates.qualifiedTips = 99
  expect(reviewCombined2025Schedule1A(facts).blockers).toEqual(expect.arrayContaining([
    expect.stringContaining('differs from calculated candidate'),
  ]))
})
test('unresolved source eligibility blocks review', () => {
  const facts = base()
  facts.tips.blockers.push('SSN unverified')
  expect(reviewCombined2025Schedule1A(facts).reviewComplete).toBe(false)
})
