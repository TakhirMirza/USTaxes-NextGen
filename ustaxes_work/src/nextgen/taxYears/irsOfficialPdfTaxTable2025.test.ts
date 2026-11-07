import { IMPORTED_2025_TAX_ROWS } from './irsImportedTaxTable2025'
import { validateComplete2025TaxTable, lookupImported2025Tax } from './irsFullTaxTable2025'

describe('2025 IRS PDF transcription', () => {
  test('contains all 2062 exact bands', () => {
    expect(IMPORTED_2025_TAX_ROWS).toHaveLength(2062)
    expect(validateComplete2025TaxTable(IMPORTED_2025_TAX_ROWS)).toBe(true)
  })
  test('recovers split first-page bands', () => {
    expect(lookupImported2025Tax(5, 'single')).toBe(1)
    expect(lookupImported2025Tax(14.99, 'marriedJoint')).toBe(1)
    expect(lookupImported2025Tax(15, 'headOfHousehold')).toBe(2)
  })
  test('matches IRS worked example', () => {
    expect(lookupImported2025Tax(25300, 'marriedJoint')).toBe(2562)
  })
  test('handles upper boundary conservatively', () => {
    expect(lookupImported2025Tax(99999, 'single')).toBe(16909)
    expect(lookupImported2025Tax(100000, 'single')).toBeUndefined()
  })
})
