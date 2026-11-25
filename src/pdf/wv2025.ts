/**
 * Fills the official 2025 West Virginia IT-140 (public/forms/2025/wv-it140.pdf: the IT-140, Schedule M, the Tax Credit
 * Recap Schedule and Schedule FTC-1 pages of the Tax Division’s 2025 forms and instructions booklet). These pages have
 * no form fields, so the values are drawn at the positions of their boxes (positions measured from the booklet’s text
 * layout). Pages: 0–1 IT-140, 2–3 Schedule M, 4–5 RECAP, 6 FTC-1. Whole dollars (the cents are printed).
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { WvResult } from '../engine/wv2025.ts'
import type { FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

type Draw = NonNullable<FormFill['draw']>[number]
const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const amt = (n: number): string => { const x = Math.round(n); return x < 0 ? `-${-x}` : String(x) }
const t = (page: number, x: number, y: number, text: string, size = 9): Draw => ({ page, x, y, text, size })
const money = (page: number, xRight: number, y: number, n: number): Draw => ({ page, x: xRight, y, text: amt(n), size: 10, right: true })
const X = (page: number, x: number, y: number): Draw => ({ page, x, y, text: 'X', size: 10 })

/** Baselines (points from the bottom) of the money boxes. */
const P1: Record<string, number> = { '1': 265, '2': 241, '3': 217, '4': 193, '5': 169, '6': 145, '7': 121, '8': 98 }
const P2: Record<string, number> = {
  '9': 709, '10': 685, '11': 661, '12': 637, '13': 613, '14': 589, '15': 565, '16': 541, '17': 517, '18': 493, '19': 469, '20': 445,
  '21': 409, '22': 385, '23': 361, '24': 337, '25': 313, '26': 277, '27': 253, '28': 230
}
const M1: Record<string, number> = {
  '29': 685, '30': 661, '31': 637, '32': 613, '33': 553, '34': 481, '35': 457, '36': 433, '37': 409, '38': 385, '39': 361, '40': 337, '41': 313,
  '42': 289, '43': 265, '44': 241, '45': 193, '46': 169
}
const RECAP: Record<string, number> = { '1': 613, '2': 589, '18': 205 }
const ALWAYS1 = new Set(['1', '4', '6', '7', '8'])
const ALWAYS2 = new Set(['10', '14', '23'])

export function formWvIt140(ret: TaxReturnInput, res: TaxReturnResult, wv: WvResult, preparer?: PreparerInfo | null): FormFill {
  const L = wv.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const d = ret.wv
  const draw: Draw[] = []
  const pages = [0, 1]

  // ── IT-140 page 1 ──
  draw.push(t(0, 83, 703, digits(ret.taxpayer.ssn), 10))
  draw.push(t(0, 83, 676, upper(ret.taxpayer.lastName)), t(0, 400, 676, upper(ret.taxpayer.firstName)))
  if (joint || fs === 'mfs') {
    draw.push(t(0, 363, 703, digits(ret.spouse.ssn), 10))
    draw.push(t(0, 83, 653, upper(ret.spouse.lastName)), t(0, 400, 653, upper(ret.spouse.firstName)))
  }
  draw.push(t(0, 83, 628, upper(c.street)))
  if (c.apt.trim()) draw.push(t(0, 363, 628, upper(c.apt)))
  draw.push(t(0, 83, 604, upper(c.city)), t(0, 330, 604, upper(c.state).slice(0, 2)), t(0, 404, 604, digits(c.zip).slice(0, 9)))
  draw.push(t(0, 83, 583, digits(c.phone).slice(-10)))
  const box: Record<TaxReturnInput['filingStatus'], number> = { single: 130, hoh: 190, mfj: 262, mfs: 336, qss: 498 }
  draw.push(X(0, box[fs], 530))
  const ex = wv.exemptions
  const exBox = (y: number, n: number): void => { if (n) draw.push({ page: 0, x: 570, y, text: String(n), size: 10, right: true }) }
  exBox(496, ex.a)
  exBox(475, ex.b)
  exBox(451, ex.c)
  exBox(296, ex.e)
  ret.dependents.slice(0, 4).forEach((x, i) => {
    const y = 413 - 23.8 * i
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ret.taxpayer.lastName
    draw.push(t(0, 40, y, upper(parts.join(' '))), t(0, 228, y, upper(last)), t(0, 401, y, digits(x.ssn)))
    const dob = (d.dependentBirthDate[x.id] ?? '').trim()
    if (dob) draw.push(t(0, 494, y, dob))
  })
  if (ex.e) draw.push({ page: 0, x: 288, y: 143, text: String(ex.e), size: 9, right: true })
  for (const [k, y] of Object.entries(P1)) if (L[k] || ALWAYS1.has(k)) draw.push(money(0, 553, y, L[k]))
  draw.push(X(0, wv.usedTable ? 60 : 125, 88))

  // ── IT-140 page 2 ──
  draw.push(t(1, 133, 735, upper(ret.taxpayer.lastName)), t(1, 443, 735, digits(ret.taxpayer.ssn)))
  for (const [k, y] of Object.entries(P2)) if (L[k] || ALWAYS2.has(k)) draw.push(money(1, k === '24' ? 533 : 536, y, L[k]))
  if (L['21A']) draw.push(money(1, 176, 416, L['21A']))
  if (L['26A']) draw.push(money(1, 176, 285, L['26A']))
  if (L['26B']) draw.push(money(1, 300, 285, L['26B']))
  if (L['26C']) draw.push(money(1, 400, 285, L['26C']))
  if (L['13'] === 0) draw.push(X(1, 303, 611))
  if (L['28'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      draw.push(X(1, dep.accountType === 'savings' ? 211 : 124, 201))
      draw.push(t(1, 292, 209, digits(dep.routingNumber).slice(0, 9), 10), t(1, 392, 209, dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17), 10))
    }
  }
  if (ret.usePaidPreparer && preparer) {
    draw.push(X(1, 246, 170))
    draw.push(t(1, 41, 88, upper(preparer.name), 8), t(1, 187, 88, upper(preparer.firmName), 8), t(1, 268, 113, digits(preparer.firmEin), 8))
  }

  // ── Schedule M ──
  const M = wv.m
  if (L['2'] + L['3'] > 0) {
    pages.push(2, 3)
    for (const [k, y] of Object.entries(M1)) {
      if (M.A[k]) draw.push(money(2, 453, y, M.A[k]))
      if (joint && M.B[k]) draw.push(money(2, 554, y, M.B[k]))
    }
    const owners = joint ? (['taxpayer', 'spouse'] as const) : (['taxpayer'] as const)
    for (const o of owners) {
      const cx = o === 'taxpayer' ? 247 : 341
      const m33 = wv.m33[o]
      if (m33.a) draw.push(money(2, cx, 577, m33.a))
      if (m33.b) draw.push(money(2, cx, 553, m33.b))
      const m34 = wv.m34[o]
      if (m34.a) { draw.push(money(2, cx, 529, m34.a), money(2, cx, 505, m34.b), money(2, cx, 481, m34.c)) }
      const s = wv.m47[o]
      if (s) {
        const y = o === 'taxpayer' ? 649 : 625
        if (s.year) draw.push(t(3, 60, y, s.year))
        draw.push(money(3, 247, y, s.c), money(3, 341, y, s.d))
      }
    }
    if (M.A['47']) draw.push(money(3, 453, 649, M.A['47']))
    if (M.B['47']) draw.push(money(3, 554, 625, M.B['47']))
    draw.push(money(3, 453, 577, M.A['49']))
    if (joint) draw.push(money(3, 554, 577, M.B['49']))
    draw.push(money(3, 554, 553, L['3']))
    if (L['2']) { draw.push(money(3, 554, 469, L['2']), money(3, 554, 277, L['2'])) }
  }

  // ── RECAP and FTC-1 ──
  const R = wv.recap
  if (R['total'] > 0) {
    pages.push(4, 5)
    for (const [k, y] of Object.entries(RECAP)) if (R[k]) draw.push(money(4, 549, y - 3, R[k]))
    draw.push(money(5, 549, 538, R['total']))
  }
  if (R['2'] > 0) {
    pages.push(6)
    const F = wv.ftc
    draw.push(money(6, 551, 637, F['1']), money(6, 551, 613, F['2']), money(6, 551, 589, F['3']), money(6, 551, 565, F['4']))
    draw.push({ page: 6, x: 565, y: 547, text: String(F['5']), size: 10, right: true }, { page: 6, x: 565, y: 523, text: `${Math.round(F['6'] * 100)}%`, size: 10, right: true })
    draw.push(money(6, 551, 493, F['7']), money(6, 551, 469, F['8']))
  }
  void res
  return { id: 'wvit140', file: 'wv-it140.pdf', title: 'West Virginia IT-140', values: {}, draw, pages }
}

/** Schedule E has no form fields; one page per state, values drawn at the answer lines. */
export function formsWvSchE(wv: WvResult): FormFill[] {
  const Y: Record<string, number> = { '1': 319, '2': 340, '3': 364, '4': 388, '5': 412, '6': 440, '7': 460, '8': 484, '9': 508, '10': 532 }
  return wv.schE.map((x, i) => {
    const draw: NonNullable<FormFill['draw']> = [
      { page: 0, x: 44, y: 792 - 131, text: 'X', size: 10 },
      { page: 0, x: 222, y: 792 - 312, text: x.state, size: 10 }
    ]
    for (const [k, y] of Object.entries(Y)) draw.push({ page: 0, x: 545, y: 792 - y, text: String(Math.round(x.lines[k])), right: true, size: 10 })
    return { id: `wvsche${i + 1}`, file: 'wv-sche.pdf', title: `West Virginia Schedule E (${x.state})`, values: {}, draw }
  })
}

export function buildWvPacket(ret: TaxReturnInput, res: TaxReturnResult, wv: WvResult, preparer?: PreparerInfo | null): FormPacket {
  const notIncluded = wv.attach.filter((x) => !['Schedule M', 'Tax Credit Recap Schedule (RECAP)', 'Schedule FTC-1 (Family Tax Credit)'].includes(x))
  notIncluded.push('Print in black ink on single-sided pages; do not staple the barcode area')
  return { forms: [formWvIt140(ret, res, wv, preparer), ...formsWvSchE(wv), ...dependentsStatement(ret, 4, 'Schedule DP, Dependents (continued)', 'st-wv-deps')], notIncluded }
}
