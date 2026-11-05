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
