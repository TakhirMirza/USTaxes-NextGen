import { review2025SourceDocuments, SOURCE_CATEGORIES_2025, SourceReviewDeclaration2025 } from './sourceDocumentReview2025'

const none: SourceReviewDeclaration2025 = SOURCE_CATEGORIES_2025.reduce<SourceReviewDeclaration2025>((declarations, category) => {
  declarations[category] = 'noneConfirmed'
  return declarations
}, {})

test('missing categories are never inferred absent', () => {
  const result = review2025SourceDocuments({ w2: 'noneConfirmed' }, { w2: 0, '1099int': 0 })
  expect(result.completeInventory).toBe(false)
  expect(result.missingCategories).toContain('1099int')
})
test('explicitly reviewed absence is recorded without granting filing authorization', () => {
  const result = review2025SourceDocuments(none, { w2: 0, '1099int': 0 })
  expect(result.completeInventory).toBe(true)
  expect(result.filingReady).toBe(false)
})
test('unmodeled reported income remains a blocker', () => {
  const result = review2025SourceDocuments({ ...none, '1099b': 'documentsProvided' }, { w2: 0, '1099int': 0 })
  expect(result.categoriesRequiringSeparateCalculation).toEqual(['1099b'])
})
test('source declarations cannot contradict entered documents', () => {
  expect(() => review2025SourceDocuments(none, { w2: 1, '1099int': 0 })).toThrow(/documents exist/)
  expect(() => review2025SourceDocuments({ ...none, w2: 'documentsProvided' }, { w2: 0, '1099int': 0 })).toThrow(/none were entered/)
})
test('unknown categories and invalid dispositions are rejected', () => {
  expect(() => review2025SourceDocuments({ ...none, fake: 'noneConfirmed' } as unknown as SourceReviewDeclaration2025, { w2: 0, '1099int': 0 })).toThrow(/Unsupported/)
  expect(() => review2025SourceDocuments({ ...none, '1099b': 'maybe' } as unknown as SourceReviewDeclaration2025, { w2: 0, '1099int': 0 })).toThrow(/Invalid/)
})

test('null and numeric source dispositions are rejected rather than treated as reviewed', () => {
  const invalidNull = { ...none, '1099b': null } as unknown as SourceReviewDeclaration2025
  const invalidNumber = { ...none, '1099b': 1 } as unknown as SourceReviewDeclaration2025
  expect(() => review2025SourceDocuments(invalidNull, { w2: 0, '1099int': 0 })).toThrow(/Invalid/)
  expect(() => review2025SourceDocuments(invalidNumber, { w2: 0, '1099int': 0 })).toThrow(/Invalid/)
})
