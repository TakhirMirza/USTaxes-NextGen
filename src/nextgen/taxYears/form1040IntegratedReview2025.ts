/** Stage 61: auditable, NON-POSTING Form 1040 review pipeline.
 * This is a diagnostic composition of restricted worksheets, NOT a tax return.
 * No line 13b, 19, 28, total tax, refund or amount due is authorized.
 */
import { RestrictedDraft2025 } from './form1040Draft2025'
import { RestrictedSchedule1ABridge2025 } from './form1040Schedule1ABridge2025'
import { Form1040Schedule8812Bridge2025 } from './form1040Schedule8812Bridge2025'
import { FilingStatus2025 } from './preview2025'
import { decide2025Line16, Line16Decision2025 } from './irsLine16Decision2025'

export interface IntegratedReviewInput2025 {
  draft: RestrictedDraft2025
  filingStatus: FilingStatus2025
  schedule1A: RestrictedSchedule1ABridge2025 | null
  schedule8812: Form1040Schedule8812Bridge2025 | null
  /** These are affirmative findings, not defaults inferred from W-2 data. */
  ordinaryIncomeMethodConfirmed: boolean
  specialTaxWorksheetNotRequiredConfirmed: boolean
}
export interface IntegratedReview2025 {
  year: 2025
  filingReady: false
  postingAuthorized: false
  officialLines: { '13b': null; '19': null; '28': null; '34': null; '37': null }
  unchangedDraftTaxableIncome: number
  provisionalTaxableIncome: number | null
  provisionalLine16: Line16Decision2025 | null
  candidateNonrefundableCredit: number | null
  candidateRefundableCredit: number | null
  withholdingForReviewOnly: number
  blockers: string[]
}
function validMoney(n: number, label: string): number {
  if (!Number.isFinite(n) || n < 0 || n > 1e12 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
    throw new RangeError(`${label}: invalid money amount`)
  }
  return Math.round(n * 100)
}
export function reviewIntegrated2025Form1040(input: IntegratedReviewInput2025): IntegratedReview2025 {
  const { draft, schedule1A, schedule8812 } = input
  if (draft.year !== 2025 || draft.filingReady !== false) throw new Error('Restricted 2025 draft required')
  const draftTaxable = validMoney(draft.lines['15'], 'Form 1040 line 15')
  const withholding = validMoney(draft.lines['25d'], 'Form 1040 line 25d')
  const blockers: string[] = [
    'This is a restricted diagnostic preview; no amounts may be posted to a filing return.',
    ...draft.excluded.map(x => `Draft limitation: ${x}`),
  ]
  let provisionalTaxableIncome: number | null = null
  let provisionalLine16: Line16Decision2025 | null = null
  if (schedule1A === null) {
    blockers.push('Schedule 1-A reconciliation is missing.')
  } else {
    if (schedule1A.year !== 2025 || schedule1A.filingReady !== false ||
        schedule1A.form1040Line13b !== null || schedule1A.eligibleToPost !== false) {
      throw new Error('Unsafe Schedule 1-A bridge')
    }
    if (validMoney(schedule1A.draftLine15Unchanged, 'Schedule 1-A baseline') !== draftTaxable) {
      blockers.push('Schedule 1-A baseline differs from Form 1040 draft line 15.')
    } else if (schedule1A.provisionalLine15IfAllowed !== null &&
               schedule1A.provisionalSchedule1ATotal !== null) {
      const deduction = validMoney(schedule1A.provisionalSchedule1ATotal, 'Schedule 1-A deduction')
      const taxable = validMoney(schedule1A.provisionalLine15IfAllowed, 'Schedule 1-A taxable income')
      if (taxable !== Math.max(0, draftTaxable - deduction)) {
        blockers.push('Schedule 1-A deduction and provisional taxable income do not reconcile.')
      } else {
        provisionalTaxableIncome = taxable / 100
        provisionalLine16 = decide2025Line16({
          taxableIncome: provisionalTaxableIncome,
          status: input.filingStatus,
          ordinaryIncomeMethodApplicable: input.ordinaryIncomeMethodConfirmed,
          specialTaxWorksheetRequired: input.specialTaxWorksheetNotRequiredConfirmed ? false : undefined,
        })
        if (provisionalLine16.kind === 'blocked') blockers.push(`Line 16: ${provisionalLine16.reason}`)
        else if (provisionalLine16.kind === 'unverified-import-candidate') {
          blockers.push('Line 16 uses a structurally checked but not filing-approved imported IRS table.')
        }
      }
    } else {
      blockers.push('Schedule 1-A has no reconciled provisional deduction.')
    }
    blockers.push(...schedule1A.blockers.map(x => `Schedule 1-A: ${x}`))
  }
  let candidateNonrefundableCredit: number | null = null
  let candidateRefundableCredit: number | null = null
  if (schedule8812 === null) {
    blockers.push('Schedule 8812 reconciliation is missing.')
  } else {
    if (schedule8812.year !== 2025 || schedule8812.filingReady !== false ||
        schedule8812.form1040Line19 !== null || schedule8812.form1040Line28 !== null ||
        schedule8812.readyForPosting !== false) throw new Error('Unsafe Schedule 8812 bridge')
    candidateNonrefundableCredit = schedule8812.nonrefundableCandidate
    candidateRefundableCredit = schedule8812.refundableCandidate
    if (candidateNonrefundableCredit !== null) validMoney(candidateNonrefundableCredit, 'CTC/ODC')
    if (candidateRefundableCredit !== null) validMoney(candidateRefundableCredit, 'ACTC')
    if (schedule8812.availableTaxBeforeCredits !== null) {
      validMoney(schedule8812.availableTaxBeforeCredits, 'Credit tax baseline')
      if (provisionalLine16 && provisionalLine16.kind !== 'blocked' &&
          validMoney(schedule8812.availableTaxBeforeCredits, 'Credit tax baseline') !== validMoney(provisionalLine16.tax, 'Line 16 candidate')) {
        blockers.push('Schedule 8812 available-tax baseline differs from provisional Form 1040 line 16; recalculate credit limits.')
        candidateNonrefundableCredit = null
        candidateRefundableCredit = null
      }
    } else blockers.push('Schedule 8812 tax baseline is not established.')
    blockers.push(...schedule8812.unresolved.map(x => `Schedule 8812: ${x}`))
  }
  return {
    year: 2025, filingReady: false, postingAuthorized: false,
    officialLines: { '13b': null, '19': null, '28': null, '34': null, '37': null },
    unchangedDraftTaxableIncome: draftTaxable / 100,
    provisionalTaxableIncome, provisionalLine16,
    candidateNonrefundableCredit, candidateRefundableCredit,
    withholdingForReviewOnly: withholding / 100,
    blockers: [...new Set(blockers)],
  }
}
