/**
 * Schedule K-1 income from partnerships (Form 1065) and S corporations (Form 1120-S), tax year 2025.
 *
 * Ordinary business income, rental income and guaranteed payments go on Schedule E Part II (line 28).
 * Passive losses are limited on Form 8582 (passive.ts). Portfolio items flow to their own lines: interest and
 * dividends to Form 1040, capital gains to Schedule D lines 5 and 12, section 1231 gain or loss to
 * Form 4797 Part I, partnership self-employment earnings to Schedule SE, and QBI to Form 8995/8995-A.
 */
import type { K1, Owner } from './model.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

export interface K1Result {
  id: string; owner: Owner; name: string; kind: K1['kind']; ein: string; passive: boolean
  /** Activity income or loss before the passive limit (boxes 1–3 and guaranteed payments, less section 179). */ net: number
  /** Schedule E line 28 columns. */ g: number; h: number; i: number; j: number; k: number
  /** Passive loss disallowed this year (carried to 2026). */ disallowed: number
}

export interface K1Totals {
  rows: K1Result[]
  line29aH: number; line29aK: number; line29bG: number; line29bI: number; line29bJ: number
  line30: number; line31: number; line32: number
  interest: number; ordinaryDividends: number; qualifiedDividends: number
  shortTermGain: number; longTermGain: number
  section1231: { name: string; amount: number }[]
  /** Net earnings from self-employment (partnership box 14 code A) by owner. */ seEarnings: Record<Owner, number>
  /** Passive income or loss allowed (net investment income). */ passiveNet: number
  disallowed: number
  issues: string[]
}

/** K-1 activity income or loss (boxes 1–3 less section 179), without guaranteed payments. */
export const k1Activity = (x: K1): number => r(x.ordinary + x.rentalRealEstate + x.otherRental - pos(x.section179))

/**
 * @param passive allowed loss (current plus prior) per passive K-1 from Form 8582. Without it,
 * passive losses are taken in full (used only for amounts that do not depend on the limit).
 */
export function k1Totals(k1s: K1[], passive?: Map<string, { allowed: number; unallowed: number }>): K1Totals {
  const issues: string[] = []
  let disallowedTotal = 0
  const rows: K1Result[] = k1s.map((x) => {
    const name = x.entityName.trim() || (x.kind === 'scorp' ? 'S corporation' : 'Partnership')
    const isPassive = !x.materialParticipation
    const section179 = r(pos(x.section179))
    const activity = r(x.ordinary + x.rentalRealEstate + x.otherRental)
    const gp = x.kind === 'partnership' ? r(pos(x.guaranteedPayments)) : 0
    if (x.basisLimited && activity - section179 < 0) issues.push(`${name}: a loss is limited to your basis and amount at risk (Form 7203 for S corporations, Form 6198). Enter only the allowed loss.`)
    if (x.royalties) issues.push(`${name}: report K-1 royalties as a royalty property under Rental property (Schedule E line 4).`)
    if (x.kind === 'scorp' && x.guaranteedPayments) issues.push(`${name}: S corporations do not pay guaranteed payments; shareholder pay is on a W-2.`)
    const row: K1Result = { id: x.id, owner: x.owner, name, kind: x.kind, ein: x.ein, passive: isPassive, net: activity + gp - section179, g: 0, h: 0, i: 0, j: 0, k: 0, disallowed: 0 }
    if (isPassive) {
      // Section 179 of a passive activity is part of its passive loss (Form 8582), so it goes through column (g).
      const net = activity - section179
      if (net > 0) row.h = net
      const loss = pos(-net) + r(pos(x.priorPassiveCarryover))
      const p = passive?.get(x.id)
      row.g = p ? p.allowed : loss
      row.disallowed = p ? p.unallowed : 0
      disallowedTotal += row.disallowed
      row.k = gp
    } else {
      row.j = section179
      if (activity >= 0) row.k = activity + gp
      else { row.i = -activity; row.k = gp }
    }
    return row
  })
  const line29aH = sum(rows.map((x) => x.h))
  const line29aK = sum(rows.map((x) => x.k))
  const line29bG = sum(rows.map((x) => x.g))
  const line29bI = sum(rows.map((x) => x.i))
  const line29bJ = sum(rows.map((x) => x.j))
  const line30 = line29aH + line29aK
  const line31 = line29bG + line29bI + line29bJ
  const seEarnings: Record<Owner, number> = { taxpayer: 0, spouse: 0 }
  for (const x of k1s) if (x.kind === 'partnership') seEarnings[x.owner] += r(x.seEarnings)
  return {
    rows, line29aH, line29aK, line29bG, line29bI, line29bJ, line30, line31, line32: line30 - line31,
    interest: r(sum(k1s.map((x) => pos(x.interest)))),
    ordinaryDividends: r(sum(k1s.map((x) => pos(x.ordinaryDividends)))),
    qualifiedDividends: r(sum(k1s.map((x) => Math.min(pos(x.qualifiedDividends), pos(x.ordinaryDividends))))),
    shortTermGain: r(sum(k1s.map((x) => x.shortTermGain))),
    longTermGain: r(sum(k1s.map((x) => x.longTermGain))),
    section1231: k1s.filter((x) => x.section1231 !== 0).map((x) => ({ name: x.entityName.trim() || 'Schedule K-1', amount: r(x.section1231) })),
    seEarnings,
    passiveNet: line29aH - line29bG,
    disallowed: disallowedTotal,
    issues
  }
}
