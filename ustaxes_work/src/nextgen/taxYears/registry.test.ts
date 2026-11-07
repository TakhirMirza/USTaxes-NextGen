import { NEXTGEN_TAX_YEARS, isTaxYearReady } from './registry'

describe('NextGen Tax Year Registry', () => {
  test('contains tax years 2025 through 2028', () => {
    expect(Object.keys(NEXTGEN_TAX_YEARS).map(Number)).toEqual([
      2025, 2026, 2027, 2028
    ])
  })

  test.each([2025, 2026, 2027, 2028])(
    'does not enable unfinished tax year %i',
    (year) => {
      expect(isTaxYearReady(year)).toBe(false)
    }
  )

  test('rejects an unknown tax year', () => {
    expect(isTaxYearReady(2035)).toBe(false)
  })

  test('requires all readiness checks', () => {
    const config = NEXTGEN_TAX_YEARS[2025]
    const original = { ...config }

    try {
      config.status = 'ready'
      config.federal1040Ready = true
      config.pdfReady = true
      config.regressionTestsPassed = false

      expect(isTaxYearReady(2025)).toBe(false)

      config.regressionTestsPassed = true
      expect(isTaxYearReady(2025)).toBe(true)
    } finally {
      Object.assign(config, original)
    }
  })
})
