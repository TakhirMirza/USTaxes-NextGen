import { FilingStatus2025 } from './preview2025'
import { Interest1099Entry2025, W2Entry2025, preview2025Income } from './income2025'

/**
 * Educational, line-inspired 2025 federal worksheet.
 * NOT an IRS Form 1040 implementation. No tax-table computation, adjustments,
 * credits, special deductions, or filing/export functionality is provided.
 */
export interface Form1040Worksheet2025 {
  taxYear: 2025
  filingStatus: FilingStatus2025
  line1aW2Wages: number
  line2bTaxableInterest: number
  line9IllustrativeTotalIncome: number
  line11IllustrativeAdjustedGrossIncome: number
  line12BasicStandardDeduction: number
  line15IllustrativeTaxableIncome: number
  line16IllustrativeBracketTax: number
  line25aW2Withholding: number
  line25b1099InterestWithholding: number
  line25dIllustrativeTotalWithholding: number
  illustrativeWithholdingLessBracketTax: number
  filingReady: false
}

const cents = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export function create2025Form1040Worksheet(
  w2s: W2Entry2025[],
  interests: Interest1099Entry2025[],
  status: FilingStatus2025
): Form1040Worksheet2025 {
  const income = preview2025Income(w2s, interests, status)
  const w2Withholding = cents(w2s.reduce((sum, item) => sum + item.box2FederalWithholding, 0))
  const interestWithholding = cents(interests.reduce((sum, item) => sum + item.federalWithholding, 0))
  return {
    taxYear: 2025,
    filingStatus: status,
    line1aW2Wages: cents(income.wages),
    line2bTaxableInterest: cents(income.taxableInterest),
    line9IllustrativeTotalIncome: cents(income.totalOrdinaryIncome),
    // Assumes zero adjustments. Not an actual AGI determination.
    line11IllustrativeAdjustedGrossIncome: cents(income.totalOrdinaryIncome),
    line12BasicStandardDeduction: income.standardDeduction,
    line15IllustrativeTaxableIncome: income.illustrativeTaxableIncome,
    line16IllustrativeBracketTax: income.illustrativeBracketTax,
    line25aW2Withholding: w2Withholding,
    line25b1099InterestWithholding: interestWithholding,
    line25dIllustrativeTotalWithholding: cents(income.federalWithholding),
    illustrativeWithholdingLessBracketTax: income.illustrativeWithholdingMinusBracketTax,
    filingReady: false,
  }
}
