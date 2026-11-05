import { review2025SourceDocuments, SOURCE_CATEGORIES_2025, SourceReviewDeclaration2025 } from './sourceDocumentReview2025'

const none = Object.fromEntries(SOURCE_CATEGORIES_2025.map(x => [x, 'noneConfirmed'])) as SourceReviewDeclaration2025

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
  expect(() => review2025SourceDocuments({ ...none, fake: 'noneConfirmed' } as any, { w2: 0, '1099int': 0 })).toThrow(/Unsupported/)
  expect(() => review2025SourceDocuments({ ...none, '1099b': 'maybe' } as any, { w2: 0, '1099int': 0 })).toThrow(/Invalid/)
})
