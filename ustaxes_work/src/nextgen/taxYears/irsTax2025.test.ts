import { compute2025IrsOrdinaryTax } from './irsTax2025'

describe('2025 IRS tax computation worksheet (restricted scope)', () => {
  test('requires tax table for taxable income below $100,000', () => {
    expect(compute2025IrsOrdinaryTax(99999, 'single', { ordinaryIncomeOnlyConfirmed: true }).kind).toBe('requires-tax-table')
  })
  test('requires explicit confirmation before calculating', () => {
    expect(compute2025IrsOrdinaryTax(150000, 'single', { ordinaryIncomeOnlyConfirmed: false }).kind).toBe('requires-special-worksheet')
  })
  test.each([
    ['single', 100000, 16914],
    ['marriedJoint', 100000, 11828],
    ['marriedSeparate', 100000, 16914],
    ['headOfHousehold', 100000, 15175],
    ['qualifyingSurvivingSpouse', 100000, 11828],
    ['single', 150000, 28847],
    ['marriedJoint', 250000, 45694],
  ] as const)('%s at $%i taxable income', (status, taxableIncome, expected) => {
    const result = compute2025IrsOrdinaryTax(taxableIncome, status, { ordinaryIncomeOnlyConfirmed: true })
    expect(result.kind).toBe('computed')
    if (result.kind === 'computed') expect(result.tax).toBe(expected)
    expect(result.filingReady).toBe(false)
  })
  test('rejects invalid amounts', () => {
    expect(() => compute2025IrsOrdinaryTax(-1, 'single', { ordinaryIncomeOnlyConfirmed: true })).toThrow(RangeError)
  })
})
