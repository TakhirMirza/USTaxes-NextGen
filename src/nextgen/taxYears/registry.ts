export type TaxYearStatus =
  | 'legacy'
  | 'reference'
  | 'development'
  | 'ready'

export interface TaxYearDefinition {
  year: number
  status: TaxYearStatus
  federal1040Ready: boolean
  pdfReady: boolean
  regressionTestsPassed: boolean
}

export const NEXTGEN_TAX_YEARS: Record<number, TaxYearDefinition> = {
  2025: {
    year: 2025,
    status: 'development',
    federal1040Ready: false,
    pdfReady: false,
    regressionTestsPassed: false,
  },
  2026: {
    year: 2026,
    status: 'development',
    federal1040Ready: false,
    pdfReady: false,
    regressionTestsPassed: false,
  },
  2027: {
    year: 2027,
    status: 'development',
    federal1040Ready: false,
    pdfReady: false,
    regressionTestsPassed: false,
  },
  2028: {
    year: 2028,
    status: 'development',
    federal1040Ready: false,
    pdfReady: false,
    regressionTestsPassed: false,
  },
}

export function isTaxYearReady(year: number): boolean {
  const config = NEXTGEN_TAX_YEARS[year]

  return (
    config !== undefined &&
    config.status === 'ready' &&
    config.federal1040Ready &&
    config.pdfReady &&
    config.regressionTestsPassed
  )
}
