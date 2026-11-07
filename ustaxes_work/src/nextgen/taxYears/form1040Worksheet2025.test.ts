import { create2025Form1040Worksheet } from './form1040Worksheet2025'

describe('2025 educational Form 1040 line-inspired worksheet', () => {
  test('keeps W-2 wages and taxable interest separate', () => {
    const worksheet = create2025Form1040Worksheet(
      [{ id: 'w1', employer: 'Fictional', box1Wages: 60000, box2FederalWithholding: 6000 }],
      [{ id: 'i1', payer: 'Fictional', box1TaxableInterest: 250, federalWithholding: 25 }],
      'single'
    )
    expect(worksheet.line1aW2Wages).toBe(60000)
    expect(worksheet.line2bTaxableInterest).toBe(250)
    expect(worksheet.line9IllustrativeTotalIncome).toBe(60250)
    expect(worksheet.line25aW2Withholding).toBe(6000)
    expect(worksheet.line25b1099InterestWithholding).toBe(25)
    expect(worksheet.line25dIllustrativeTotalWithholding).toBe(6025)
    expect(worksheet.filingReady).toBe(false)
  })
  test('empty sources remain nonfilable and have zero bracket tax', () => {
    const worksheet = create2025Form1040Worksheet([], [], 'single')
    expect(worksheet.line15IllustrativeTaxableIncome).toBe(0)
    expect(worksheet.line16IllustrativeBracketTax).toBe(0)
    expect(worksheet.filingReady).toBe(false)
  })
  test('invalid amounts are rejected by income validation', () => {
    expect(() => create2025Form1040Worksheet(
      [{ id: 'x', employer: '', box1Wages: -1, box2FederalWithholding: 0 }], [], 'single'
    )).toThrow(RangeError)
  })
})
