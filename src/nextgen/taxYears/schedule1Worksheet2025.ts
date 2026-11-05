/**
 * Restricted 2025 Schedule 1 aggregation. NOT an eligibility determination.
 * Input amounts must already be classified and independently substantiated.
 * Does not handle Schedule 1-A, self-employment tax, QBI, or other schedules.
 * Reference: https://www.irs.gov/pub/irs-pdf/f1040s1.pdf
 */
export type Schedule1OtherIncomeLine2025 = '1' | '2a' | '3' | '4' | '5' | '6' | '7' | '8a' | '8b' | '8c' | '8d' | '8e' | '8f' | '8g' | '8h' | '8i' | '8j' | '8k' | '8l' | '8m' | '8n' | '8o' | '8p' | '8q' | '8r' | '8s' | '8t' | '8u' | '8z'
export type Schedule1AdjustmentLine2025 = '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19a' | '20' | '21' | '23' | '24a' | '24b' | '24c' | '24d' | '24e' | '24f' | '24g' | '24h' | '24i' | '24j' | '24k' | '24z'
export interface Schedule1Entry2025 {
  line: Schedule1OtherIncomeLine2025 | Schedule1AdjustmentLine2025
  amount: number
  description?: string
}
export interface Schedule1Worksheet2025 {
  year: 2025
  filingReady: false
  otherIncome: number
  adjustments: number
  netIncomeEffect: number
  /** Presence of amounts does not establish tax treatment or eligibility. */
  classificationConfirmed: false
}
const otherLines: ReadonlySet<string> = new Set(['1','2a','3','4','5','6','7', ...'abcdefghijklmnopqrstu'.split('').map(x => '8' + x), '8z'])
const adjustmentLines: ReadonlySet<string> = new Set(['11','12','13','14','15','16','17','18','19a','20','21','23', ...'abcdefghijk'.split('').map(x => '24' + x), '24z'])
const cents = (n: number) => Math.round(n * 100) / 100
export function create2025Schedule1Worksheet(entries: readonly Schedule1Entry2025[]): Schedule1Worksheet2025 {
  let otherCents = 0
  let adjustmentCents = 0
  for (const entry of entries) {
    if (!Number.isFinite(entry.amount) || entry.amount < 0 || entry.amount > 1e12 || Math.round(entry.amount * 100) !== entry.amount * 100 && Math.abs(Math.round(entry.amount * 100) - entry.amount * 100) > 1e-7) {
      throw new RangeError('Schedule 1 amounts must be finite, nonnegative amounts in cents')
    }
    const value = Math.round(entry.amount * 100)
    if (otherLines.has(entry.line)) otherCents += value
    else if (adjustmentLines.has(entry.line)) adjustmentCents += value
    else throw new RangeError('Unsupported Schedule 1 input line: ' + entry.line)
    if (!Number.isSafeInteger(otherCents) || !Number.isSafeInteger(adjustmentCents)) throw new RangeError('Schedule 1 total exceeds safe precision')
  }
  return { year: 2025, filingReady: false, classificationConfirmed: false,
    otherIncome: cents(otherCents / 100), adjustments: cents(adjustmentCents / 100), netIncomeEffect: cents((otherCents - adjustmentCents) / 100) }
}
