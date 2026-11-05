import { audit2025TaxTable, IRS_2025_TAX_TABLE_COMPLETE } from './irsTaxTableCoverage2025'
import { VERIFIED_2025_TAX_TABLE_ROWS } from './irsPublishedTaxTable2025'

describe('2025 official Tax Table coverage safety gate', () => {
  test('current partial table is not declared complete', () => {
    const result = audit2025TaxTable()
    expect(result.rowCount).toBe(46)
    expect(result.coveredDollars).toBe(1200)
    expect(result.missingDollars).toBe(98800)
    expect(result.gaps).toEqual([
      { lower: 1000, upper: 25200 },
      { lower: 25400, upper: 100000 },
    ])
    expect(result.errors).toEqual([])
    expect(result.complete).toBe(false)
    expect(IRS_2025_TAX_TABLE_COMPLETE).toBe(false)
  })
  test('detects overlaps and invalid values', () => {
    const row = VERIFIED_2025_TAX_TABLE_ROWS[0]
    const overlapping = { ...row, lower: row.lower + 1 }
    const invalid = { ...row, single: -1 }
    const result = audit2025TaxTable([row, overlapping, invalid])
    expect(result.complete).toBe(false)
    expect(result.errors.some(x => x.includes('Overlapping'))).toBe(true)
    expect(result.errors.some(x => x.includes('Invalid tax'))).toBe(true)
  })
  test('detects missing rows and empty table', () => {
    expect(audit2025TaxTable([]).gaps).toEqual([{ lower: 0, upper: 100000 }])
    expect(audit2025TaxTable([]).complete).toBe(false)
  })
})
