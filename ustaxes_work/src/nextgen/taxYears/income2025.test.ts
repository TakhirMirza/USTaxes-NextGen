import { preview2025Income } from './income2025'

describe('2025 educational W-2 and 1099-INT aggregation', () => {
  test('sums separate wage, interest and withholding categories', () => {
    const result = preview2025Income(
      [{ id: 'w1', employer: 'Example', box1Wages: 60000, box2FederalWithholding: 6000 },
        { id: 'w2', employer: 'Example 2', box1Wages: 15000, box2FederalWithholding: 1500 }],
      [{ id: 'i1', payer: 'Example Bank', box1TaxableInterest: 500, federalWithholding: 50 }],
      'single'
    )
    expect(result.wages).toBe(75000)
    expect(result.taxableInterest).toBe(500)
    expect(result.totalOrdinaryIncome).toBe(75500)
    expect(result.federalWithholding).toBe(7550)
    expect(result.filingReady).toBe(false)
  })

  test('handles empty sources', () => {
    const result = preview2025Income([], [], 'single')
    expect(result.illustrativeBracketTax).toBe(0)
  })

  test('rejects negative and nonfinite input', () => {
    expect(() => preview2025Income([{ id: '1', employer: '', box1Wages: -1, box2FederalWithholding: 0 }], [], 'single')).toThrow()
    expect(() => preview2025Income([], [{ id: '1', payer: '', box1TaxableInterest: NaN, federalWithholding: 0 }], 'single')).toThrow()
  })
})
