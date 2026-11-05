/** Stage 65: presentation-only boundary for restricted diagnostic reviews.
 * This adapter never accepts filing authorization or writes tax return data.
 */
import { SchedulesReconciliation2025 } from './form1040SchedulesReconciliation2025'

const LABELS: Array<[keyof SchedulesReconciliation2025['candidates'], string]> = [
  ['line17', '17 — Additional tax (Schedule 2)'],
  ['line18', '18 — Tax before credits'],
  ['line20', '20 — Other nonrefundable credits'],
  ['line21', '21 — Total nonrefundable credits'],
  ['line22', '22 — Tax after credits'],
  ['line23', '23 — Other taxes'],
  ['line24', '24 — Total tax'],
  ['line31', '31 — Other payments (Schedule 3)'],
  ['line32', '32 — Other refundable credits'],
  ['line33', '33 — Total payments'],
  ['line34', '34 — Potential overpayment'],
  ['line37', '37 — Potential amount owed']
]

export interface ReviewPresentation2025 {
  year: 2025
  status: 'NOT FILING READY'
  rows: Array<{ line: string; amount: number | null; display: string }>
  blockers: string[]
}

export function presentRestricted2025Review(value: unknown): ReviewPresentation2025 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a restricted 2025 review object')
  const r = value as Partial<SchedulesReconciliation2025>
  if (r.year !== 2025 || r.filingReady !== false || r.postingAuthorized !== false) throw new Error('Only unapproved 2025 reviews can be displayed')
  if (!r.officialLines || typeof r.officialLines !== 'object' ||
      Object.keys(r.officialLines).length !== 12 ||
      Object.values(r.officialLines).some(x => x !== null) ||
      Object.keys(r.officialLines).some(k => !['17','18','20','21','22','23','24','31','32','33','34','37'].includes(k))) throw new Error('Official Form 1040 lines must remain blank')
  if (!r.candidates || typeof r.candidates !== 'object' || Array.isArray(r.candidates) ||
      Object.keys(r.candidates).length !== LABELS.length ||
      Object.keys(r.candidates).some(k => !LABELS.some(([allowed]) => allowed === k)) ||
      !Array.isArray(r.blockers) || r.blockers.some(b => typeof b !== 'string')) {
    throw new Error('Invalid review fields')
  }
  const rows = LABELS.map(([key, line]) => {
    const amount = r.candidates![key]
    if (amount === undefined || (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 ||
        amount > 1e12 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6))) {
      throw new Error(`Invalid diagnostic amount: ${key}`)
    }
    return { line, amount, display: amount === null ? 'Not reviewed' : '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  })
  return { year: 2025, status: 'NOT FILING READY', rows, blockers: r.blockers.slice() }
}
