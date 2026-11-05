/** Stage 64: Schedule 2/3 and Schedule 8812 cross-check, diagnostic only.
 * A null value means unreviewed, never zero. Official Form 1040 lines remain null.
 */
import { BalanceReview2025 } from './form1040BalanceReview2025'
import { Schedule2And3Review2025 } from './schedule2And3Review2025'

export interface SchedulesReconciliationInput2025 {
  balance: BalanceReview2025
  schedules: Schedule2And3Review2025
  /** Form 1040 line 18: line 16 + Schedule 2 Part I (line 17). */
  line18TaxBeforeNonrefundableCredits: number | null
  /** Other payments besides withholding, ACTC and Schedule 3 Part II. */
  additionalPaymentsExcludingSchedule3: number | null
  /** Explicit confirmation of line 19/20 credit ordering and Schedule 8812 limits. */
  creditOrderReviewed: boolean
  /** Explicit confirmation that Schedule 3 Part II excludes ACTC/withholding. */
  paymentSourcesReviewed: boolean
}
export interface SchedulesReconciliation2025 {
  year: 2025
  filingReady: false
  postingAuthorized: false
  officialLines: { '17': null; '18': null; '20': null; '21': null; '22': null; '23': null; '24': null; '31': null; '32': null; '33': null; '34': null; '37': null }
  candidates: { line17: number | null; line18: number | null; line20: number | null; line21: number | null; line22: number | null; line23: number | null; line24: number | null; line31: number | null; line32: number | null; line33: number | null; line34: number | null; line37: number | null }
  blockers: string[]
}
function money(n: number | null, label: string): number | null {
  if (n === null) return null
  if (!Number.isFinite(n) || n < 0 || n > 1e12 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new RangeError(`${label}: invalid amount`)
  return Math.round(n * 100)
}
const usd = (n: number | null): number | null => n === null ? null : n / 100
export function reconcile2025SchedulesWith1040(input: SchedulesReconciliationInput2025): SchedulesReconciliation2025 {
  const { balance: b, schedules: s } = input
  if (b.year !== 2025 || s.year !== 2025 || b.filingReady !== false || s.filingReady !== false || b.postingAuthorized !== false || s.postingAuthorized !== false || Object.values(b.officialLines).some(v => v !== null)) throw new Error('Restricted 2025 reviews required')
  const blockers = [...b.blockers, ...s.blockers]
  const c = b.candidates, t = s.candidates
  const line16 = money(c.line16Tax, 'line 16'), line17 = money(t.form1040Line17, 'line 17')
  const line18 = line16 !== null && line17 !== null ? line16 + line17 : null
  const supplied18 = money(input.line18TaxBeforeNonrefundableCredits, 'line 18 evidence')
  if (line18 === null || supplied18 === null || line18 !== supplied18) blockers.push('Form 1040 line 18 must equal line 16 plus Schedule 2 Part I line 17.')
  const line19 = money(c.line19ChildAndDependentCredit, 'line 19')
  const line20 = money(t.form1040Line20, 'line 20')
  const line23 = money(t.form1040Line23, 'line 23')
  const line31 = money(t.form1040Line31, 'line 31')
  const line28 = money(c.line28AdditionalChildTaxCredit, 'line 28')
  const withholding = money(c.line25dWithholding, 'line 25d')
  const extra = money(input.additionalPaymentsExcludingSchedule3, 'other payments')
  if (!input.creditOrderReviewed) blockers.push('Schedule 8812 and Schedule 3 nonrefundable credit order not reviewed.')
  if (!input.paymentSourcesReviewed) blockers.push('Payment sources and duplicate exclusions not reviewed.')
  if (money(c.line20OtherNonrefundableCredits, 'balance line 20') !== line20) blockers.push('Schedule 3 line 20 disagrees with balance review.')
  if (money(c.line23OtherTaxes, 'balance line 23') !== line23) blockers.push('Schedule 2 line 23 disagrees with balance review.')
  // Stage 62 excludes Schedule 2 Part I; it cannot be used as authoritative line 24.
  if (line17 !== null && line17 > 0) blockers.push('Stage 62 line 24 excludes Schedule 2 Part I; use Stage 64 candidate only.')
  const line21 = line19 !== null && line20 !== null ? line19 + line20 : null
  if (line18 !== null && line21 !== null && line21 > line18) blockers.push('Nonrefundable credits exceed line 18 tax; recalculate Schedule 8812.')
  const line22 = line18 !== null && line21 !== null && line21 <= line18 ? line18 - line21 : null
  const line24 = line22 !== null && line23 !== null ? line22 + line23 : null
  // This candidate line 32 includes ACTC and Schedule 3 Part II; other refundable lines must be separately reconciled.
  const line32 = line28 !== null && line31 !== null ? line28 + line31 : null
  const line33 = withholding !== null && line32 !== null && extra !== null ? withholding + line32 + extra : null
  const line34 = line24 !== null && line33 !== null ? Math.max(0, line33 - line24) : null
  const line37 = line24 !== null && line33 !== null ? Math.max(0, line24 - line33) : null
  if (line18 === null || line20 === null || line23 === null || line31 === null || line33 === null) blockers.push('Missing Schedule 2/3 or payment candidate; no zero inferred.')
  if (line33 !== null && money(c.line33TotalPayments, 'balance line 33') !== line33) blockers.push('Stage 62 payment total disagrees with Schedule 3 reconciliation.')
  blockers.push('Diagnostic candidates only; complete 2025 rules, independent tests, and filing authorization are outstanding.')
  return { year: 2025, filingReady: false, postingAuthorized: false,
    officialLines: { '17': null, '18': null, '20': null, '21': null, '22': null, '23': null, '24': null, '31': null, '32': null, '33': null, '34': null, '37': null },
    candidates: { line17: usd(line17), line18: usd(line18), line20: usd(line20), line21: usd(line21), line22: usd(line22), line23: usd(line23), line24: usd(line24), line31: usd(line31), line32: usd(line32), line33: usd(line33), line34: usd(line34), line37: usd(line37) },
    blockers: [...new Set(blockers)] }
}
