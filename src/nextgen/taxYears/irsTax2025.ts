/**
 * 2025 IRS Form 1040 instructions: Tax Computation Worksheet (line 16).
 * https://www.irs.gov/instructions/i1040gi
 *
 * This is ONLY the ordinary-income tax computation for taxable income >= $100,000.
 * It does not determine whether this method applies to a taxpayer. Other IRS
 * worksheets (qualified dividends, capital gains, Schedule D, etc.) may override.
 * Under $100,000, the IRS Tax Table is normally required and is not implemented here.
 */
import { FilingStatus2025 } from './preview2025'

export type IrsTax2025Result =
  | { kind: 'computed'; tax: number; method: '2025 Tax Computation Worksheet'; filingReady: false }
  | { kind: 'requires-tax-table'; reason: string; filingReady: false }
  | { kind: 'requires-special-worksheet'; reason: string; filingReady: false }

interface TaxBand { upTo: number; rate: number; subtract: number }
const INF = Infinity
const bands: Record<FilingStatus2025, TaxBand[]> = {
  single: [
    { upTo: 103350, rate: .22, subtract: 5086 },
    { upTo: 197300, rate: .24, subtract: 7153 },
    { upTo: 250525, rate: .32, subtract: 22937 },
    { upTo: 626350, rate: .35, subtract: 30452.75 },
    { upTo: INF, rate: .37, subtract: 42979.75 },
  ],
  marriedJoint: [
    { upTo: 206700, rate: .22, subtract: 10172 },
    { upTo: 394600, rate: .24, subtract: 14306 },
    { upTo: 501050, rate: .32, subtract: 45874 },
    { upTo: 751600, rate: .35, subtract: 60905.50 },
    { upTo: INF, rate: .37, subtract: 75937.50 },
  ],
  marriedSeparate: [
    { upTo: 103350, rate: .22, subtract: 5086 },
    { upTo: 197300, rate: .24, subtract: 7153 },
    { upTo: 250525, rate: .32, subtract: 22937 },
    { upTo: 375800, rate: .35, subtract: 30452.75 },
    { upTo: INF, rate: .37, subtract: 37968.75 },
  ],
  headOfHousehold: [
    { upTo: 103350, rate: .22, subtract: 6825 },
    { upTo: 197300, rate: .24, subtract: 8892 },
    { upTo: 250500, rate: .32, subtract: 24676 },
    { upTo: 626350, rate: .35, subtract: 32191 },
    { upTo: INF, rate: .37, subtract: 44718 },
  ],
  qualifyingSurvivingSpouse: [
    { upTo: 206700, rate: .22, subtract: 10172 },
    { upTo: 394600, rate: .24, subtract: 14306 },
    { upTo: 501050, rate: .32, subtract: 45874 },
    { upTo: 751600, rate: .35, subtract: 60905.50 },
    { upTo: INF, rate: .37, subtract: 75937.50 },
  ],
}

/** The caller must affirm that no alternative IRS tax worksheet is required. */
export function compute2025IrsOrdinaryTax(
  taxableIncome: number,
  status: FilingStatus2025,
  options: { ordinaryIncomeOnlyConfirmed: boolean }
): IrsTax2025Result {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0 || taxableIncome > 1e12) {
    throw new RangeError('Invalid taxable income')
  }
  if (!Object.prototype.hasOwnProperty.call(bands, status)) {
    throw new RangeError('Invalid filing status')
  }
  if (!options.ordinaryIncomeOnlyConfirmed) {
    return { kind: 'requires-special-worksheet', reason: 'Confirm eligibility for ordinary-income tax calculation; special IRS worksheets may apply.', filingReady: false }
  }
  if (taxableIncome < 100000) {
    return { kind: 'requires-tax-table', reason: '2025 IRS Tax Table required for taxable income under $100,000; not yet implemented.', filingReady: false }
  }
  const band = bands[status].find((entry) => taxableIncome <= entry.upTo)
  if (!band) throw new RangeError('Tax band not found')
  // Round to whole dollars for a line 16 worksheet result.
  const tax = Math.round(taxableIncome * band.rate - band.subtract)
  return { kind: 'computed', tax, method: '2025 Tax Computation Worksheet', filingReady: false }
}
