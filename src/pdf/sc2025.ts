/**
 * Prints a computed South Carolina return onto the official 2025 SC1040 (Rev. 4/21/25), taken from the SCDOR 2025
 * IIT packet (public/forms/2025/sc1040.pdf, 3 pages). The published SC1040 has no fillable fields, so the values
 * are drawn at the positions of its boxes. Whole dollars; the form prints the cents.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { ScResult } from '../engine/sc2025.ts'
import type { FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

type Draw = NonNullable<FormFill['draw']>[number]
const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const money = (n: number | undefined, keepZero = false): string => {
  const v = Math.round(n ?? 0)
  if (v === 0) return keepZero ? '0' : ''
  return v.toLocaleString('en-US')
}
const ssnText = (ssn: string): string => {
  const s = digits(ssn)
  return s.length === 9 ? `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}` : s
}
/** y is measured from the top of the page, as in the layout; PDF coordinates start at the bottom. */
const at = (page: number, x: number, top: number, text: string, opts: { size?: number; right?: boolean } = {}): Draw => ({ page, x, y: 792 - top, text, ...opts })
const box = (page: number, x: number, top: number): Draw => at(page, x + 1.2, top + 7.2, 'X', { size: 9 })

/** Inner column (lettered lines) ends before x 456; outer column (numbered totals) before x 563. Tops are the label rows. */
const P2_INNER: Record<string, number> = {
  a: 122, b: 136, c: 150, d: 163, e: 177, f: 229, g: 242, h: 269, i: 282, j: 296, k: 322, l: 336, m: 349, n: 363, o: 376,
  'p-1': 403, 'p-2': 416, 'p-3': 430, 'p-4': 457, 'p-5': 470, 'p-6': 483, 'q-1': 510, 'q-2': 524, r: 537, s: 550, t: 564, u: 577, v: 591, w: 604,
  '6': 658, '7': 671, '8': 685, '9': 698
}
const P2_OUTER: Record<string, number> = { '1': 96, '2': 190, '3': 203, '4': 617, '5': 644, '10': 711 }
const P3_INNER: Record<string, number> = { '11': 81, '12': 93, '13': 105, '16': 154, '17': 166, '18': 178, '19': 190, '20': 202, '21': 214, '22a': 238, '22b': 250, '22c': 262, '22d': 274, '26': 370, '27': 406, '28': 418 }
const P3_OUTER: Record<string, number> = { '14': 117, '15': 129, '22': 298, '23': 322, '24': 334, '25': 346, '29': 430, '30': 454, '31': 466, '32': 478, '33': 502, '34': 514 }

export function formSc1040(ret: TaxReturnInput, res: TaxReturnResult, sc: ScResult): FormFill {
  const L = sc.lines
  const d = ret.sc
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const draw: Draw[] = []
  // ── Page 1 ──
  draw.push(at(0, 50, 170, ssnText(ret.taxpayer.ssn), { size: 11 }))
  if (joint || fs === 'mfs') draw.push(at(0, 50, 206, ssnText(ret.spouse.ssn), { size: 11 }))
  draw.push(at(0, 40, 313, upper(ret.taxpayer.firstName)), at(0, 286, 313, upper(ret.taxpayer.lastName)))
  if (joint) draw.push(at(0, 40, 337, upper(ret.spouse.firstName)), at(0, 286, 337, upper(ret.spouse.lastName)))
  draw.push(at(0, 116, 361, upper([c.street, c.apt].filter((x) => x.trim()).join(' '))), at(0, 516, 361, digits(d.countyCode)))
  draw.push(at(0, 40, 385, upper(c.city)), at(0, 286, 385, upper(c.state).slice(0, 2)), at(0, 318, 385, digits(c.zip).slice(0, 9)))
  const phone = digits(c.phone).slice(-10)
  if (phone) draw.push(at(0, 412, 385, phone.length === 10 ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` : phone))
  const statusBox: Record<string, [number, number]> = { single: [174, 551], mfj: [174, 569], mfs: [283, 551], hoh: [283, 569], qss: [391, 569] }
  const [sx, sy] = statusBox[fs]
  draw.push(box(0, sx, sy))
  if (fs === 'mfs') draw.push(at(0, 468, 557, ssnText(ret.spouse.ssn), { size: 8 }))
  draw.push(at(0, 545, 611, String(sc.dependents.count), { right: true }), at(0, 545, 625, String(sc.dependents.under6), { right: true }), at(0, 545, 640, String(sc.dependents.age65), { right: true }))
  ret.dependents.slice(0, 4).forEach((x, i) => {
    const top = 689 + i * 13
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    draw.push(at(0, 38, top, upper(parts.join(' ')), { size: 8 }), at(0, 140, top, upper(last), { size: 8 }), at(0, 255, top, ssnText(x.ssn), { size: 8 }),
      at(0, 354, top, upper(x.relationship), { size: 8 }), at(0, 462, top, `born ${2025 - Math.max(0, Math.floor(x.age))}`, { size: 8 }))
  })
  // ── Page 2 ──
  draw.push(at(1, 406, 77, ssnText(ret.taxpayer.ssn), { size: 8 }))
  for (const [k, top] of Object.entries(P2_INNER)) if (L[k]) draw.push(at(1, 455, top + 8.5, money(L[k]), { right: true }))
  for (const [k, top] of Object.entries(P2_OUTER)) draw.push(at(1, 562, top + 8.5, money(L[k], true), { right: true }))
  if (d.birthDate.taxpayer && (L['p-1'] || L['p-4'] || L['q-1'])) for (const k of ['p-1', 'p-4', 'q-1']) if (L[k]) draw.push(at(1, 225, P2_INNER[k] + 8, d.birthDate.taxpayer, { size: 8 }))
  if (d.birthDate.spouse && joint) for (const k of ['p-2', 'p-5', 'q-2']) if (L[k]) draw.push(at(1, 225, P2_INNER[k] + 8, d.birthDate.spouse, { size: 8 }))
  if (L['s']) draw.push(at(1, 238, P2_INNER['s'] + 8, String(Math.floor(d.subsistenceDays)), { size: 8 }))
  // ── Page 3 ──
  draw.push(at(2, 406, 56, ssnText(ret.taxpayer.ssn), { size: 8 }))
  for (const [k, top] of Object.entries(P3_INNER)) if (L[k]) draw.push(at(2, 456, top + 8.5, money(L[k]), { right: true }))
  for (const [k, top] of Object.entries(P3_OUTER)) if (L[k] || ['15', '23'].includes(k)) draw.push(at(2, 562, top + 8.5, money(L[k], true), { right: true }))
  if (L['26'] === 0) draw.push(box(2, 274, 395))
  if (L['30'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      draw.push(box(2, 120, 538), box(2, dep.accountType === 'savings' ? 205 : 132, 588))
      draw.push(at(2, 95, 609, digits(dep.routingNumber).slice(0, 9), { size: 10 }), at(2, 400, 609, dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17), { size: 10 }))
    } else draw.push(box(2, 373, 538))
  }
  return { id: 'sc1040', file: 'sc1040.pdf', title: 'South Carolina SC1040', values: {}, draw }
}

/** SC1040TC (Rev. 3/21/25): a flat form, drawn. Page 1 is the credit list; page 2 holds two worksheets for taxes paid to another state. */
export function formSc1040tc(ret: TaxReturnInput, sc: ScResult): FormFill | null {
  const tc = sc.tc
  if (!tc) return null
  const draw: Draw[] = []
  const tp = ret.taxpayer
  draw.push(at(0, 40, 147, upper(`${tp.firstName} ${tp.lastName}`)), at(0, 466, 147, ssnText(tp.ssn), { size: 10 }))
  const row = (n: number): number => 252 + 24 * (n - 1) + 7
  const amt = (n: number, v: number, keep = false): void => { const t = money(v, keep); if (t) draw.push(at(0, 552, row(n), t, { right: true })) }
  for (const k of [1, 2, 3, 4, 5]) amt(k, tc.lines[String(k)])
  tc.other.forEach((o, i) => {
    const n = 6 + i
    draw.push(at(0, 56, row(n), upper(o.description).slice(0, 45), { size: 9 }))
    if (o.code) draw.push(at(0, 366, row(n), o.code, { size: 10 }))
    amt(n, o.amount)
  })
  amt(16, tc.lines['16'], true); amt(17, tc.lines['17'], true); amt(18, tc.lines['18'], true)
  const pages = [0]
  tc.worksheets.forEach((w, i) => {
    pages.push(1)
    const top0 = i === 0 ? 0 : 287
    draw.push(at(1, 322, 150 + top0, upper(w.state)))
    const lines: [number, string][] = [[240, money(w.l1, true)], [265, money(w.l2, true)], [290, w.l3.toFixed(2)], [315, money(w.l4, true)], [340, money(w.l5, true)], [366, money(w.l6, true)], [391, money(w.l7, true)]]
    for (const [top, t] of lines) draw.push(at(1, 550, top + top0 + 8, t, { right: true }))
  })
  return { id: 'sc1040tc', file: 'sc-1040tc.pdf', title: 'South Carolina SC1040TC', values: {}, draw, pages: [...new Set(pages)] }
}

export function buildScPacket(ret: TaxReturnInput, res: TaxReturnResult, sc: ScResult, preparer?: PreparerInfo | null): FormPacket {
  void preparer
  const forms: FormFill[] = [formSc1040(ret, res, sc), formSc1040tc(ret, sc)].filter((x): x is FormFill => x !== null)
  const notIncluded = [...sc.attach]
  if (sc.dependents.count > 0) notIncluded.push('Page 1: each dependent’s full date of birth (only the year is printed)')
  if (sc.dependents.count > 4) notIncluded.push('Page 1: dependents after the fourth on an attached list')
  if (sc.lines['e'] > 0) notIncluded.push('Line e: attach an explanation of other additions')
  if (sc.lines['13'] > 0 && !sc.tc) notIncluded.push('SC1040TC: list your credits in the South Carolina section to fill it in (only the line 13 total is entered)')
  if (sc.tc && ret.sc.tc.otherStates.filter((o) => o.state.trim() && (o.income > 0 || o.tax > 0)).length > 0) notIncluded.push('With SC1040TC, a copy of each return filed with the other state and a complete copy of your federal return')
  return { forms, notIncluded }
}
