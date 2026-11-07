/** 2025 integrated federal 1040 arithmetic for reviewed source values only.
 * Does not determine tax eligibility, validate Schedule classifications or authorize filing.
 * All amounts are nonnegative integer cents. Missing values are never treated as zero.
 */
import { FederalScheduleIncomeResult2025 } from './federalScheduleIntegration2025'
import { Schedule1040Candidates2025 } from './schedules1040Bridge2025'

export interface FederalReturnBalanceInputs2025 {
  income: FederalScheduleIncomeResult2025
  schedules: Schedule1040Candidates2025
  line16TaxCents: number | null
  line19ChildCreditCents: number | null
  line25aWithholdingCents: number | null
  line25bWithholdingCents: number | null
  line25cWithholdingCents: number | null
  line26EstimatedPaymentsCents: number | null
  line27aEicCents: number | null
  line28AdditionalChildCreditCents: number | null
  line29EducationCreditCents: number | null
  independentTaxReview: boolean
  independentCreditReview: boolean
  independentPaymentReview: boolean
  scheduleLineRulesReviewed: boolean
}
export type FederalReturnBalanceResult2025 =
  | { status: 'blocked'; filingReady: false; blockers: string[]; lines: null }
  | { status: 'reconciled'; filingReady: false; blockers: []; lines: Record<string, number> }

const MAX = 100000000000000
const valid = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= MAX
const add = (...n: number[]): number | null => {
  const total = n.reduce((a, b) => a + b, 0)
  return valid(total) ? total : null
}

export function calculateFederalReturnBalance2025(input: FederalReturnBalanceInputs2025): FederalReturnBalanceResult2025 {
  const errors: string[] = []
  if (input.income.status !== 'reconciled' || !input.income.lines) errors.push('Schedule 1 income, AGI and deduction must reconcile first.')
  if (input.schedules.blocked || !input.scheduleLineRulesReviewed) errors.push('Schedules 1, 2 and 3 require line-specific eligibility and classification review.')
  if (!input.independentTaxReview) errors.push('Form 1040 line 16 tax method and amount must be independently reviewed.')
  if (!input.independentCreditReview) errors.push('All credit eligibility and amounts must be independently reviewed, including explicit zero confirmations.')
  if (!input.independentPaymentReview) errors.push('All withholding and payment amounts must be independently reviewed, including explicit zero confirmations.')
  const required: Record<string, number | null> = {
    line16: input.line16TaxCents, line17: input.schedules.line17, line19: input.line19ChildCreditCents,
    line20: input.schedules.line20, line23: input.schedules.line23,
    line25a: input.line25aWithholdingCents, line25b: input.line25bWithholdingCents,
    line25c: input.line25cWithholdingCents, line26: input.line26EstimatedPaymentsCents,
    line27a: input.line27aEicCents, line28: input.line28AdditionalChildCreditCents,
    line29: input.line29EducationCreditCents, line31: input.schedules.line31
  }
  Object.entries(required).forEach(([line, value]) => { if (!valid(value)) errors.push(`Form 1040 ${line}: verified nonnegative integer cents required.`) })
  if (input.income.lines && (input.income.lines['8'] !== input.schedules.line8 || input.income.lines['10'] !== input.schedules.line10)) {
    errors.push('Schedule 1 totals do not match reconciled income values.')
  }
  if (errors.length) return { status: 'blocked', filingReady: false, blockers: errors, lines: null }
  const v = required as Record<string, number>
  const l18 = add(v.line16, v.line17)
  const l21 = add(v.line19, v.line20)
  const l25d = add(v.line25a, v.line25b, v.line25c)
  const l32 = add(v.line27a, v.line28, v.line29, v.line31)
  if (l18 === null || l21 === null || l25d === null || l32 === null) return { status: 'blocked', filingReady: false, blockers: ['Arithmetic overflow in Form 1040 subtotals.'], lines: null }
  const l22 = Math.max(0, l18 - l21)
  const l24 = add(l22, v.line23)
  const l33 = add(l25d, v.line26, l32)
  if (l24 === null || l33 === null) return { status: 'blocked', filingReady: false, blockers: ['Arithmetic overflow in tax or payment totals.'], lines: null }
  return { status: 'reconciled', filingReady: false, blockers: [], lines: {
    ...input.income.lines!, '16': v.line16, '17': v.line17, '18': l18, '19': v.line19,
    '20': v.line20, '21': l21, '22': l22, '23': v.line23, '24': l24,
    '25a': v.line25a, '25b': v.line25b, '25c': v.line25c, '25d': l25d,
    '26': v.line26, '27a': v.line27a, '28': v.line28, '29': v.line29,
    '31': v.line31, '32': l32, '33': l33, '34': Math.max(0, l33 - l24),
    '37': Math.max(0, l24 - l33)
  } }
}
