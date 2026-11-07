/**
 * 2025 federal 1040 *restricted draft* — not a filing return.
 * Official tax method reference: https://www.irs.gov/publications/p1040
 * Only W-2 box 1, 1099-INT box 1, and corresponding withholding are modeled.
 * No claim of correct AGI, deductions, credits, special tax or refund is made.
 */
import { FilingStatus2025 } from './preview2025'
import { W2Entry2025, Interest1099Entry2025 } from './income2025'
import { create2025Form1040Worksheet } from './form1040Worksheet2025'
import { decide2025Line16, Line16Decision2025 } from './irsLine16Decision2025'
import { create2025Schedule1Worksheet, Schedule1Entry2025 } from './schedule1Worksheet2025'

export interface RestrictedDraft2025 {
  year: 2025
  filingReady: false
  lines: {
    '1a': number; '2b': number; '8': number; '9': number; '10': number; '11a': number
    '12e': number; '15': number; '25a': number; '25b': number; '25d': number
  }
  line16: Line16Decision2025
  excluded: string[]
}

/**
 * This flag requires a separate, explicit determination by a competent preparer;
 * it cannot be inferred from having only W-2/1099-INT input fields.
 */
export function makeRestricted2025Draft(
  w2: W2Entry2025[], interest: Interest1099Entry2025[],
  status: FilingStatus2025,
  ordinaryMethodConfirmed = false,
  specialMethodNotRequiredConfirmed = false,
  schedule1Entries?: readonly Schedule1Entry2025[],
  confirmedStandardDeduction?: number
): RestrictedDraft2025 {
  const ws = create2025Form1040Worksheet(w2, interest, status)
  const schedule1 = schedule1Entries === undefined ? undefined : create2025Schedule1Worksheet(schedule1Entries)
  const otherIncome = schedule1 ? schedule1.otherIncome : 0
  const adjustments = schedule1 ? schedule1.adjustments : 0
  const agi = Math.round((ws.line9IllustrativeTotalIncome + otherIncome - adjustments) * 100) / 100
  if (confirmedStandardDeduction !== undefined && (!Number.isSafeInteger(confirmedStandardDeduction * 100) || confirmedStandardDeduction < 0)) {
    throw new RangeError('Confirmed standard deduction must be a nonnegative amount in whole cents.')
  }
  const deduction = confirmedStandardDeduction === undefined ? ws.line12BasicStandardDeduction : confirmedStandardDeduction
  const taxableIncome = Math.max(0, Math.round((agi - deduction) * 100) / 100)
  const line16 = decide2025Line16({
    taxableIncome,
    status,
    ordinaryIncomeMethodApplicable: ordinaryMethodConfirmed,
    specialTaxWorksheetRequired: specialMethodNotRequiredConfirmed ? false : undefined,
  })
  return {
    year: 2025, filingReady: false,
    lines: {
      '1a': ws.line1aW2Wages,
      '2b': ws.line2bTaxableInterest,
      '8': otherIncome,
      '9': Math.round((ws.line9IllustrativeTotalIncome + otherIncome) * 100) / 100,
      '10': adjustments,
      '11a': agi,
      '12e': deduction,
      '15': taxableIncome,
      '25a': ws.line25aW2Withholding,
      '25b': ws.line25b1099InterestWithholding,
      '25d': ws.line25dIllustrativeTotalWithholding,
    },
    line16,
    excluded: [
      'Schedule 1 classifications and deduction eligibility are not validated; unentered income/adjustments are unknown',
      'Schedule 1-A and other non-taxable income treatments',
      'Itemized deductions and unconfirmed standard deduction eligibility',
      'Qualified dividends, capital gains and other special tax worksheets',
      'Dependents, tax credits, additional taxes, estimated payments and refundable credits',
      'Form 1040 reconciliation, refund/amount due, IRS PDF and e-file',
    ],
  }
}
