/**
 * Explicit source-document completeness review for 2025. A declaration that a
 * category was reviewed is not a determination of tax-law eligibility.
 * This review prevents a missing category from silently becoming zero income.
 */
export const SOURCE_CATEGORIES_2025 = [
  'w2', '1099int', '1099div', '1099b', '1099r', '1099g',
  '1099nec', '1099misc', '1099k', 'ssa1099', 'k1',
  'selfEmployment', 'rental', 'foreignIncome', 'otherIncome',
] as const
export type SourceCategory2025 = typeof SOURCE_CATEGORIES_2025[number]
export type SourceReviewDisposition2025 = 'notReviewed' | 'noneConfirmed' | 'documentsProvided'
export type SourceReviewDeclaration2025 = Partial<Record<SourceCategory2025, SourceReviewDisposition2025>>
export interface SourceDocumentReview2025 {
  filingReady: false
  completeInventory: boolean
  missingCategories: SourceCategory2025[]
  categoriesRequiringSeparateCalculation: SourceCategory2025[]
  warnings: string[]
}

/** W-2 and 1099-INT are modeled elsewhere; other reported categories are not. */
const modeled = new Set<SourceCategory2025>(['w2', '1099int'])

export function review2025SourceDocuments(
  declaration: SourceReviewDeclaration2025,
  actualCounts: { w2: number; '1099int': number }
): SourceDocumentReview2025 {
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) {
    throw new RangeError('Source review declaration must be an object')
  }
  for (const key of Object.keys(declaration)) {
    if (!(SOURCE_CATEGORIES_2025 as readonly string[]).includes(key)) {
      throw new RangeError(`Unsupported source category: ${key}`)
    }
  }
  const missingCategories: SourceCategory2025[] = []
  const categoriesRequiringSeparateCalculation: SourceCategory2025[] = []
  for (const category of SOURCE_CATEGORIES_2025) {
    // Treat external data as untrusted even when TypeScript callers are well typed.
    const supplied: unknown = declaration[category]
    const disposition = supplied === undefined ? 'notReviewed' : supplied
    if (disposition !== 'notReviewed' && disposition !== 'noneConfirmed' && disposition !== 'documentsProvided') {
      throw new RangeError(`Invalid source review disposition for ${category}`)
    }
    if (disposition === 'notReviewed') missingCategories.push(category)
    if (!modeled.has(category) && disposition === 'documentsProvided') {
      categoriesRequiringSeparateCalculation.push(category)
    }
    if (modeled.has(category)) {
      const count = actualCounts[category as 'w2' | '1099int']
      if (!Number.isSafeInteger(count) || count < 0) throw new RangeError(`Invalid document count for ${category}`)
      if (disposition === 'noneConfirmed' && count !== 0) {
        throw new RangeError(`${category}: documents exist but declaration says none`)
      }
      if (disposition === 'documentsProvided' && count === 0) {
        throw new RangeError(`${category}: declaration says documents provided but none were entered`)
      }
    }
  }
  return {
    filingReady: false,
    completeInventory: missingCategories.length === 0,
    missingCategories,
    categoriesRequiringSeparateCalculation,
    warnings: [
      ...(missingCategories.length ? ['Some income-source categories have not been reviewed.'] : []),
      ...(categoriesRequiringSeparateCalculation.length ? ['Reported sources require additional tax calculations not supported by the restricted 1040 draft.'] : []),
      'Completeness of this inventory is self-reported and does not certify a tax return.',
    ],
  }
}
