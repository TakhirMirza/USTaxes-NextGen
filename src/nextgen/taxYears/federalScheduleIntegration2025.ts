/** Schedule-aware 2025 Form 1040 income reconciliation. No automatic filing or tax assessment.
 * Input amounts from schedules are candidate values and require independent eligibility review.
 * The result never treats a missing schedule as zero without explicit confirmation.
 */
import { Schedule1040Candidates2025 } from './schedules1040Bridge2025'

export interface FederalScheduleIncomeInput2025 {
  year: 2025
  wagesCents: number | null
  taxableInterestCents: number | null
  schedule: Schedule1040Candidates2025
  schedulesReviewed: boolean
  noOtherIncomeConfirmed: boolean
  deductionCents: number | null
  deductionEligibilityReviewed: boolean
}
export interface FederalScheduleIncomeResult2025 {
  status: 'blocked' | 'reconciled'
  filingReady: false
  blockers: string[]
  lines: Record<string, number> | null
  provenance: Record<string, string>
}
const safe = (n: number | null): n is number => n !== null && Number.isSafeInteger(n) && n >= 0 && n <= 100000000000000
const sum = (...values: number[]) => {
  const result = values.reduce((a, b) => a + b, 0)
  return Number.isSafeInteger(result) && result <= 100000000000000 ? result : null
}
export function reconcileFederalScheduleIncome2025(input: FederalScheduleIncomeInput2025): FederalScheduleIncomeResult2025 {
  const blockers: string[] = []
  if (input.year !== 2025) blockers.push('Only tax year 2025 is supported.')
  if (!safe(input.wagesCents)) blockers.push('Verified W-2 wages are required.')
  if (!safe(input.taxableInterestCents)) blockers.push('Verified taxable interest is required.')
  if (!safe(input.deductionCents) || !input.deductionEligibilityReviewed) blockers.push('Deduction amount and eligibility require independent review.')
  if (input.schedule.blocked || !input.schedulesReviewed) blockers.push('Schedule entries and IRS line classifications require independent review.')
  if (!input.noOtherIncomeConfirmed) blockers.push('Other income lines (including dividends, capital gains and pensions) must be reviewed before AGI is computed.')
  if (!safe(input.schedule.line8)) blockers.push('Schedule 1 additional income (1040 line 8) is missing or invalid.')
  if (!safe(input.schedule.line10)) blockers.push('Schedule 1 adjustments (1040 line 10) are missing or invalid.')
  if (blockers.length) return { status: 'blocked', filingReady: false, blockers, lines: null, provenance: {} }
  const wages = input.wagesCents as number
  const interest = input.taxableInterestCents as number
  const additional = input.schedule.line8 as number
  const adjustments = input.schedule.line10 as number
  const deduction = input.deductionCents as number
  const line9 = sum(wages, interest, additional)
  if (line9 === null) blockers.push('Total income exceeds safe arithmetic limits.')
  if (line9 !== null && adjustments > line9) blockers.push('Schedule 1 adjustments exceed total income; review the source classifications.')
  if (blockers.length || line9 === null) return { status: 'blocked', filingReady: false, blockers, lines: null, provenance: {} }
  const line11 = line9 - adjustments
  const line15 = Math.max(0, line11 - deduction)
  return { status: 'reconciled', filingReady: false, blockers: [], lines: {
    '1z': wages, '2b': interest, '8': additional, '9': line9, '10': adjustments,
    '11a': line11, '11b': line11, '12e': deduction, '14': deduction, '15': line15
  }, provenance: {
    '1z': 'Verified W-2 source entries', '2b': 'Verified 1099-INT source entries',
    '8': 'Schedule 1, line 10', '9': 'Income subtotal, verified sources',
    '10': 'Schedule 1, line 26', '11a': 'Total income less adjustments',
    '11b': 'AGI carry-forward', '12e': 'Independently reviewed deduction',
    '14': 'Deduction subtotal (restricted scenario)', '15': 'AGI less deduction'
  } }
}
