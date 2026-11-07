/**
 * 2025 IRS Tax Table coverage audit.  This does not estimate missing tax.
 * Source: https://www.irs.gov/publications/p1040
 * A complete table covers taxable incomes [0, 100000) without gaps.
 */
import { VERIFIED_2025_TAX_TABLE_ROWS, PublishedTaxRow2025 } from './irsPublishedTaxTable2025'

export interface CoverageAudit2025 {
  rowCount: number
  coveredDollars: number
  missingDollars: number
  gaps: ReadonlyArray<Readonly<{ lower: number; upper: number }>>
  errors: ReadonlyArray<string>
  complete: boolean
}

const STATUS_COLUMNS: ReadonlyArray<keyof Pick<PublishedTaxRow2025,
  'single' | 'marriedJoint' | 'marriedSeparate' | 'headOfHousehold'>> =
  ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold']

export function audit2025TaxTable(
  rows: ReadonlyArray<Readonly<PublishedTaxRow2025>> = VERIFIED_2025_TAX_TABLE_ROWS
): CoverageAudit2025 {
  const errors: string[] = []
  const gaps: Array<{ lower: number; upper: number }> = []
  const sorted = [...rows].sort((a, b) => a.lower - b.lower)
  let cursor = 0
  let coveredDollars = 0
  // Index-based iteration is compatible with the React build target (ES5).
  for (let index = 0; index < sorted.length; index++) {
    const row = sorted[index]
    if (!Number.isInteger(row.lower) || !Number.isInteger(row.upper) ||
        row.lower < 0 || row.upper > 100000 || row.lower >= row.upper) {
      errors.push(`Invalid interval at sorted row ${index}`)
      continue
    }
    for (const col of STATUS_COLUMNS) {
      if (!Number.isInteger(row[col]) || row[col] < 0) {
        errors.push(`Invalid tax value for ${col} at row ${index}`)
      }
    }
    if (row.lower < cursor) errors.push(`Overlapping interval at ${row.lower}`)
    if (row.lower > cursor) gaps.push({ lower: cursor, upper: row.lower })
    const start = Math.max(cursor, row.lower)
    if (row.upper > start) coveredDollars += row.upper - start
    cursor = Math.max(cursor, row.upper)
  }
  if (cursor < 100000) gaps.push({ lower: cursor, upper: 100000 })
  return {
    rowCount: rows.length,
    coveredDollars,
    missingDollars: 100000 - coveredDollars,
    gaps,
    errors,
    complete: errors.length === 0 && gaps.length === 0 && coveredDollars === 100000,
  }
}

/** Only a fully transcribed, non-overlapping table can enable general lookup. */
export const IRS_2025_TAX_TABLE_COMPLETE = audit2025TaxTable().complete
