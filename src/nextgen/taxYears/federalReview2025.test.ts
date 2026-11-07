import { reviewFederalReturn2025 } from './federalReview2025'
import { map2025SourcesTo1040, TaxEngineInput2025 } from './taxEngineCore2025'

const input: TaxEngineInput2025 = {
  year: 2025, filingStatus: 'single',
  w2: [{ id: '1', employer: 'Fictional employer', box1: '75000.00', box2: '9000.00' }], interest: [],
  standardDeductionFactsConfirmed: true, taxpayerUnder65AndNotBlind: true,
  spouseUnder65AndNotBlind: true, notClaimableAsDependent: true,
  noOtherIncomeAdjustmentsCreditsOrTaxes: true
}

describe('2025 federal preparation coverage review', () => {
  it('separates limited valid mapping from filing readiness', () => {
    const review = reviewFederalReturn2025(map2025SourcesTo1040(input))
    expect(review.mappingValid).toBe(true)
    expect(review.summary.passed).toBe(3)
    expect(review.summary.notImplemented).toBe(5)
    expect(review.filingReady).toBe(false)
    expect(review.canExportFilingForm).toBe(false)
    expect(review.canEfile).toBe(false)
  })
  it('blocks all source dependent gates when source data is incomplete', () => {
    const review = reviewFederalReturn2025(map2025SourcesTo1040({ ...input, w2: [{ ...input.w2[0], employer: '' }] }))
    expect(review.mappingValid).toBe(false)
    expect(review.summary.blocked).toBe(3)
    expect(review.items[0].detail).toContain('employer')
  })
  it('never upgrades a non-2025 year to filing ready', () => {
    const review = reviewFederalReturn2025(map2025SourcesTo1040({ ...input, year: 2026 }))
    expect(review.summary.blocked).toBeGreaterThan(0)
    expect(review.filingReady).toBe(false)
  })
  it('provides distinct line references for tax, credits and payments', () => {
    const review = reviewFederalReturn2025(map2025SourcesTo1040(input))
    expect(review.items.find(i => i.id === 'tax')?.relatedLines).toEqual(['16'])
    expect(review.items.find(i => i.id === 'payments')?.relatedLines).toContain('34')
    expect(review.items.find(i => i.id === 'credits')?.status).toBe('not-implemented')
  })
})
