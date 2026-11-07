/**
 * Conservative 2025 Form 1040 line 16 routing.
 * Source: https://www.irs.gov/instructions/i1040gi
 * This module never claims filing readiness. Only a directly published IRS
 * worked-example Tax Table cell is independently confirmed below.
 */
import { FilingStatus2025 } from './preview2025'
import { compute2025IrsOrdinaryTax } from './irsTax2025'
import { lookupVerified2025SampleTax, IRS_2025_TAX_TABLE_SOURCE } from './irsPublishedTaxTable2025'
import { lookupImported2025Tax } from './irsFullTaxTable2025'

export type Line16Decision2025 =
  | { kind: 'verified-reference-example'; tax: number; source: string; filingReady: false }
  | { kind: 'unverified-import-candidate'; tax: number; source: string; filingReady: false }
  | { kind: 'ordinary-worksheet'; tax: number; source: string; filingReady: false }
  | { kind: 'blocked'; reason: string; filingReady: false }

export interface Line16Facts2025 {
  taxableIncome: number
  status: FilingStatus2025
  /** Explicitly verified by the preparer; absence means unknown, not false. */
  ordinaryIncomeMethodApplicable?: boolean
  /** True/unknown prevents use of the basic tax calculation. */
  specialTaxWorksheetRequired?: boolean
}


export function decide2025Line16(facts: Line16Facts2025): Line16Decision2025 {
  const { taxableIncome, status } = facts
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0 || taxableIncome > 1e12) {
    return { kind: 'blocked', reason: 'Invalid taxable income.', filingReady: false }
  }
  if (!['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold', 'qualifyingSurvivingSpouse'].includes(String(status))) {
    return { kind: 'blocked', reason: 'Invalid filing status.', filingReady: false }
  }
  if (facts.specialTaxWorksheetRequired !== false || facts.ordinaryIncomeMethodApplicable !== true) {
    return {
      kind: 'blocked',
      reason: 'Special tax worksheets (including qualified dividends, capital gains, Form 8615 or other exceptions) have not been ruled out.',
      filingReady: false,
    }
  }
  if (taxableIncome < 100000) {
    // Independently transcribed published cells take precedence over the
    // complete imported dataset. The latter remains diagnostic-only.
    const verifiedTax = lookupVerified2025SampleTax(taxableIncome, status)
    if (verifiedTax !== undefined) {
      return { kind: 'verified-reference-example', tax: verifiedTax, source: IRS_2025_TAX_TABLE_SOURCE, filingReady: false }
    }
    const importedTax = lookupImported2025Tax(taxableIncome, status)
    if (importedTax !== undefined) {
      return { kind: 'unverified-import-candidate', tax: importedTax, source: IRS_2025_TAX_TABLE_SOURCE, filingReady: false }
    }
    return {
      kind: 'blocked',
      reason: 'Official 2025 Tax Table row has not been independently verified for this income and filing status.',
      filingReady: false,
    }
  }
  const result = compute2025IrsOrdinaryTax(taxableIncome, status, { ordinaryIncomeOnlyConfirmed: true })
  if (result.kind !== 'computed') {
    return { kind: 'blocked', reason: 'IRS ordinary tax worksheet unavailable.', filingReady: false }
  }
  return { kind: 'ordinary-worksheet', tax: result.tax, source: 'https://www.irs.gov/instructions/i1040gi', filingReady: false }
}
