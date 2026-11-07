/** 2025 Form 1040 arithmetic and provenance gate (NOT a tax calculation).
 * Values are integer cents. This module cannot determine line 16 or certify filing.
 * Line relationships follow the 2025 Form 1040; see https://www.irs.gov/pub/irs-pdf/f1040.pdf
 */
import { Form1040Mapping2025 } from './taxEngineCore2025'

export interface VerifiedTaxComponents2025 {
  /** External, independently reviewed IRS line 16 amount. Never inferred from a bracket. */
  line16TaxCents: number
  line17Schedule2Part1Cents: number
  line19ChildTaxCreditCents: number
  line20Schedule3Part1Cents: number
  line23OtherTaxesCents: number
  line26EstimatedPaymentsCents: number
  line27aEarnedIncomeCreditCents: number
  line28AdditionalChildTaxCreditCents: number
  line29EducationCreditCents: number
  line31OtherPaymentsCents: number
}
export type ArithmeticResult2025 =
  | { status: 'blocked'; filingReady: false; blockers: string[]; lines: null }
  | { status: 'reconciled'; filingReady: false; blockers: []; lines: Record<string, number> }

const MAX_CENTS = 100000000000000
const safe = (value: number): boolean => Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS
const add = (...values: number[]): number | null => {
  const result = values.reduce((sum, value) => sum + value, 0)
  return safe(result) ? result : null
}
const toCents = (value: number | null): number | null => {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  const cents = Math.round(value * 100)
  return safe(cents) && Math.abs(value * 100 - cents) < 0.000001 ? cents : null
}

/** An explicit independent confirmation is required for ALL externally derived tax inputs.
 * No default zeros: absence of evidence is not evidence of zero.
 */
export function reconcileForm1040Arithmetic2025(
  mapping: Form1040Mapping2025,
  verified: VerifiedTaxComponents2025 | null,
  independentlyReviewed: boolean
): ArithmeticResult2025 {
  const blockers: string[] = []
  if (mapping.year !== 2025 || mapping.status !== 'mapped' || mapping.blockers.length) blockers.push('Source mapping must be valid before tax arithmetic.')
  if (!verified || !independentlyReviewed) blockers.push('Every external tax, credit and payment component requires independent review.')
  if (blockers.length || !verified) return { status: 'blocked', filingReady: false, blockers, lines: null }
  const fields = Object.keys(verified) as (keyof VerifiedTaxComponents2025)[]
  for (const field of fields) if (!safe(verified[field])) blockers.push(`${field} must be a nonnegative safe integer amount in cents.`)
  const wageWithholding = toCents(mapping.lines['25a'])
  const totalWithholding = toCents(mapping.lines['25d'])
  const income = toCents(mapping.lines['9'])
  const agi = toCents(mapping.lines['11a'])
  const deduction = toCents(mapping.lines['12e'])
  const taxableIncome = toCents(mapping.lines['15'])
  if ([wageWithholding, totalWithholding, income, agi, deduction, taxableIncome].some(value => value === null)) blockers.push('Source mapping contains an invalid dollar amount.')
  if (wageWithholding !== totalWithholding) blockers.push('Restricted source mapping requires line 25d to equal line 25a.')
  if (income !== agi) blockers.push('Restricted source mapping requires line 9 to equal line 11a.')
  if (agi !== null && deduction !== null && taxableIncome !== Math.max(0, agi - deduction)) blockers.push('Line 15 does not reconcile to AGI less deduction.')
  if (blockers.length) return { status: 'blocked', filingReady: false, blockers, lines: null }

  const line18 = add(verified.line16TaxCents, verified.line17Schedule2Part1Cents)
  const line21 = add(verified.line19ChildTaxCreditCents, verified.line20Schedule3Part1Cents)
  if (line18 === null || line21 === null) return { status: 'blocked', filingReady: false, blockers: ['Tax or credit subtotals exceed safe arithmetic limits.'], lines: null }
  const line22 = Math.max(0, line18 - line21)
  const line24 = add(line22, verified.line23OtherTaxesCents)
  const line25d = totalWithholding as number
  const line32 = add(verified.line27aEarnedIncomeCreditCents, verified.line28AdditionalChildTaxCreditCents, verified.line29EducationCreditCents, verified.line31OtherPaymentsCents)
  const line33 = line32 === null ? null : add(line25d, verified.line26EstimatedPaymentsCents, line32)
  if (line24 === null || line32 === null || line33 === null) return { status: 'blocked', filingReady: false, blockers: ['Payment or tax subtotals exceed safe arithmetic limits.'], lines: null }
  const overpaid = Math.max(0, line33 - line24)
  const owed = Math.max(0, line24 - line33)
  return { status: 'reconciled', filingReady: false, blockers: [], lines: {
    '9': income as number, '11a': agi as number, '12e': deduction as number, '15': taxableIncome as number,
    '16': verified.line16TaxCents, '17': verified.line17Schedule2Part1Cents, '18': line18,
    '19': verified.line19ChildTaxCreditCents, '20': verified.line20Schedule3Part1Cents,
    '21': line21, '22': line22, '23': verified.line23OtherTaxesCents, '24': line24,
    '25a': wageWithholding as number, '25d': line25d, '26': verified.line26EstimatedPaymentsCents,
    '27a': verified.line27aEarnedIncomeCreditCents, '28': verified.line28AdditionalChildTaxCreditCents,
    '29': verified.line29EducationCreditCents, '31': verified.line31OtherPaymentsCents,
    '32': line32, '33': line33, '34': overpaid, '37': owed
  } }
}
