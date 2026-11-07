import { review2025Form1040Balance } from './form1040BalanceReview2025'
import { IntegratedReview2025 } from './form1040IntegratedReview2025'
const review: IntegratedReview2025 = {
  year: 2025, filingReady: false, postingAuthorized: false,
  officialLines: { '13b': null, '19': null, '28': null, '34': null, '37': null },
  unchangedDraftTaxableIncome: 40000, provisionalTaxableIncome: 39000,
  provisionalLine16: { kind: 'unverified-import-candidate', tax: 4000, filingReady: false },
  candidateNonrefundableCredit: 500, candidateRefundableCredit: 200,
  withholdingForReviewOnly: 3000, blockers: ['Upstream verification pending'],
}
const base = { integrated: review, otherNonrefundableCredits: 100, otherTaxes: 50,
  otherPayments: 500, creditOrderingConfirmed: true, otherTaxesReviewed: true,
  paymentsAndWithholdingReviewed: true }
test('reconciles total tax and payments without posting official lines', () => {
  const r = review2025Form1040Balance(base)
  expect(r.candidates.line22TaxAfterCredits).toBe(3400)
  expect(r.candidates.line24TotalTax).toBe(3450)
  expect(r.candidates.line33TotalPayments).toBe(3700)
  expect(r.candidates.line34Overpayment).toBe(250)
  expect(r.candidates.line37AmountOwed).toBe(0)
  expect(r.postingAuthorized).toBe(false)
  expect(Object.values(r.officialLines).every(x => x === null)).toBe(true)
})
test('amount owed is mutually exclusive with overpayment', () => {
  const r = review2025Form1040Balance({ ...base, otherPayments: 0, integrated: { ...review, withholdingForReviewOnly: 1000 } })
  expect(r.candidates.line34Overpayment).toBe(0)
  expect(r.candidates.line37AmountOwed).toBe(2250)
})
test('missing payments are not assumed zero', () => {
  const r = review2025Form1040Balance({ ...base, otherPayments: null })
  expect(r.candidates.line33TotalPayments).toBeNull()
  expect(r.candidates.line34Overpayment).toBeNull()
  expect(r.blockers.join(' ')).toContain('not been reviewed')
})
test('excessive nonrefundable credit fails closed', () => {
  const r = review2025Form1040Balance({ ...base, integrated: { ...review, candidateNonrefundableCredit: 5000 } })
  expect(r.candidates.line22TaxAfterCredits).toBeNull()
  expect(r.blockers.join(' ')).toContain('exceeds tax')
})
test('rejects invalid amounts and unsafe upstream posting', () => {
  expect(() => review2025Form1040Balance({ ...base, otherTaxes: -1 })).toThrow()
  expect(() => review2025Form1040Balance({ ...base, integrated: { ...review, postingAuthorized: true } as IntegratedReview2025 })).toThrow()
})

// Stage 112: money reconciliation edge cases across the diagnostic Form 1040 lines.
test('Stage 112: fractional cents reconcile exactly without floating-point residue', () => {
  const r = review2025Form1040Balance({
    ...base,
    integrated: {
      ...review,
      provisionalLine16: { kind: 'unverified-import-candidate', tax: 1234.56, filingReady: false },
      candidateNonrefundableCredit: 123.45,
      candidateRefundableCredit: 20.01,
      withholdingForReviewOnly: 1000.03,
    },
    otherNonrefundableCredits: 11.11,
    otherTaxes: 2.22,
    otherPayments: 100.04,
  })
  expect(r.candidates.line22TaxAfterCredits).toBe(1100)
  expect(r.candidates.line24TotalTax).toBe(1102.22)
  expect(r.candidates.line33TotalPayments).toBe(1120.08)
  expect(r.candidates.line34Overpayment).toBe(17.86)
  expect(r.candidates.line37AmountOwed).toBe(0)
  expect(r.filingReady).toBe(false)
  expect(r.postingAuthorized).toBe(false)
})

test('Stage 112: exact payment/tax equality produces neither refund nor amount owed', () => {
  const r = review2025Form1040Balance({
    ...base,
    integrated: { ...review, withholdingForReviewOnly: 2750 },
    otherPayments: 500,
    otherTaxes: 50,
  })
  // 4000 - 500 - 100 + 50 = 3450; 2750 + 200 + 500 = 3450.
  expect(r.candidates.line24TotalTax).toBe(3450)
  expect(r.candidates.line33TotalPayments).toBe(3450)
  expect(r.candidates.line34Overpayment).toBe(0)
  expect(r.candidates.line37AmountOwed).toBe(0)
  expect(Object.values(r.officialLines).every(value => value === null)).toBe(true)
})

test('Stage 112: missing refundable credit blocks payments and final balance', () => {
  const r = review2025Form1040Balance({
    ...base,
    integrated: { ...review, candidateRefundableCredit: null },
  })
  expect(r.candidates.line28AdditionalChildTaxCredit).toBeNull()
  expect(r.candidates.line33TotalPayments).toBeNull()
  expect(r.candidates.line34Overpayment).toBeNull()
  expect(r.candidates.line37AmountOwed).toBeNull()
  expect(r.blockers.join(' ')).toContain('incomplete')
})

test('Stage 112: missing line 16 candidate prevents total tax and final balance', () => {
  const r = review2025Form1040Balance({
    ...base,
    integrated: { ...review, provisionalLine16: null },
  })
  expect(r.candidates.line16Tax).toBeNull()
  expect(r.candidates.line22TaxAfterCredits).toBeNull()
  expect(r.candidates.line24TotalTax).toBeNull()
  expect(r.candidates.line34Overpayment).toBeNull()
  expect(r.candidates.line37AmountOwed).toBeNull()
})

test('Stage 112: rejects non-finite, negative, over-precision, and excessive money inputs', () => {
  for (const amount of [Number.NaN, Infinity, -0.01, 0.001, 1e12 + 1]) {
    expect(() => review2025Form1040Balance({ ...base, otherPayments: amount })).toThrow(RangeError)
  }
  expect(() => review2025Form1040Balance({
    ...base,
    integrated: { ...review, withholdingForReviewOnly: Infinity },
  })).toThrow(RangeError)
})

// Stage 113: credit ordering, payment boundaries and fail-closed reconciliation.
test('Stage 113: child credit exactly consumes remaining tax without making tax negative', () => {
  const r = review2025Form1040Balance({
    ...base,
    integrated: { ...review, candidateNonrefundableCredit: 3900 },
    otherNonrefundableCredits: 100,
    otherTaxes: 0,
    otherPayments: 0,
  })
  expect(r.candidates.line22TaxAfterCredits).toBe(0)
  expect(r.candidates.line24TotalTax).toBe(0)
  expect(r.candidates.line33TotalPayments).toBe(3200)
  expect(r.candidates.line34Overpayment).toBe(3200)
  expect(r.candidates.line37AmountOwed).toBe(0)
  expect(r.postingAuthorized).toBe(false)
})

test('Stage 113: other nonrefundable credits exceeding tax block downstream balance', () => {
  const r = review2025Form1040Balance({ ...base, otherNonrefundableCredits: 4000 })
  expect(r.candidates.line22TaxAfterCredits).toBeNull()
  expect(r.candidates.line24TotalTax).toBeNull()
  expect(r.candidates.line34Overpayment).toBeNull()
  expect(r.candidates.line37AmountOwed).toBeNull()
  expect(r.blockers.join(' ')).toContain('exceed')
})

test('Stage 113: missing other taxes blocks total tax but preserves reviewed payments', () => {
  const r = review2025Form1040Balance({ ...base, otherTaxes: null })
  expect(r.candidates.line22TaxAfterCredits).toBe(3400)
  expect(r.candidates.line23OtherTaxes).toBeNull()
  expect(r.candidates.line24TotalTax).toBeNull()
  expect(r.candidates.line33TotalPayments).toBe(3700)
  expect(r.candidates.line34Overpayment).toBeNull()
  expect(r.candidates.line37AmountOwed).toBeNull()
})

test('Stage 113: missing other credits blocks tax while payments stay independently reviewable', () => {
  const r = review2025Form1040Balance({ ...base, otherNonrefundableCredits: null })
  expect(r.candidates.line20OtherNonrefundableCredits).toBeNull()
  expect(r.candidates.line22TaxAfterCredits).toBeNull()
  expect(r.candidates.line24TotalTax).toBeNull()
  expect(r.candidates.line33TotalPayments).toBe(3700)
  expect(r.candidates.line34Overpayment).toBeNull()
  expect(r.candidates.line37AmountOwed).toBeNull()
})

test('Stage 113: unconfirmed review evidence never authorizes filing or posting', () => {
  const r = review2025Form1040Balance({
    ...base,
    creditOrderingConfirmed: false,
    otherTaxesReviewed: false,
    paymentsAndWithholdingReviewed: false,
  })
  expect(r.blockers.join(' ')).toContain('credit ordering is not confirmed')
  expect(r.blockers.join(' ')).toContain('other taxes are not confirmed')
  expect(r.blockers.join(' ')).toContain('payments are not confirmed')
  expect(r.filingReady).toBe(false)
  expect(r.postingAuthorized).toBe(false)
  expect(Object.values(r.officialLines).every(value => value === null)).toBe(true)
})

test('Stage 113: fractional withholding and refundable credit produce exact amount owed', () => {
  const r = review2025Form1040Balance({
    ...base,
    integrated: { ...review, withholdingForReviewOnly: 100.01, candidateRefundableCredit: 20.02 },
    otherPayments: 30.03,
  })
  expect(r.candidates.line24TotalTax).toBe(3450)
  expect(r.candidates.line33TotalPayments).toBe(150.06)
  expect(r.candidates.line34Overpayment).toBe(0)
  expect(r.candidates.line37AmountOwed).toBe(3299.94)
  expect(r.filingReady).toBe(false)
})
