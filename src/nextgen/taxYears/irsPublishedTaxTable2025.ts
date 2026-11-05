/**
 * Exact rows from the IRS 2025 Publication 1040 sample Tax Table.
 * This intentionally is NOT the full 2025 Tax Table. Never extrapolate.
 * https://www.irs.gov/publications/p1040
 */
import { FilingStatus2025 } from './preview2025'

export const IRS_2025_TAX_TABLE_SOURCE = 'https://www.irs.gov/publications/p1040'

export interface PublishedTaxRow2025 {
  lower: number
  upper: number
  single: number
  marriedJoint: number
  marriedSeparate: number
  headOfHousehold: number
}

export const VERIFIED_2025_SAMPLE_ROWS: ReadonlyArray<Readonly<PublishedTaxRow2025>> = [
  { lower: 25200, upper: 25250, single: 2789, marriedJoint: 2550, marriedSeparate: 2789, headOfHousehold: 2687 },
  { lower: 25250, upper: 25300, single: 2795, marriedJoint: 2556, marriedSeparate: 2795, headOfHousehold: 2693 },
  { lower: 25300, upper: 25350, single: 2801, marriedJoint: 2562, marriedSeparate: 2801, headOfHousehold: 2699 },
  { lower: 25350, upper: 25400, single: 2807, marriedJoint: 2568, marriedSeparate: 2807, headOfHousehold: 2705 },
]

/**
 * IRS Publication 1040 (2025), first Tax Table panel, taxable income $0-$1,000.
 * All four filing-status columns have identical values in this panel.
 * Intervals are [lower, upper); first interval $0-$5, second $5-$15,
 * third $15-$25, then $25 intervals through $1,000.
 * This is a TRANSCRIPTION of the published table, not a formula or interpolation.
 */
const FIRST_PANEL_TAXES_2025: ReadonlyArray<number> = [
  0, 1, 2, 4, 6, 9, 11, 14, 16, 19, 21, 24, 26, 29, 31, 34,
  36, 39, 41, 44, 46, 49, 51, 54, 56, 59, 61, 64, 66, 69,
  71, 74, 76, 79, 81, 84, 86, 89, 91, 94, 96, 99,
]

export const VERIFIED_2025_FIRST_PANEL_ROWS: ReadonlyArray<Readonly<PublishedTaxRow2025>> =
  FIRST_PANEL_TAXES_2025.map((tax, index) => {
    const lower = index === 0 ? 0 : index === 1 ? 5 : index === 2 ? 15 : (index - 2) * 25
    const upper = index === 0 ? 5 : index === 1 ? 15 : index === 2 ? 25 : (index - 1) * 25
    return { lower, upper, single: tax, marriedJoint: tax, marriedSeparate: tax, headOfHousehold: tax }
  })

/** Only rows transcribed from the official IRS publication are available. */
export const VERIFIED_2025_TAX_TABLE_ROWS: ReadonlyArray<Readonly<PublishedTaxRow2025>> = [
  ...VERIFIED_2025_FIRST_PANEL_ROWS,
  ...VERIFIED_2025_SAMPLE_ROWS,
]

/** Undefined means not verified, not zero tax. */
export function lookupVerified2025SampleTax(
  taxableIncome: number,
  status: FilingStatus2025
): number | undefined {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0 || taxableIncome >= 100000) return undefined
  const row = VERIFIED_2025_TAX_TABLE_ROWS.find(({ lower, upper }) => taxableIncome >= lower && taxableIncome < upper)
  if (!row) return undefined
  if (status === 'qualifyingSurvivingSpouse') return row.marriedJoint
  if (status === 'single' || status === 'marriedJoint' || status === 'marriedSeparate' || status === 'headOfHousehold') {
    return row[status]
  }
  return undefined
}
