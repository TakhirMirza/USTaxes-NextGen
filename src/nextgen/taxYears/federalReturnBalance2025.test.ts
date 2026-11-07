import { calculateFederalReturnBalance2025, FederalReturnBalanceInputs2025 } from './federalReturnBalance2025'
const base: FederalReturnBalanceInputs2025 = {
  income: { status: 'reconciled', filingReady: false, blockers: [], lines: { '8': 10000, '10': 2000, '15': 6000000 }, provenance: {} },
  schedules: { line8: 10000, line10: 2000, line17: 5000, line20: 12000, line23: 3000, line31: 4000, blocked: false, entryCount: 6 },
  line16TaxCents: 900000, line19ChildCreditCents: 30000, line25aWithholdingCents: 500000,
  line25bWithholdingCents: 10000, line25cWithholdingCents: 0, line26EstimatedPaymentsCents: 100000,
  line27aEicCents: 0, line28AdditionalChildCreditCents: 0, line29EducationCreditCents: 0,
  independentTaxReview: true, independentCreditReview: true, independentPaymentReview: true, scheduleLineRulesReviewed: true
}
describe('2025 federal return complete arithmetic with independently reviewed components', () => {
  it('reconciles tax, credits, payments and amount owed', () => {
    const result = calculateFederalReturnBalance2025(base)
    expect(result.status).toBe('reconciled')
    expect(result.lines).toMatchObject({ '18': 905000, '21': 42000, '22': 863000, '24': 866000, '25d': 510000, '32': 4000, '33': 614000, '34': 0, '37': 252000 })
    expect(result.filingReady).toBe(false)
  })
  it('computes overpayment without negative owed amount', () => {
    const result = calculateFederalReturnBalance2025({ ...base, line25aWithholdingCents: 1000000 })
    expect(result.lines).toMatchObject({ '34': 248000, '37': 0 })
  })
  it('blocks missing values rather than defaulting to zero', () => {
    expect(calculateFederalReturnBalance2025({ ...base, line29EducationCreditCents: null }).status).toBe('blocked')
  })
  it('blocks unreviewed Schedule 2/3 entries', () => {
    expect(calculateFederalReturnBalance2025({ ...base, schedules: { ...base.schedules, blocked: true } }).status).toBe('blocked')
  })
  it('blocks inconsistent Schedule 1 values', () => {
    expect(calculateFederalReturnBalance2025({ ...base, schedules: { ...base.schedules, line8: 9000 } }).status).toBe('blocked')
  })
  it('blocks overflow and fractional cents', () => {
    expect(calculateFederalReturnBalance2025({ ...base, line16TaxCents: Number.MAX_SAFE_INTEGER }).status).toBe('blocked')
    expect(calculateFederalReturnBalance2025({ ...base, line16TaxCents: 2.5 }).status).toBe('blocked')
  })
  it('requires all independent review flags', () => {
    expect(calculateFederalReturnBalance2025({ ...base, independentPaymentReview: false }).status).toBe('blocked')
  })
})
