import { decide2025Line16 } from './irsLine16Decision2025'
const confirmed = { ordinaryIncomeMethodApplicable: true, specialTaxWorksheetRequired: false }

describe('2025 IRS line 16 conservative decision routing', () => {
  test('unknown eligibility fails closed', () => {
    expect(decide2025Line16({ taxableIncome: 25300, status: 'marriedJoint' }).kind).toBe('blocked')
  })
  test('published IRS example only after eligibility confirmation', () => {
    const result = decide2025Line16({ taxableIncome: 25300, status: 'marriedJoint', ...confirmed })
    expect(result).toMatchObject({ kind: 'verified-reference-example', tax: 2562, filingReady: false })
  })
  test('published samples remain verified; adjacent imported rows remain unverified' , () => {
    expect(decide2025Line16({ taxableIncome: 25400, status: 'marriedJoint', ...confirmed }).kind).toBe('unverified-import-candidate')
    expect(decide2025Line16({ taxableIncome: 25300, status: 'single', ...confirmed })).toMatchObject({ kind: 'verified-reference-example', tax: 2801 })
  })
  test('100k boundary uses official ordinary-income worksheet', () => {
    expect(decide2025Line16({ taxableIncome: 100000, status: 'single', ...confirmed }))
      .toMatchObject({ kind: 'ordinary-worksheet', tax: 16914, filingReady: false })
  })
  test('special-worksheet flag blocks otherwise computable tax', () => {
    expect(decide2025Line16({ taxableIncome: 150000, status: 'single', ...confirmed, specialTaxWorksheetRequired: true }).kind)
      .toBe('blocked')
  })
  test('invalid amounts fail closed', () => {
    expect(decide2025Line16({ taxableIncome: NaN, status: 'single', ...confirmed }).kind).toBe('blocked')
    expect(decide2025Line16({ taxableIncome: -1, status: 'single', ...confirmed }).kind).toBe('blocked')
  })
})
