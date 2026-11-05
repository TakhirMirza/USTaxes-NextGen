import { CREDIT_KINDS_2025, review2025CreditEvidence } from './creditEvidence2025'

test('complete explicit no-credit review is possible without assuming absent equals zero', () => {
  const result = review2025CreditEvidence(CREDIT_KINDS_2025.map(kind => ({kind, status: 'confirmed-none' as const})))
  expect(result.complete).toBe(true)
  expect(Object.values(result.amounts)).toHaveLength(7)
})
test('missing categories are blockers', () => {
  expect(review2025CreditEvidence([]).blockers).toHaveLength(7)
})
test('worksheet amounts require a traceable reference', () => {
  const result = review2025CreditEvidence([{kind:'earned-income', status:'verified-worksheet', amount: 500}])
  expect(result.complete).toBe(false)
})
test('unverified values cannot silently enter reconciliation', () => {
  expect(() => review2025CreditEvidence([{kind:'earned-income', status:'requires-worksheet', amount: 500}])).toThrow()
})
test('duplicates and invalid monetary values are rejected', () => {
  expect(() => review2025CreditEvidence([{kind:'earned-income', status:'confirmed-none'}, {kind:'earned-income', status:'confirmed-none'}])).toThrow()
  expect(() => review2025CreditEvidence([{kind:'earned-income', status:'verified-worksheet', amount: 0.001, worksheetReference:'EIC worksheet'}])).toThrow()
})
