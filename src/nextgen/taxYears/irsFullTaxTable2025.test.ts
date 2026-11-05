import { validateComplete2025TaxTable, lookupImported2025Tax, expected2025TaxTableBands } from './irsFullTaxTable2025'
import { PublishedTaxRow2025 } from './irsPublishedTaxTable2025'

const makeRows = (): PublishedTaxRow2025[] => {
  const rows: PublishedTaxRow2025[] = []
  // Synthetic data to exercise structure only. Never use as actual tax values.
  for (const { lower, upper } of expected2025TaxTableBands()) {
    // Synthetic values only; test structural validation, not IRS correctness.
    const i = rows.length
    rows.push({ lower, upper, single: i, marriedJoint: i, marriedSeparate: i, headOfHousehold: i })
  }
  return rows
}

describe('2025 imported table fail-closed validation', () => {
  test('uses exact 2025 band boundaries', () => {
    const bands = expected2025TaxTableBands()
    expect(bands).toHaveLength(2062)
    expect(bands[0]).toEqual({ lower: 0, upper: 5 })
    expect(bands[2]).toEqual({ lower: 15, upper: 25 })
    expect(bands[121]).toEqual({ lower: 2975, upper: 3000 })
    expect(bands[122]).toEqual({ lower: 3000, upper: 3050 })
    expect(bands[2061]).toEqual({ lower: 99950, upper: 100000 })
  })
  test('rejects a structurally continuous table with wrong band widths', () => {
    const rows = makeRows()
    rows[122] = { ...rows[122], upper: 3025 }
    rows[123] = { ...rows[123], lower: 3025 }
    expect(validateComplete2025TaxTable(rows)).toBe(false)
  })
  test('rejects missing bundled table', () => {
    expect(lookupImported2025Tax(25300, 'single')).toBeUndefined()
  })
  test('rejects incomplete data', () => {
    expect(validateComplete2025TaxTable(makeRows().slice(0, -1))).toBe(false)
  })
  test('rejects a gap even if row count matches', () => {
    const rows = makeRows()
    rows[100] = { ...rows[100], lower: rows[100].lower + 1 }
    expect(validateComplete2025TaxTable(rows)).toBe(false)
  })
  test('rejects negative and fractional taxes', () => {
    const rows = makeRows()
    rows[200] = { ...rows[200], single: -1 }
    expect(validateComplete2025TaxTable(rows)).toBe(false)
    rows[200] = { ...rows[200], single: 1.5 }
    expect(validateComplete2025TaxTable(rows)).toBe(false)
  })
  test('rejects decreasing tax', () => {
    const rows = makeRows()
    rows[200] = { ...rows[200], single: 0 }
    expect(validateComplete2025TaxTable(rows)).toBe(false)
  })
  test('rejects invalid final boundary', () => {
    const rows = makeRows()
    rows[2061] = { ...rows[2061], upper: 99999 }
    expect(validateComplete2025TaxTable(rows)).toBe(false)
  })
  test('accepts structurally complete synthetic data, not as IRS verification', () => {
    expect(validateComplete2025TaxTable(makeRows())).toBe(true)
  })
})
