/** Official 2025 IRS Tax Computation Worksheet (Form 1040 line 16).
 * Source: https://www.irs.gov/publications/p1040
 * Restricted to whole-dollar ordinary-income cases >= $100,000.
 * Special-rate/alternative worksheets must be ruled out independently.
 * Never authorizes filing or replaces eligibility review.
 */
import { FilingStatus2025 } from './preview2025'

export type WorksheetTax2025 =
  | { status: 'blocked'; filingReady: false; reason: string }
  | { status: 'computed'; filingReady: false; line16TaxDollars: number; ratePercent: number; subtractionDollars: number; worksheetSection: 'A' | 'B' | 'C' | 'D' }
type Row = readonly [number, number, number] // inclusive upper bound, percent, subtraction in cents
const A: readonly Row[] = [[103350,22,508600],[197300,24,715300],[250525,32,2293700],[626350,35,3045275],[Infinity,37,4297975]]
const B: readonly Row[] = [[206700,22,1017200],[394600,24,1430600],[501050,32,4587400],[751600,35,6090550],[Infinity,37,7593750]]
const C: readonly Row[] = [[103350,22,508600],[197300,24,715300],[250525,32,2293700],[375800,35,3045275],[Infinity,37,3796875]]
const D: readonly Row[] = [[103350,22,682500],[197300,24,889200],[250500,32,2467600],[626350,35,3219100],[Infinity,37,4471800]]
const sections: Record<FilingStatus2025, { section: 'A' | 'B' | 'C' | 'D'; rows: readonly Row[] }> = {
  single: { section: 'A', rows: A }, marriedJoint: { section: 'B', rows: B },
  marriedSeparate: { section: 'C', rows: C }, headOfHousehold: { section: 'D', rows: D },
  qualifyingSurvivingSpouse: { section: 'B', rows: B }
}
export function computeIrsTaxWorksheet2025(
  taxableIncomeDollars: number,
  filingStatus: FilingStatus2025,
  ordinaryIncomeOnlyConfirmed: boolean
): WorksheetTax2025 {
  const blocked = (reason: string): WorksheetTax2025 => ({ status: 'blocked', filingReady: false, reason })
  if (!Number.isSafeInteger(taxableIncomeDollars) || taxableIncomeDollars < 0 || taxableIncomeDollars > 1000000000) return blocked('Taxable income must be a nonnegative whole-dollar amount within supported limits.')
  if (!Object.prototype.hasOwnProperty.call(sections, filingStatus)) return blocked('Unsupported filing status.')
  if (!ordinaryIncomeOnlyConfirmed) return blocked('Qualified dividends, capital gains, Form 8615, Schedule J, Form 2555 and other special tax methods must be reviewed first.')
  if (taxableIncomeDollars < 100000) return blocked('For taxable income below $100,000, use the official 2025 IRS Tax Table, not this worksheet.')
  const { section, rows } = sections[filingStatus]
  const row = rows.find(([upper]) => taxableIncomeDollars <= upper)
  if (!row) return blocked('No applicable worksheet bracket.')
  const [, rate, subtractionCents] = row
  // IRS worksheet uses a percent multiplied by whole-dollar taxable income, then subtracts the published amount.
  // All arithmetic is in cents; final Form 1040 line is rounded to nearest whole dollar.
  const resultCents = taxableIncomeDollars * rate - subtractionCents
  if (!Number.isSafeInteger(resultCents) || resultCents < 0) return blocked('Tax arithmetic exceeded supported limits.')
  return { status: 'computed', filingReady: false, line16TaxDollars: Math.floor((resultCents + 50) / 100), ratePercent: rate, subtractionDollars: subtractionCents / 100, worksheetSection: section }
}
