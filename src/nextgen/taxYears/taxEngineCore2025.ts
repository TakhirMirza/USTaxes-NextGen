/** 2025 source-to-Form-1040 mapping core. No tax liability, refund, filing or PDF.
 * Reference: https://www.irs.gov/instructions/i1040gi
 * Money is parsed in integer cents to prevent floating point drift.
 */
import { FilingStatus2025 } from './preview2025'
import rules from '../tax2025-reference.json'

export interface SourceW2_2025 { id: string; employer: string; box1: string; box2: string }
export interface Source1099INT_2025 { id: string; payer: string; box1: string }
export interface TaxEngineInput2025 {
  year: number
  filingStatus: FilingStatus2025
  w2: readonly SourceW2_2025[]
  interest: readonly Source1099INT_2025[]
  standardDeductionFactsConfirmed: boolean
  taxpayerUnder65AndNotBlind: boolean
  spouseUnder65AndNotBlind: boolean
  notClaimableAsDependent: boolean
  noOtherIncomeAdjustmentsCreditsOrTaxes: boolean
}
export interface Form1040Mapping2025 {
  year: 2025
  filingReady: false
  status: 'blocked' | 'mapped'
  lines: { '1a': number | null; '2b': number | null; '9': number | null; '11a': number | null; '12e': number | null; '15': number | null; '25a': number | null; '25d': number | null }
  blockers: string[]
  unsupported: string[]
}
const MAX_CENTS = 100000000000000
export function parseDollarsToCents2025(value: string): number | null {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value)) return null
  const parts = value.split('.')
  const cents = Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null
}
const sumSafe = (items: readonly number[]): number | null => {
  let total = 0
  for (const item of items) {
    total += item
    if (!Number.isSafeInteger(total) || total > MAX_CENTS) return null
  }
  return total
}
export function map2025SourcesTo1040(input: TaxEngineInput2025): Form1040Mapping2025 {
  const blockers: string[] = []
  if (input.year !== 2025) blockers.push('Only tax year 2025 is mapped.')
  if (!Object.prototype.hasOwnProperty.call(rules.standardDeduction, input.filingStatus)) blockers.push('Unknown filing status.')
  if (input.w2.length > 100 || input.interest.length > 100) blockers.push('Source document count exceeds the supported limit of 100 per category.')
  const ids = new Set<string>()
  const w1: number[] = []; const w2: number[] = []; const int1: number[] = []
  input.w2.forEach((item, i) => {
    const id = item.id.trim()
    if (!id || ids.has(`w2:${id}`)) blockers.push(`W-2 #${i + 1}: missing or duplicate document ID.`)
    ids.add(`w2:${id}`)
    if (!item.employer.trim()) blockers.push(`W-2 #${i + 1}: employer is required.`)
    const wages = parseDollarsToCents2025(item.box1)
    const withholding = parseDollarsToCents2025(item.box2)
    if (wages === null || withholding === null) blockers.push(`W-2 #${i + 1}: invalid Box 1 or Box 2 amount.`)
    else { w1.push(wages); w2.push(withholding) }
  })
  input.interest.forEach((item, i) => {
    const id = item.id.trim()
    if (!id || ids.has(`int:${id}`)) blockers.push(`1099-INT #${i + 1}: missing or duplicate document ID.`)
    ids.add(`int:${id}`)
    if (!item.payer.trim()) blockers.push(`1099-INT #${i + 1}: payer is required.`)
    const amount = parseDollarsToCents2025(item.box1)
    if (amount === null) blockers.push(`1099-INT #${i + 1}: invalid Box 1 amount.`)
    else int1.push(amount)
  })
  const wages = sumSafe(w1); const withholding = sumSafe(w2); const interest = sumSafe(int1)
  if (wages === null || withholding === null || interest === null || (wages !== null && interest !== null && sumSafe([wages, interest]) === null)) blockers.push('Combined source amounts exceed safe arithmetic limits.')
  if (!input.standardDeductionFactsConfirmed || !input.taxpayerUnder65AndNotBlind || !input.spouseUnder65AndNotBlind || !input.notClaimableAsDependent) blockers.push('Basic standard deduction eligibility, age, blindness and dependency require explicit review.')
  if (!input.noOtherIncomeAdjustmentsCreditsOrTaxes) blockers.push('Other income, adjustments, credits and taxes have not been ruled out.')
  const unsupported = [
    'Line 16 IRS Tax Table and special-method worksheets are not implemented in this core.',
    'Schedule 1, Schedule 1-A, Schedule 2, Schedule 3, Schedule 8812 and other applicable schedules require independent validation.',
    'Form 1040 line 24, line 34, line 37, refund, amount due, PDF and electronic filing are not generated.',
    'Identity, residency, filing-status eligibility and state returns require additional review.'
  ]
  const empty = { '1a': null, '2b': null, '9': null, '11a': null, '12e': null, '15': null, '25a': null, '25d': null }
  if (blockers.length || wages === null || withholding === null || interest === null) return { year: 2025, filingReady: false, status: 'blocked', lines: empty, blockers, unsupported }
  const total = wages + interest
  const deduction = rules.standardDeduction[input.filingStatus] * 100
  return { year: 2025, filingReady: false, status: 'mapped', blockers: [], unsupported,
    lines: { '1a': wages / 100, '2b': interest / 100, '9': total / 100, '11a': total / 100,
      '12e': deduction / 100, '15': Math.max(0, total - deduction) / 100,
      '25a': withholding / 100, '25d': withholding / 100 } }
}
