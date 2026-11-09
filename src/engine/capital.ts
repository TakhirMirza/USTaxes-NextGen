/**
 * Form 8949 grouping and Schedule D lines 1a–3 and 8a–10 (tax year 2025).
 *
 * Sales reported on a 1099-B or 1099-DA with basis reported to the IRS and no adjustment go
 * straight to Schedule D line 1a / 8a. Everything else is listed on Form 8949 under its box.
 */
import type { CapitalTransaction } from './model.ts'

export type Box8949 = 'A' | 'B' | 'C' | 'G' | 'H' | 'I' | 'D' | 'E' | 'F' | 'J' | 'K' | 'L'
export type ScheduleDLine = '1a' | '1b' | '2' | '3' | '8a' | '8b' | '9' | '10'

export interface LineTotals { proceeds: number; basis: number; adjustment: number; gain: number }
export interface Group8949 { box: Box8949; part: 'short' | 'long'; line: ScheduleDLine; rows: CapitalTransaction[]; totals: LineTotals }

const r = (n: number): number => Math.round(n)

/** Fills fields that older saved returns (and hand-built test data) may lack. */
export const withDefaults = (t: CapitalTransaction): CapitalTransaction => ({
  ...t, dateAcquired: t.dateAcquired ?? '', dateSold: t.dateSold ?? '', reporting: t.reporting ?? 'covered',
  digitalAsset: t.digitalAsset ?? false, adjustmentCode: t.adjustmentCode ?? '', adjustment: t.adjustment ?? 0
})

export const gainOf = (t: CapitalTransaction): number => r(t.proceeds - t.costBasis + (t.adjustment || 0))

export function boxFor(t: CapitalTransaction): Box8949 {
  const k = ['covered', 'noncovered', 'none'].indexOf(t.reporting)
  const i = k < 0 ? 0 : k
  if (t.term === 'short') return (t.digitalAsset ? ['G', 'H', 'I'] : ['A', 'B', 'C'])[i] as Box8949
  return (t.digitalAsset ? ['J', 'K', 'L'] : ['D', 'E', 'F'])[i] as Box8949
}

const LINE_FOR_BOX: Record<Box8949, ScheduleDLine> = {
  A: '1b', G: '1b', B: '2', H: '2', C: '3', I: '3', D: '8b', J: '8b', E: '9', K: '9', F: '10', L: '10'
}

/** The Schedule D line a sale is totaled on. */
export const lineFor = (t: CapitalTransaction): ScheduleDLine =>
  isAggregated(t) ? (t.term === 'short' ? '1a' : '8a') : LINE_FOR_BOX[boxFor(t)]

/** Goes straight to line 1a / 8a: basis reported, no code, no adjustment. */
export const isAggregated = (t: CapitalTransaction): boolean =>
  (t.reporting ?? 'covered') === 'covered' && !(t.adjustment || 0) && !(t.adjustmentCode || '').trim()

const totalsOf = (rows: CapitalTransaction[]): LineTotals => ({
  proceeds: r(rows.reduce((s, t) => s + t.proceeds, 0)),
  basis: r(rows.reduce((s, t) => s + t.costBasis, 0)),
  adjustment: r(rows.reduce((s, t) => s + (t.adjustment || 0), 0)),
  gain: r(rows.reduce((s, t) => s + gainOf(t), 0))
})

const BOX_ORDER: Box8949[] = ['A', 'B', 'C', 'G', 'H', 'I', 'D', 'E', 'F', 'J', 'K', 'L']

export function groups8949(input: CapitalTransaction[]): Group8949[] {
  const txs = input.map(withDefaults)
  const out: Group8949[] = []
  for (const box of BOX_ORDER) {
    const rows = txs.filter((t) => !isAggregated(t) && boxFor(t) === box)
    if (rows.length) out.push({ box, part: 'ABCGHI'.includes(box) ? 'short' : 'long', line: LINE_FOR_BOX[box], rows, totals: totalsOf(rows) })
  }
  return out
}

export function scheduleDLines(input: CapitalTransaction[]): Record<ScheduleDLine, LineTotals> {
  const txs = input.map(withDefaults)
  const lines = {} as Record<ScheduleDLine, LineTotals>
  lines['1a'] = totalsOf(txs.filter((t) => t.term === 'short' && isAggregated(t)))
  lines['8a'] = totalsOf(txs.filter((t) => t.term === 'long' && isAggregated(t)))
  for (const l of ['1b', '2', '3', '8b', '9', '10'] as ScheduleDLine[]) {
    lines[l] = totalsOf(txs.filter((t) => lineFor(t) === l))
  }
  return lines
}

/** Parses MM/DD/YYYY; returns null for VARIOUS, INHERITED or anything else. */
export function parseDate(v: string | undefined): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((v ?? '').trim())
  if (!m) return null
  const d = new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]))
  return d.getUTCMonth() === +m[1] - 1 ? d : null
}

/** Long-term when held more than one year (the day after the anniversary or later). */
export function holdingTermFromDates(acquired: string | undefined, sold: string | undefined): 'short' | 'long' | null {
  if (/^inherited$/i.test((acquired ?? '').trim())) return 'long'
  const a = parseDate(acquired)
  const s = parseDate(sold)
  if (!a || !s) return null
  const anniversary = new Date(Date.UTC(a.getUTCFullYear() + 1, a.getUTCMonth(), a.getUTCDate()))
  return s.getTime() > anniversary.getTime() ? 'long' : 'short'
}
