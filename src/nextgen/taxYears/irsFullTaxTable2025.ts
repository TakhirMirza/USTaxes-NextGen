/**
 * 2025 IRS Tax Table: fail-closed, full-dataset validation before any lookup.
 * A complete row count alone is NOT proof of provenance or IRS accuracy.
 * Source: https://www.irs.gov/instructions/i1040gi
 */
import { FilingStatus2025 } from './preview2025'
import { PublishedTaxRow2025 } from './irsPublishedTaxTable2025'
import { IMPORTED_2025_TAX_ROWS } from './irsImportedTaxTable2025'

/** Exact 2025 IRS Tax Table income bands, independently of tax amounts. */
export function expected2025TaxTableBands(): ReadonlyArray<Readonly<{ lower: number; upper: number }>> {
  const bands: { lower: number; upper: number }[] = [
    { lower: 0, upper: 5 },
    { lower: 5, upper: 15 },
    { lower: 15, upper: 25 },
  ]
  for (let lower = 25; lower < 3000; lower += 25) bands.push({ lower, upper: lower + 25 })
  for (let lower = 3000; lower < 100000; lower += 50) bands.push({ lower, upper: lower + 50 })
  return bands
}

const EXPECTED_BANDS = expected2025TaxTableBands()

const COLUMNS = ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold'] as const

/** Structural validation only; NOT an IRS-source authenticity check. */
export function validateComplete2025TaxTable(rows: ReadonlyArray<PublishedTaxRow2025>): boolean {
  if (rows.length !== EXPECTED_BANDS.length) return false
  let expectedLower = 0
  let previous: PublishedTaxRow2025 | undefined
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const expected = EXPECTED_BANDS[i]
    if (row.lower !== expected.lower || row.upper !== expected.upper) return false
    if (!Number.isSafeInteger(row.lower) || !Number.isSafeInteger(row.upper)) return false
    if (row.lower !== expectedLower || row.upper <= row.lower || row.upper > 100000) return false
    for (const col of COLUMNS) {
      if (!Number.isSafeInteger(row[col]) || row[col] < 0) return false
      if (previous && row[col] < previous[col]) return false
    }
    expectedLower = row.upper
    previous = row
  }
  return expectedLower === 100000
}

/** Returns a candidate ONLY if a complete structurally valid table exists. */
export function lookupImported2025Tax(
  taxableIncome: number,
  status: FilingStatus2025
): number | undefined {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0 || taxableIncome >= 100000) return undefined
  const rows: ReadonlyArray<PublishedTaxRow2025> = IMPORTED_2025_TAX_ROWS
  if (!validateComplete2025TaxTable(rows)) return undefined
  const column = status === 'qualifyingSurvivingSpouse' ? 'marriedJoint' : status
  if (!COLUMNS.includes(column as typeof COLUMNS[number])) return undefined
  let lo = 0, hi = rows.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const row = rows[mid]
    if (taxableIncome < row.lower) hi = mid - 1
    else if (taxableIncome >= row.upper) lo = mid + 1
    else return row[column as typeof COLUMNS[number]]
  }
  return undefined
}
