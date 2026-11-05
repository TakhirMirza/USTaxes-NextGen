import { review2025Schedule1AForForm1040 } from './form1040Schedule1ABridge2025'
import { RestrictedDraft2025 } from './form1040Draft2025'
import { CombinedSchedule1AReview2025 } from './schedule1ACombined2025'

const draft = (): RestrictedDraft2025 => ({
  year: 2025, filingReady: false,
  lines: {'1a': 0,'2b': 0,'8': 0,'9': 0,'10': 0,'11a': 0,'12e': 0,'15': 5000,'25a': 0,'25b': 0,'25d': 0},
  line16: null as unknown as RestrictedDraft2025['line16'], excluded: [],
})
const review = (): CombinedSchedule1AReview2025 => ({
  year: 2025, filingReady: false, reviewComplete: true,
  candidateAmounts: {qualifiedTips: 500, qualifiedOvertimePremium: 500, qualifiedPassengerVehicleLoanInterest: 0, seniorDeductionCandidate: 0},
  preliminaryTotal: 1000, form1040Line13b: null, blockers: [],
})
test('reconciled candidate is preview-only and does not post to line 13b', () => {
  const result = review2025Schedule1AForForm1040(draft(), review())
  expect(result.provisionalLine15IfAllowed).toBe(4000)
  expect(result.draftLine15Unchanged).toBe(5000)
  expect(result.form1040Line13b).toBeNull()
  expect(result.eligibleToPost).toBe(false)
  expect(result.filingReady).toBe(false)
})
test('candidate preview cannot produce negative taxable income', () => {
  const r = review(); r.preliminaryTotal = 6000
  expect(review2025Schedule1AForForm1040(draft(), r).provisionalLine15IfAllowed).toBe(0)
})
test('missing review is blocked', () => {
  const result = review2025Schedule1AForForm1040(draft(), null)
  expect(result.provisionalLine15IfAllowed).toBeNull()
  expect(result.blockers).toEqual(expect.arrayContaining([expect.stringContaining('missing')]))
})
test('unresolved eligibility suppresses preview', () => {
  const r = review(); r.reviewComplete = false; r.blockers.push('SSN missing')
  const result = review2025Schedule1AForForm1040(draft(), r)
  expect(result.provisionalLine15IfAllowed).toBeNull()
  expect(result.blockers).toEqual(expect.arrayContaining([expect.stringContaining('SSN missing')]))
})
test('rejects invalid candidate amounts', () => {
  const r = review(); r.preliminaryTotal = Number.NaN
  expect(() => review2025Schedule1AForForm1040(draft(), r)).toThrow(RangeError)
})
