/**
 * Schedule K-1 income from partnerships (Form 1065) and S corporations (Form 1120-S), tax year 2025.
 *
 * Ordinary business income, rental income and guaranteed payments go on Schedule E Part II (line 28).
 * Passive losses are allowed only up to passive income (a simplified Form 8582: no $25,000 allowance
 * for rental activities held through an entity). Portfolio items flow to their own lines: interest and
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

export function k1Totals(k1s: K1[], otherPassiveIncome: number): K1Totals {
  const issues: string[] = []
  const prelim = k1s.map((x) => {
    const name = x.entityName.trim() || (x.kind === 'scorp' ? 'S corporation' : 'Partnership')
    const passive = !x.materialParticipation
    const section179 = r(pos(x.section179))
    // Guaranteed payments are always nonpassive (column k); the rest follows participation.
    const activity = r(x.ordinary + x.rentalRealEstate + x.otherRental)
    const gp = x.kind === 'partnership' ? r(pos(x.guaranteedPayments)) : 0
    if (x.basisLimited && activity - section179 < 0) issues.push(`${name}: a loss is limited to your basis and amount at risk (Form 7203 for S corporations, Form 6198). Enter only the allowed loss.`)
    if (x.royalties) issues.push(`${name}: report K-1 royalties as a royalty property under Rental property (Schedule E line 4).`)
    if (x.kind === 'scorp' && x.guaranteedPayments) issues.push(`${name}: S corporations do not pay guaranteed payments; shareholder pay is on a W-2.`)
    return { x, name, passive, section179, activity, gp, priorCarry: r(pos(x.priorPassiveCarryover)) }
  })
  // Simplified Form 8582: passive losses (including carryovers) are allowed up to passive income.
  const passiveIncome = sum(prelim.filter((p) => p.passive && p.activity > 0).map((p) => p.activity)) + pos(otherPassiveIncome)
  const passiveLosses = sum(prelim.filter((p) => p.passive).map((p) => pos(-p.activity) + p.priorCarry))
  const allowedTotal = Math.min(passiveLosses, passiveIncome)
  let disallowedTotal = 0
  const rows: K1Result[] = prelim.map((p) => {
    const row: K1Result = { id: p.x.id, owner: p.x.owner, name: p.name, kind: p.x.kind, ein: p.x.ein, passive: p.passive, net: p.activity + p.gp - p.section179, g: 0, h: 0, i: 0, j: p.section179, k: 0, disallowed: 0 }
    if (p.passive) {
      if (p.activity > 0) row.h = p.activity
      const loss = pos(-p.activity) + p.priorCarry
      if (loss > 0) {
        const allowed = passiveLosses > 0 ? r(allowedTotal * loss / passiveLosses) : 0
        row.g = allowed
        row.disallowed = loss - allowed
        disallowedTotal += row.disallowed
      }
      row.k = p.gp
    } else {
      if (p.activity >= 0) row.k = p.activity + p.gp
      else { row.i = -p.activity; row.k = p.gp }
    }
    return row
  })
  if (disallowedTotal > 0) issues.push(`Passive losses of $${disallowedTotal.toLocaleString()} from K-1s are not allowed this year and carry to 2026 (Form 8582).`)
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
