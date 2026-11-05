import { attach2025Withholding, summarize2025Withholding } from './withholdingBridge2025'

describe('2025 source-document withholding bridge', () => {
  const w2s = [{ id: 'w1', employer: 'Example', box1Wages: 50000, box2FederalWithholding: 2000.12 }]
  const interests = [{ id: 'i1', payer: 'Bank', box1TaxableInterest: 150, federalWithholding: 100.23 }]
  it('maps W-2, 1099-INT, other 1099 and other withholding to 25a-d', () => {
    expect(summarize2025Withholding(w2s, interests, 30.11, 40.22)).toEqual({
      filingReady: false, line25aW2Withholding: 2000.12,
      line25b1099Withholding: 130.34, line25cOtherWithholding: 40.22,
      line25dWithholding: 2170.68,
    })
  })
  it('rejects invalid amounts, duplicate IDs and missing explicit other sources', () => {
    expect(() => summarize2025Withholding(w2s, interests, NaN, 0)).toThrow(RangeError)
    expect(() => summarize2025Withholding(w2s, interests, 0.001, 0)).toThrow(RangeError)
    expect(() => summarize2025Withholding([...w2s, ...w2s], interests, 0, 0)).toThrow(RangeError)
    expect(() => summarize2025Withholding(w2s, interests, undefined as any, 0)).toThrow(RangeError)
  })
  it('preserves unrelated reconciliation inputs', () => {
    const result = attach2025Withholding({ line16Tax: 4000 }, summarize2025Withholding(w2s, interests, 0, 0))
    expect(result.line16Tax).toBe(4000)
    expect(result.line25dWithholding).toBe(2100.35)
  })
  it('rejects conflicting previously supplied withholding', () => {
    const breakdown = summarize2025Withholding(w2s, interests, 0, 0)
    expect(() => attach2025Withholding({ line25dWithholding: 1 }, breakdown)).toThrow(RangeError)
  })
})
