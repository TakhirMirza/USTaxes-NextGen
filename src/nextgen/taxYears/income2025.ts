import { FilingStatus2025, preview2025OrdinaryWages } from './preview2025'

export interface W2Entry2025 {
  id: string
  employer: string
  box1Wages: number
  box2FederalWithholding: number
}

export interface Interest1099Entry2025 {
  id: string
  payer: string
  box1TaxableInterest: number
  federalWithholding: number
}

const validMoney = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1e12

/** Educational aggregation only: excludes many Form 1040 rules and tax-table calculations. */
export function preview2025Income(
  w2s: W2Entry2025[],
  interests: Interest1099Entry2025[],
  status: FilingStatus2025
) {
  if (w2s.length > 100 || interests.length > 100) throw new RangeError('Too many entries')
  for (const entry of w2s) {
    if (!validMoney(entry.box1Wages) || !validMoney(entry.box2FederalWithholding)) {
      throw new RangeError('W-2 amounts must be nonnegative finite numbers')
    }
  }
  for (const entry of interests) {
    if (!validMoney(entry.box1TaxableInterest) || !validMoney(entry.federalWithholding)) {
      throw new RangeError('1099-INT amounts must be nonnegative finite numbers')
    }
  }
  const wages = w2s.reduce((sum, entry) => sum + entry.box1Wages, 0)
  const taxableInterest = interests.reduce((sum, entry) => sum + entry.box1TaxableInterest, 0)
  const federalWithholding = w2s.reduce((sum, entry) => sum + entry.box2FederalWithholding, 0) +
    interests.reduce((sum, entry) => sum + entry.federalWithholding, 0)
  const totalOrdinaryIncome = wages + taxableInterest
  if (![wages, taxableInterest, federalWithholding, totalOrdinaryIncome].every(validMoney)) {
    throw new RangeError('Combined amounts are outside the preview range')
  }
  const bracketPreview = preview2025OrdinaryWages(totalOrdinaryIncome, status)
  return {
    wages,
    taxableInterest,
    totalOrdinaryIncome,
    federalWithholding,
    standardDeduction: bracketPreview.standardDeduction,
    illustrativeTaxableIncome: bracketPreview.taxableOrdinaryIncome,
    illustrativeBracketTax: bracketPreview.illustrativeBracketTax,
    illustrativeWithholdingMinusBracketTax: Math.round((federalWithholding - bracketPreview.illustrativeBracketTax) * 100) / 100,
    filingReady: false as const,
  }
}
