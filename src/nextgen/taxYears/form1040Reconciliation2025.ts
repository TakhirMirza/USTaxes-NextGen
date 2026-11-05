/**
 * 2025 Form 1040 arithmetic reconciliation, NOT an eligibility or filing engine.
 * Source: https://www.irs.gov/pub/irs-pdf/f1040.pdf
 * Every required amount must be explicitly provided; absent is NOT zero.
 * The caller must independently establish each underlying tax/credit amount.
 */
export interface Form1040ReconciliationInputs2025 {
  line16Tax?: number
  line17Schedule2Tax?: number
  line19ChildOtherDependentCredit?: number
  line20Schedule3NonrefundableCredits?: number
  line23OtherTaxes?: number
  /** Optional source breakdown: if supplied, all three amounts are required. */
  line25aW2Withholding?: number
  line25b1099Withholding?: number
  line25cOtherWithholding?: number
  line25dWithholding?: number
  line26EstimatedPayments?: number
  line27aEarnedIncomeCredit?: number
  line28AdditionalChildTaxCredit?: number
  line29AmericanOpportunityCredit?: number
  /** 2025 Form 1040 line 30: refundable adoption credit from Form 8839 line 13. */
  line30RefundableAdoptionCredit?: number
  line31Schedule3RefundableCredits?: number
  /** Explicit taxpayer election; absent does not mean refund all. */
  line35aRefundRequested?: number
  /** Explicit amount elected for 2026 estimated tax. */
  line36AppliedTo2026?: number
}

export interface Form1040Reconciliation2025 {
  year: 2025
  filingReady: false
  completeArithmetic: boolean
  missingInputs: string[]
  lines: {
    '18': number | null; '21': number | null; '22': number | null
    '24': number | null; '25d': number | null; '30': number | null; '32': number | null; '33': number | null
    '34': number | null; '35a': number | null; '36': number | null; '37': number | null
  }
  warnings: string[]
}

const required: ReadonlyArray<keyof Form1040ReconciliationInputs2025> = [
  'line16Tax', 'line17Schedule2Tax', 'line19ChildOtherDependentCredit',
  'line20Schedule3NonrefundableCredits', 'line23OtherTaxes',
  'line25dWithholding', 'line26EstimatedPayments', 'line27aEarnedIncomeCredit',
  'line28AdditionalChildTaxCredit', 'line29AmericanOpportunityCredit',
  'line30RefundableAdoptionCredit',
  'line31Schedule3RefundableCredits',
]

const add = (...values: number[]) => Math.round(values.reduce((a, b) => a + Math.round(b * 100), 0)) / 100

export function reconcile2025Form1040Arithmetic(input: Form1040ReconciliationInputs2025): Form1040Reconciliation2025 {
  const missingInputs = required.filter(key => input[key] === undefined)
  const withholdingKeys = ['line25aW2Withholding', 'line25b1099Withholding', 'line25cOtherWithholding'] as const
  const breakdownCount = withholdingKeys.filter(key => input[key] !== undefined).length
  if (breakdownCount > 0 && breakdownCount < withholdingKeys.length) {
    throw new RangeError('Withholding breakdown must include lines 25a, 25b and 25c')
  }
  for (const key of [...required, ...withholdingKeys]) {
    const value = input[key]
    if (value === undefined) continue
    if (!Number.isFinite(value) || value < 0 || value > 1e10 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
      throw new RangeError(`${key} must be a finite nonnegative dollar amount with at most two decimal places`)
    }
  }
  for (const key of ['line35aRefundRequested', 'line36AppliedTo2026'] as const) {
    const value = input[key]
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1e10 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)) {
      throw new RangeError(`${key} must be a finite nonnegative dollar amount with at most two decimal places`)
    }
  }
  const empty: Form1040Reconciliation2025['lines'] = {
    '18': null, '21': null, '22': null, '24': null,
    '25d': null, '30': null, '32': null, '33': null, '34': null, '35a': null, '36': null, '37': null,
  }
  if (missingInputs.length) return {
    year: 2025, filingReady: false, completeArithmetic: false, missingInputs,
    lines: empty,
    warnings: ['Missing amounts cannot be assumed zero; no refund or balance due is calculated.',
      'All input amounts require independent eligibility and IRS worksheet verification.'],
  }
  if (breakdownCount === withholdingKeys.length &&
      add(input.line25aW2Withholding!, input.line25b1099Withholding!, input.line25cOtherWithholding!) !== input.line25dWithholding) {
    throw new RangeError('Form 1040 line 25d must equal lines 25a + 25b + 25c')
  }
  const v = input as Required<Form1040ReconciliationInputs2025>
  const line18 = add(v.line16Tax, v.line17Schedule2Tax)
  const line21 = add(v.line19ChildOtherDependentCredit, v.line20Schedule3NonrefundableCredits)
  const line22 = Math.max(0, add(line18, -line21))
  const line24 = add(line22, v.line23OtherTaxes)
  const line32 = add(v.line27aEarnedIncomeCredit, v.line28AdditionalChildTaxCredit,
    v.line29AmericanOpportunityCredit, v.line30RefundableAdoptionCredit,
    v.line31Schedule3RefundableCredits)
  const line33 = add(v.line25dWithholding, v.line26EstimatedPayments, line32)
  const overpayment = Math.max(0, add(line33, -line24))
  const amountOwed = Math.max(0, add(line24, -line33))
  const refund = input.line35aRefundRequested
  const carryForward = input.line36AppliedTo2026
  if (refund !== undefined && refund > overpayment) {
    throw new RangeError('Requested refund cannot exceed line 34 overpayment')
  }
  if (carryForward !== undefined && carryForward > overpayment) {
    throw new RangeError('2026 estimated tax election cannot exceed line 34 overpayment')
  }
  if (refund !== undefined && carryForward !== undefined &&
      add(refund, carryForward) !== overpayment) {
    throw new RangeError('Line 35a plus line 36 must equal line 34 overpayment')
  }
  return {
    year: 2025, filingReady: false, completeArithmetic: true, missingInputs: [],
    lines: { '18': line18, '21': line21, '22': line22, '24': line24,
      '25d': v.line25dWithholding, '30': v.line30RefundableAdoptionCredit,
      '32': line32, '33': line33, '34': overpayment, '35a': refund === undefined ? null : refund,
      '36': carryForward === undefined ? null : carryForward, '37': amountOwed },
    warnings: [
      'Arithmetic only: credits, taxes, withholding and payments have not been independently verified.',
      'Line 35a and line 36 require explicit taxpayer elections; no election is inferred.',
      'This module does not support filing or authorize copying values to an IRS return.',
    ],
  }
}
