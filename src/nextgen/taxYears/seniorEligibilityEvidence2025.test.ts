import { review2025SeniorEligibilityEvidence, SeniorEligibilityEvidence2025 } from './seniorEligibilityEvidence2025'
const verified = { taxpayerHasValidWorkSSN: 'yes' as const, taxpayerIsUSCitizenOrResident: 'yes' as const, marriedFilingJointly: 'no' as const }
test('missing evidence remains blocked', () => {
  expect(review2025SeniorEligibilityEvidence(undefined, false, false).complete).toBe(false)
})
test('single filer with explicit evidence can proceed to further review', () => {
  expect(review2025SeniorEligibilityEvidence(verified, false, false).eligibleForFurtherReview).toBe(true)
})
test('unresolved taxpayer SSN blocks', () => {
  expect(review2025SeniorEligibilityEvidence({...verified, taxpayerHasValidWorkSSN: 'unknown'}, false, false).complete).toBe(false)
})
test('joint spouse SSN is separately required', () => {
  const joint = {...verified, marriedFilingJointly: 'yes' as const }
  expect(review2025SeniorEligibilityEvidence(joint, true, true).complete).toBe(false)
  expect(review2025SeniorEligibilityEvidence({...joint, spouseHasValidWorkSSN: 'yes'}, true, true).complete).toBe(true)
})
test('malformed declaration is rejected', () => {
  expect(() => review2025SeniorEligibilityEvidence({...verified, taxpayerHasValidWorkSSN: 'maybe' as unknown as typeof verified.taxpayerHasValidWorkSSN}, false, false)).toThrow(TypeError)
})

test('missing spouse SSN is a blocker, not an exception', () => {
  const joint = {...verified, marriedFilingJointly: 'yes' as const }
  const review = review2025SeniorEligibilityEvidence(joint, true, true)
  expect(review.complete).toBe(false)
  expect(review.blockers.join(' ')).toMatch(/Spouse SSN requirement is unresolved/)
})

test('rejects malformed runtime senior evidence rather than accepting a false eligibility result', () => {
  const evidence = {
    taxpayerHasValidWorkSSN: 1,
    taxpayerIsUSCitizenOrResident: 'yes',
    marriedFilingJointly: 'no',
  } as unknown as SeniorEligibilityEvidence2025
  expect(() => review2025SeniorEligibilityEvidence(evidence, false, false)).toThrow(TypeError)
})
