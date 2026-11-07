import { reconstruct2025TaxTableBand } from './irsTaxTable2025'

describe('2025 tax-table midpoint reconstruction (NOT filing-ready)', () => {
  test.each([
    ['single', 0, 0, 0, 5],
    ['single', 5, 1, 5, 15],
    ['single', 25, 4, 25, 50],
    ['marriedJoint', 25300, 2562, 25300, 25350], // IRS Publication 1040 worked example
    ['single', 99975, 16909, 99950, 100000], // IRS Publication 1040 published row
    ['marriedJoint', 99975, 11823, 99950, 100000],
  ] as const)('%s $%i gives provisional $%i', (status, income, tax, lower, upper) => {
    const result = reconstruct2025TaxTableBand(income, status)
    expect(result.provisionalTax).toBe(tax)
    expect(result.lowerBound).toBe(lower)
    expect(result.upperBound).toBe(upper)
    expect(result.filingReady).toBe(false)
  })
  test('rejects values outside IRS table range', () => {
    expect(() => reconstruct2025TaxTableBand(-1, 'single')).toThrow(RangeError)
    expect(() => reconstruct2025TaxTableBand(100000, 'single')).toThrow(RangeError)
    expect(() => reconstruct2025TaxTableBand(Infinity, 'single')).toThrow(RangeError)
  })
  test('rejects invalid filing status', () => {
    expect(() => reconstruct2025TaxTableBand(1000, 'bogus' as unknown as Parameters<typeof reconstruct2025TaxTableBand>[1])).toThrow(RangeError)
  })
})
