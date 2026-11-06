import { reviewIntegrated2025Form1040 } from './form1040IntegratedReview2025'
import { review2025Form1040Balance } from './form1040BalanceReview2025'
import { RestrictedDraft2025 } from './form1040Draft2025'
import { RestrictedSchedule1ABridge2025 } from './form1040Schedule1ABridge2025'
import { Form1040Schedule8812Bridge2025 } from './form1040Schedule8812Bridge2025'
const draft: RestrictedDraft2025 = {
  year: 2025, filingReady: false,
  lines: { '1a': 50000, '2b': 0, '8': 0, '9': 50000, '10': 0, '11a': 50000,
    '12e': 15750, '15': 34250, '25a': 3000, '25b': 0, '25d': 3000 },
  line16: { kind: 'blocked', reason: 'not verified', filingReady: false }, excluded: [],
}
const a: RestrictedSchedule1ABridge2025 = {
  year: 2025, filingReady: false, form1040Line13b: null, provisionalSchedule1ATotal: 1000,
  draftLine15Unchanged: 34250, provisionalLine15IfAllowed: 33250, eligibleToPost: false, blockers: [],
}
const credit: Form1040Schedule8812Bridge2025 = {
  year: 2025, filingReady: false, form1040Line19: null, form1040Line28: null,
  nonrefundableCandidate: 500, refundableCandidate: 200, combinedCandidate: 700,
  childTaxCreditBeforePhaseout: 2200, otherDependentCreditBeforePhaseout: 0,
  phaseoutReduction: 0, availableTaxBeforeCredits: 999, unresolved: [], readyForPosting: false,
}
const base = { draft, filingStatus: 'single' as const, schedule1A: a, schedule8812: credit,
  ordinaryIncomeMethodConfirmed: true, specialTaxWorksheetNotRequiredConfirmed: true }
test('cross-checks provisional line 16 and refuses mismatched credit tax baseline', () => {
  const result = reviewIntegrated2025Form1040(base)
  expect(result.provisionalTaxableIncome).toBe(33250)
  expect(result.provisionalLine16?.kind).not.toBe('blocked')
  expect(result.candidateNonrefundableCredit).toBeNull()
  expect(result.blockers.join(' ')).toContain('baseline differs')
  expect(Object.values(result.officialLines).every(v => v === null)).toBe(true)
})
test('missing evidence is blocked, never treated as zero deduction', () => {
  const result = reviewIntegrated2025Form1040({ ...base, schedule1A: null, schedule8812: null })
  expect(result.provisionalTaxableIncome).toBeNull()
  expect(result.blockers.join(' ')).toContain('missing')
})
test('rejects inconsistent Schedule 1-A arithmetic', () => {
  const result = reviewIntegrated2025Form1040({ ...base, schedule1A: { ...a, provisionalLine15IfAllowed: 33300 } })
  expect(result.provisionalLine16).toBeNull()
  expect(result.blockers.join(' ')).toContain('do not reconcile')
})
test('rejects unsafe filing status from an upstream bridge', () => {
  expect(() => reviewIntegrated2025Form1040({ ...base, schedule8812: { ...credit, readyForPosting: true } as Form1040Schedule8812Bridge2025 })).toThrow()
})

// Invalid imported money must fail closed rather than reach a provisional calculation.
test('rejects non-finite and negative Form 1040 money inputs', () => {
  expect(() => reviewIntegrated2025Form1040({
    ...base, draft: { ...draft, lines: { ...draft.lines, '15': Number.NaN } },
  })).toThrow(RangeError)
  expect(() => reviewIntegrated2025Form1040({
    ...base, draft: { ...draft, lines: { ...draft.lines, '25d': -1 } },
  })).toThrow(RangeError)
})

test('rejects unsafe bridge credit candidates without authorizing filing', () => {
  expect(() => reviewIntegrated2025Form1040({
    ...base, schedule8812: { ...credit, nonrefundableCandidate: Number.POSITIVE_INFINITY },
  })).toThrow(RangeError)
  expect(() => reviewIntegrated2025Form1040({
    ...base, schedule8812: { ...credit, refundableCandidate: -5 },
  })).toThrow(RangeError)
})

// Stage 110: cross-module consistency from draft through the restricted balance.
test('Stage 110: reconciled credits propagate to the balance without authorizing posting', () => {
  const preliminary = reviewIntegrated2025Form1040({ ...base, schedule8812: null })
  expect(preliminary.provisionalLine16?.kind).not.toBe('blocked')
  const tax = preliminary.provisionalLine16
  if (!tax || tax.kind === 'blocked') throw new Error('Expected a diagnostic line 16 candidate')
  const matchedCredit = { ...credit, availableTaxBeforeCredits: tax.tax }
  const integrated = reviewIntegrated2025Form1040({ ...base, schedule8812: matchedCredit })
  expect(integrated.candidateNonrefundableCredit).toBe(500)
  expect(integrated.candidateRefundableCredit).toBe(200)
  const balance = review2025Form1040Balance({
    integrated, otherNonrefundableCredits: 100, otherTaxes: 50, otherPayments: 500,
    creditOrderingConfirmed: true, otherTaxesReviewed: true, paymentsAndWithholdingReviewed: true,
  })
  expect(balance.candidates.line16Tax).toBe(tax.tax)
  expect(balance.candidates.line24TotalTax).toBe(tax.tax - 500 - 100 + 50)
  expect(balance.candidates.line33TotalPayments).toBe(3700)
  expect((balance.candidates.line34Overpayment ?? 0) * (balance.candidates.line37AmountOwed ?? 0)).toBe(0)
  expect(balance.filingReady).toBe(false)
  expect(balance.postingAuthorized).toBe(false)
  expect(Object.values(balance.officialLines).every(v => v === null)).toBe(true)
})

test('Stage 110: stale Schedule 8812 baseline suppresses both credit candidates downstream', () => {
  const preliminary = reviewIntegrated2025Form1040({ ...base, schedule8812: null })
  const tax = preliminary.provisionalLine16
  if (!tax || tax.kind === 'blocked') throw new Error('Expected a diagnostic line 16 candidate')
  const integrated = reviewIntegrated2025Form1040({
    ...base, schedule8812: { ...credit, availableTaxBeforeCredits: tax.tax + 1 },
  })
  expect(integrated.candidateNonrefundableCredit).toBeNull()
  expect(integrated.candidateRefundableCredit).toBeNull()
  const balance = review2025Form1040Balance({
    integrated, otherNonrefundableCredits: 0, otherTaxes: 0, otherPayments: 0,
    creditOrderingConfirmed: true, otherTaxesReviewed: true, paymentsAndWithholdingReviewed: true,
  })
  expect(balance.candidates.line24TotalTax).toBeNull()
  expect(balance.candidates.line33TotalPayments).toBeNull()
  expect(balance.candidates.line34Overpayment).toBeNull()
  expect(balance.candidates.line37AmountOwed).toBeNull()
  expect(balance.postingAuthorized).toBe(false)
})

test('Stage 110: missing Schedule 1-A never becomes a zero deduction or computed balance', () => {
  const integrated = reviewIntegrated2025Form1040({ ...base, schedule1A: null })
  expect(integrated.provisionalTaxableIncome).toBeNull()
  expect(integrated.provisionalLine16).toBeNull()
  const balance = review2025Form1040Balance({
    integrated, otherNonrefundableCredits: 0, otherTaxes: 0, otherPayments: 0,
    creditOrderingConfirmed: true, otherTaxesReviewed: true, paymentsAndWithholdingReviewed: true,
  })
  expect(balance.candidates.line16Tax).toBeNull()
  expect(balance.candidates.line24TotalTax).toBeNull()
  expect(balance.candidates.line34Overpayment).toBeNull()
  expect(balance.candidates.line37AmountOwed).toBeNull()
  expect(Object.values(balance.officialLines).every(v => v === null)).toBe(true)
})

// Stage 111: cross-module money, evidence, and authorization boundary regressions.
test('Stage 111: withholding and payments reconcile exactly at the refund/amount-due boundary', () => {
  const preliminary = reviewIntegrated2025Form1040({ ...base, schedule8812: null })
  const tax = preliminary.provisionalLine16
  if (!tax || tax.kind === 'blocked') throw new Error('Expected diagnostic line 16')
  const integrated = reviewIntegrated2025Form1040({
    ...base, schedule8812: { ...credit, availableTaxBeforeCredits: tax.tax },
  })
  const otherTaxes = 5000
  const otherPayments = tax.tax + otherTaxes - 500 - 3200
  const common = {
    integrated, otherNonrefundableCredits: 0, otherTaxes,
    creditOrderingConfirmed: true, otherTaxesReviewed: true, paymentsAndWithholdingReviewed: true,
  }
  const equalBalance = review2025Form1040Balance({ ...common, otherPayments })
  expect(equalBalance.candidates.line24TotalTax).toBe(equalBalance.candidates.line33TotalPayments)
  expect(equalBalance.candidates.line34Overpayment).toBe(0)
  expect(equalBalance.candidates.line37AmountOwed).toBe(0)
  const overpaid = review2025Form1040Balance({ ...common, otherPayments: otherPayments + 1 })
  expect(overpaid.candidates.line34Overpayment).toBe(1)
  expect(overpaid.candidates.line37AmountOwed).toBe(0)
  const owed = review2025Form1040Balance({ ...common, otherPayments: otherPayments - 1 })
  expect(owed.candidates.line34Overpayment).toBe(0)
  expect(owed.candidates.line37AmountOwed).toBe(1)
  for (const result of [equalBalance, overpaid, owed]) {
    expect(result.filingReady).toBe(false)
    expect(result.postingAuthorized).toBe(false)
    expect(Object.values(result.officialLines).every(v => v === null)).toBe(true)
  }
})

test('Stage 111: excess nonrefundable credits cannot produce negative tax or a fabricated refund', () => {
  const preliminary = reviewIntegrated2025Form1040({ ...base, schedule8812: null })
  const tax = preliminary.provisionalLine16
  if (!tax || tax.kind === 'blocked') throw new Error('Expected diagnostic line 16')
  const integrated = reviewIntegrated2025Form1040({
    ...base, schedule8812: { ...credit, availableTaxBeforeCredits: tax.tax },
  })
  const balance = review2025Form1040Balance({
    integrated, otherNonrefundableCredits: tax.tax, otherTaxes: 0, otherPayments: 0,
    creditOrderingConfirmed: true, otherTaxesReviewed: true, paymentsAndWithholdingReviewed: true,
  })
  expect(balance.candidates.line22TaxAfterCredits).toBeNull()
  expect(balance.candidates.line24TotalTax).toBeNull()
  expect(balance.candidates.line34Overpayment).toBeNull()
  expect(balance.candidates.line37AmountOwed).toBeNull()
  expect(balance.blockers.join(' ')).toContain('credit ordering requires recalculation')
  expect(balance.postingAuthorized).toBe(false)
})

test('Stage 111: unreviewed payment evidence never silently becomes a zero payment', () => {
  const preliminary = reviewIntegrated2025Form1040({ ...base, schedule8812: null })
  const tax = preliminary.provisionalLine16
  if (!tax || tax.kind === 'blocked') throw new Error('Expected diagnostic line 16')
  const integrated = reviewIntegrated2025Form1040({
    ...base, schedule8812: { ...credit, availableTaxBeforeCredits: tax.tax },
  })
  const balance = review2025Form1040Balance({
    integrated, otherNonrefundableCredits: 0, otherTaxes: 0, otherPayments: null,
    creditOrderingConfirmed: true, otherTaxesReviewed: true, paymentsAndWithholdingReviewed: false,
  })
  expect(balance.candidates.line33TotalPayments).toBeNull()
  expect(balance.candidates.line34Overpayment).toBeNull()
  expect(balance.candidates.line37AmountOwed).toBeNull()
  expect(balance.blockers.join(' ')).toContain('Other payments have not been reviewed')
  expect(balance.blockers.join(' ')).toContain('Withholding and payments are not confirmed')
  expect(balance.filingReady).toBe(false)
  expect(balance.postingAuthorized).toBe(false)
})
