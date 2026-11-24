/**
 * Fills the official 2025 New Mexico PIT-1 (public/forms/2025/nm-pit1.pdf: PIT-1 pages 1–2, PIT-ADJ, PIT-RC pages 1–2,
 * from the Taxation and Revenue Department’s 2025 forms). These forms have no fields, so the values are drawn at the
 * positions of their boxes (measured from the forms’ text layout). Pages: 0–1 PIT-1, 2 PIT-ADJ, 3–4 PIT-RC, 5 PIT-CR,
 * 6 PIT-S, 7 PIT-D.
 * Whole dollars with “.00”.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { NmResult } from '../engine/nm2025.ts'
import type { FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

type Draw = NonNullable<FormFill['draw']>[number]
const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const dollars = (n: number): string => { const x = Math.round(n); return `${x < 0 ? '-' : ''}${Math.abs(x)}.00` }
const t = (page: number, x: number, y: number, text: string, size = 9): Draw => ({ page, x, y, text, size })
const money = (page: number, xRight: number, y: number, n: number): Draw => ({ page, x: xRight, y, text: dollars(n), size: 10, right: true })
const X = (page: number, x: number, y: number): Draw => ({ page, x, y, text: 'X', size: 9 })

const P1: Record<string, number> = { '9': 314, '10': 296, '11': 279, '12': 266, '13': 240, '14': 228, '15': 216, '17': 165, '18': 147, '19': 121, '20': 104, '21': 86, '22': 68 }
const P2: Record<string, number> = { '23': 639, '24': 625, '25': 611, '26': 565, '27': 552, '28': 540, '29': 523, '30': 505, '31': 492, '32': 480, '33': 468, '34': 456, '36': 421, '37': 409, '38': 397, '39': 384, '40': 372, '41': 360, '42': 348 }
const ADJ: Record<string, number> = { '1': 590, '6': 494, '9': 435, '10': 417, '13': 278, '15': 254, '16': 242, '17': 230, '18': 218, '21': 182, '24': 146, '25': 134, '28': 98 }
const RC1: Record<string, number> = { '1': 408, '2b': 373, '2c': 356, '2d': 339, '2e': 326, '2f': 314, '2g': 302, '3': 264, '4': 218, '5': 206, '6': 194, '8': 169, '9': 157, '11': 128, '12': 105 }
const RC2: Record<string, number> = { '13': 638, '13a': 625, '14': 605, '15': 564, '16a': 539, '16c': 510, '17a': 480, '17b': 463, '17c': 440, '18a': 338, '18c': 297, '19': 253, '20': 241, '21': 229, '22': 211 }
const RC2B: Record<string, number> = { '23': 181, '24': 168, '25': 156, '26': 132 }
const COUNTS = new Set(['1', '2b', '2c', '2d', '2e', '2f', '2g', '3', '13a', '20'])
const ALWAYS1 = new Set(['9', '12', '17', '18', '22'])
const ALWAYS2 = new Set(['23', '32'])

export function formNmPit1(ret: TaxReturnInput, res: TaxReturnResult, nm: NmResult, preparer?: PreparerInfo | null): FormFill {
  const L = nm.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const d = ret.nm
  const draw: Draw[] = []
  const pages = [0, 1]
  const ssn = digits(ret.taxpayer.ssn)
  const name = (p: TaxReturnInput['taxpayer']): string => upper(`${p.firstName} ${p.lastName}`)

  // ── PIT-1 page 1 ──
  draw.push(t(0, 47, 604, name(ret.taxpayer)), t(0, 314, 604, ssn, 10), t(0, 463, 604, 'R', 10))
  if (d.birthDate.taxpayer.trim()) draw.push(t(0, 494, 604, d.birthDate.taxpayer.trim()))
  if (nm.boxes.taxpayerBlind) draw.push(X(0, 413, 604))
  if (nm.boxes.taxpayer65) draw.push(X(0, 435, 604))
  if (joint || fs === 'mfs') {
    draw.push(t(0, 47, 579, name(ret.spouse)), t(0, 314, 579, digits(ret.spouse.ssn), 10))
    if (joint) draw.push(t(0, 463, 579, 'R', 10))
    if (d.birthDate.spouse.trim()) draw.push(t(0, 494, 579, d.birthDate.spouse.trim()))
    if (nm.boxes.spouseBlind) draw.push(X(0, 413, 579))
    if (nm.boxes.spouse65) draw.push(X(0, 435, 579))
  }
  draw.push(t(0, 47, 543, upper([c.street, c.apt].filter((x) => x.trim()).join(' '))))
  draw.push(t(0, 47, 519, upper(c.city)), t(0, 201, 519, upper(c.state).slice(0, 2)), t(0, 229, 519, digits(c.zip).slice(0, 9)))
  draw.push({ page: 0, x: 70, y: 461, text: String(nm.exemptions).padStart(2, '0'), size: 11, right: true })
  const fsY: Record<TaxReturnInput['filingStatus'], number> = { single: 421, mfj: 409, mfs: 396, hoh: 373, qss: 337 }
  draw.push(X(0, 398.5, fsY[fs]))
  ret.dependents.slice(0, 5).forEach((x, i) => {
    const y = 385 - 12 * i
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ret.taxpayer.lastName
    draw.push(t(0, 40, y, upper(parts.join(' ')), 8), t(0, 112, y, upper(last), 8), t(0, 204, y, digits(x.ssn), 8))
    const dob = (d.dependentBirthDate[x.id] ?? '').trim()
    if (dob) draw.push(t(0, 298, y, dob, 8))
  })
  for (const [k, y] of Object.entries(P1)) if (L[k] || ALWAYS1.has(k)) draw.push(money(0, 572, y, L[k]))
  if (res.deduction.used === 'itemized') draw.push(X(0, 424, 256))
  draw.push(t(0, 424, 136, 'R', 10))

  // ── PIT-1 page 2 ──
  draw.push(t(1, 60, 686, ssn, 10))
  for (const [k, y] of Object.entries(P2)) if (L[k] || ALWAYS2.has(k)) draw.push(money(1, 572, y, L[k]))
  if (L['25']) draw.push(money(1, 405, 594, L['25a']))
  if (L['42'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      draw.push(t(1, 102, 324, digits(dep.routingNumber).slice(0, 9)), t(1, 260, 324, dep.accountNumber.replace(/[^0-9A-Za-z-]/g, '').slice(0, 17)))
      draw.push(X(1, dep.accountType === 'savings' ? 519 : 477, 324), X(1, 518, 312))
    }
  }
  if (d.license.taxpayer.trim()) draw.push(t(1, 40, 212, upper(d.license.taxpayer), 8))
  if (joint && d.license.spouse.trim()) draw.push(t(1, 40, 164, upper(d.license.spouse), 8))
  draw.push(t(1, 160, 118, digits(c.phone).slice(-10)))
  if (ret.usePaidPreparer && preparer) {
    draw.push(t(1, 352, 193, upper(preparer.firmName || preparer.name), 8), t(1, 352, 169, upper(preparer.ptin), 8), t(1, 420, 144, digits(preparer.phone).slice(-10), 8))
  }

  // ── PIT-ADJ ──
  const A = nm.adj
  if (L['11'] + L['15'] > 0) {
    pages.push(2)
    draw.push(t(2, 40, 649, name(ret.taxpayer)), t(2, 428, 652, ssn, 10))
    for (const [k, y] of Object.entries(ADJ)) if (A[k] || k === '6' || k === '28') draw.push(money(2, 572, y, A[k] ?? 0))
  }

  // ── PIT-RC ──
  const R = nm.rc
  if (L['24'] > 0) {
    pages.push(3, 4)
    draw.push(t(3, 40, 639, name(ret.taxpayer)), t(3, 427, 637, ssn, 10))
    for (const y of [470, 458, 446, 434]) {
      draw.push(X(3, 443, y))
      if (joint) draw.push(X(3, 523, y))
    }
    for (const [k, y] of Object.entries(RC1)) {
      const n = R[k] ?? 0
      if (!n && !['1', '2g', '3', '12'].includes(k)) continue
      draw.push(COUNTS.has(k) ? { page: 3, x: 560, y, text: String(n), size: 10, right: true } : money(3, 572, y, n))
    }
    draw.push(t(4, 60, 686, ssn, 10))
    for (const [k, y] of Object.entries(RC2)) {
      const n = R[k] ?? 0
      if (!n && !['13', '13a'].includes(k)) continue
      if (['15', '16a', '16c', '17a', '17b', '17c'].includes(k) && !R['17c']) continue
      if (['18a', '18c'].includes(k) && !R['18c']) continue
      draw.push(COUNTS.has(k) ? { page: 4, x: 560, y, text: String(n), size: 10, right: true } : money(4, 572, y, n))
    }
    if (R['18c']) {
      draw.push(X(4, 551, ({ LA: 398, SF: 386, DA: 374, BL: 363 } as Record<string, number>)[d.county] ?? 398))
      draw.push({ page: 4, x: 556, y: 320, text: String(Math.round(R['18bPct'] * 100)), size: 10, right: true })
    }
    if (R['17c'] && d.rentGovernmentPaid) draw.push(X(4, 523, 523))
    for (const [k, y] of Object.entries(RC2B)) {
      const n = k === '26' ? R['26'] : R[k] ?? 0
      if (n || k === '26') draw.push(money(4, 572, y, n))
    }
  }
  // ── PIT-CR ──
  const cr = d.crCredits.filter((x) => x.code.trim() && (x.applied > 0 || x.refund > 0))
  if (cr.length) {
    pages.push(5)
    draw.push(t(5, 40, 663, name(ret.taxpayer)), t(5, 448, 662, ssn, 10))
    cr.slice(0, 5).forEach((x, i) => {
      const y = 195 - 12 * i
      draw.push(t(5, 60, y, upper(x.code).slice(0, 3), 8), t(5, 124, y, upper(x.approval).slice(0, 30), 8))
      if (x.applied > 0) draw.push({ ...money(5, 424, y, x.applied), size: 8 })
      if (x.refund > 0) draw.push({ ...money(5, 572, y, x.refund), size: 8 })
    })
    draw.push(money(5, 392, 122, L['21']), money(5, 572, 84, L['26']))
  }

  // ── PIT-S ──
  if (ret.dependents.length > 5) {
    pages.push(6)
    draw.push(t(6, 40, 651, name(ret.taxpayer)), t(6, 428, 651, ssn, 10))
    ret.dependents.slice(5, 20).forEach((x, i) => {
      const y = 423 - 24.5 * i
      const parts = x.name.trim().split(/\s+/)
      const last = parts.length > 1 ? parts.pop() ?? '' : ret.taxpayer.lastName
      draw.push(t(6, 104, y, upper(parts.join(' ')), 8), t(6, 238, y, upper(last), 8), t(6, 356, y, digits(x.ssn), 8))
      const dob = (d.dependentBirthDate[x.id] ?? '').trim()
      if (dob) draw.push(t(6, 450, y, dob, 8))
    })
  }
  // ── PIT-D ──
  const D = nm.pitd
  if (L['40'] > 0) {
    pages.push(7)
    draw.push(t(7, 40, 651, name(ret.taxpayer)), t(7, 428, 651, ssn, 10))
    const ys: Record<string, number> = { '1': 566, '2': 542, '3': 519, '4': 495, '5': 472, '6': 449, '7': 425, '8': 402, '9': 378, '10': 355, '11': 331, '12': 231, '13': 207, '14': 184, '15': 160, '16': 137, '17': 103, '18': 76 }
    for (const [k, y] of Object.entries(ys)) if (D[k] || k === '1' || k === '18') draw.push(money(7, 569, y - 4, D[k] ?? 0))
    if (D['11']) {
      if (/^[1-6]$/.test(d.party.taxpayer.trim())) draw.push(t(7, 392, 285, d.party.taxpayer.trim(), 10))
      if (joint && /^[1-6]$/.test(d.party.spouse.trim())) draw.push(t(7, 392, 276, d.party.spouse.trim(), 10))
    }
  }
  return { id: 'nmpit1', file: 'nm-pit1.pdf', title: 'New Mexico PIT-1', values: {}, draw, pages }
}

/** PIT-CR Supplemental (credits 6–30; a flat page, drawn). */
export function formNmPitCrSupplemental(ret: TaxReturnInput, nm: NmResult): FormFill[] {
  void nm
  const all = ret.nm.crCredits.filter((x) => x.code.trim() && (x.applied > 0 || x.refund > 0)).slice(5)
  const sheets: FormFill[] = []
  for (let k = 0; k < all.length; k += 25) sheets.push(pitCrSheet(ret, all.slice(k, k + 25), k / 25))
  return sheets
}

/** One PIT-CR Supplemental page: up to 25 credits on the rows printed 6–30 (a second sheet holds credits 31–55, and so on). */
function pitCrSheet(ret: TaxReturnInput, cr: NonNullable<TaxReturnInput['nm']['crCredits']>, n: number): FormFill {
  const draw: Draw[] = [t(0, 40, 666, upper(`${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)), t(0, 449, 661, digits(ret.taxpayer.ssn), 10)]
  if (n > 0) draw.push(t(0, 330, 666, `SHEET ${n + 1}: CREDITS ${6 + 25 * n}–${30 + 25 * n}`, 8))
  cr.forEach((x, i) => {
    const y = 565 - 11.96 * i
    draw.push(t(0, 60, y, upper(x.code).slice(0, 3), 8), t(0, 124, y, upper(x.approval).slice(0, 30), 8))
    if (x.applied > 0) draw.push({ ...money(0, 424, y, x.applied), size: 8 })
    if (x.refund > 0) draw.push({ ...money(0, 572, y, x.refund), size: 8 })
  })
  draw.push(money(0, 392, 207, cr.reduce((s, x) => s + Math.max(0, x.applied), 0)), money(0, 572, 179, cr.reduce((s, x) => s + Math.max(0, x.refund), 0)))
  return { id: n === 0 ? 'nm-pitcrs' : `nm-pitcrs-${n + 1}`, file: 'nm-pitcrs.pdf', title: n === 0 ? 'New Mexico PIT-CR Supplemental' : `New Mexico PIT-CR Supplemental (sheet ${n + 1})`, values: {}, draw }
}

export function buildNmPacket(ret: TaxReturnInput, res: TaxReturnResult, nm: NmResult, preparer?: PreparerInfo | null): FormPacket {
  const drawn = ['Schedule PIT-ADJ', 'Schedule PIT-RC', 'Schedule PIT-S (dependents 6 and up)', 'Schedule PIT-D']
  const notIncluded = nm.attach.filter((x) => !drawn.includes(x))
  notIncluded.push('Driver’s license or state ID number, state and expiration date under each signature (or NONE / DECLINED)')
  return { forms: [formNmPit1(ret, res, nm, preparer), ...formNmPitCrSupplemental(ret, nm)], notIncluded }
}
