/**
 * Prints a computed Connecticut return onto the official 2025 Form CT-1040 (Rev. 12/25, public/forms/2025/ct1040.pdf)
 * and Schedule CT-EITC (Rev. 12/25, public/forms/2025/ct-eitc.pdf). Both are published without fillable fields, so
 * the values are drawn at the positions of their boxes (positions measured from the forms’ text layout). Whole
 * dollars; the forms print the cents.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { CtResult } from '../engine/ct2025.ts'
import type { FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

type Draw = NonNullable<FormFill['draw']>[number]
const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const money = (n: number | undefined, keepZero = false): string => {
  const v = Math.round(n ?? 0)
  if (v === 0) return keepZero ? '0' : ''
  return v.toLocaleString('en-US')
}
const firstAndInitial = (s: string): [string, string] => {
  const parts = upper(s).split(/\s+/).filter(Boolean)
  if (parts.length > 1 && parts[parts.length - 1].replace('.', '').length === 1) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '')]
  return [parts.join(' '), '']
}
const splitName = (name: string): [string, string] => {
  const parts = name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts.pop() ?? '' : ''
  return [parts.join(' '), last]
}

/** Text drawn with its baseline at `base` points from the top of a page of height `h`. */
const at = (h: number) => (page: number, x: number, base: number, text: string, opts: { size?: number; right?: boolean } = {}): Draw => ({ page, x, y: h - base, text, ...opts })
const ct = at(774)
const ei = at(792)
/** Characters spread over comb cells starting at x0 (cell width w); '-' cells are skipped. */
function comb(draw: (page: number, x: number, base: number, text: string, opts?: { size?: number }) => Draw, page: number, x0: number, w: number, base: number, pattern: string, value: string, size = 10): Draw[] {
  const out: Draw[] = []
  let i = 0
  for (let c = 0; c < pattern.length && i < value.length; c++) {
    if (pattern[c] === '-') continue
    out.push(draw(page, x0 + c * w, base, value[i++], { size }))
  }
  return out
}

/** Baselines (points from the top) of the money boxes, right edge x 543. */
const P1: Record<string, number> = { '1': 411, '2': 431, '3': 451, '4': 471, '5': 491, '6': 511, '7': 531, '8': 551, '9': 571, '10': 591, '11': 611.5, '12': 631.5, '13': 651.5, '14': 671.5, '15': 691.5, '16': 711.5 }
const P2: Record<string, number> = { '17': 79, '18f': 197, '18': 212.5, '19': 234, '20': 248.5, '20a': 263.5, '20b': 278, '20c': 292.5, '20d': 307.5, '21': 322, '22': 337, '23': 351.5, '24': 372.5, '24a': 384.5, '25': 404.5, '26': 465.5, '27': 482, '28': 501, '29': 517, '30': 533.5 }
const P3: Record<string, number> = { '31': 111.5, '32': 131.5, '33': 151, '34': 166.5, '35': 181.5, '36': 201, '36a': 216.5, '37': 231.5, '38': 247, '39': 262, '40': 277, '41': 292.5, '42': 307.5, '43': 322.5, '44': 338, '45': 353, '46': 368, '47': 382, '48': 399, '48a': 414, '48b': 429.5, '48c': 449, '48d': 468, '49': 479.5, '50': 495 }
const P4: Record<string, number> = { '60': 130.5, '61': 161, '62': 191, '63': 221, '65': 256.5, '67': 302.5, '68': 330.5, '69a': 397, '69b': 413.5, '69c': 430, '69d': 446.5, '69': 474 }

export function formCt1040(ret: TaxReturnInput, res: TaxReturnResult, ct1: CtResult, preparer?: PreparerInfo | null): FormFill {
  const L = ct1.lines
  const d = ret.ct
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const draw: Draw[] = []
  const X = (page: number, x: number, base: number): Draw => ct(page, x, base, 'X', { size: 9 })

  // ── Page 1 header ──
  const box: Record<string, [number, number]> = { single: [58, 110], hoh: [175, 110], mfs: [295, 110], mfj: [58, 126], qss: [175, 126] }
  draw.push(X(0, ...box[fs]))
  if (fs === 'mfs') {
    draw.push(ct(0, 415, 117, upper(`${ret.spouse.firstName} ${ret.spouse.lastName}`), { size: 9 }))
  }
  draw.push(...comb(ct, 0, 60, 13.85, 154, '###-##-####', digits(ret.taxpayer.ssn)))
  if (joint || fs === 'mfs') draw.push(...comb(ct, 0, 325, 13.85, 154, '###-##-####', digits(ret.spouse.ssn)))
  const [tf, ti] = firstAndInitial(ret.taxpayer.firstName)
  draw.push(ct(0, 57, 183, tf), ct(0, 231, 183, ti), ct(0, 274, 183, upper(ret.taxpayer.lastName)))
  if (joint) {
    const [sf, si] = firstAndInitial(ret.spouse.firstName)
    draw.push(ct(0, 57, 212, sf), ct(0, 231, 212, si), ct(0, 274, 212, upper(ret.spouse.lastName)))
  }
  draw.push(ct(0, 57, 241, upper(c.street)), ct(0, 324, 241, upper(c.apt)))
  draw.push(ct(0, 57, 270, upper(c.city)), ct(0, 324, 270, upper(c.state).slice(0, 2)), ct(0, 382, 270, digits(c.zip).length === 9 ? `${digits(c.zip).slice(0, 5)}-${digits(c.zip).slice(5)}` : digits(c.zip).slice(0, 5)))
  if (d.townOfResidence.trim()) draw.push(ct(0, 57, 299, upper(d.townOfResidence)))
  if (ret.dependents.length > 0) draw.push(X(0, 90, 334))
  // ── Lines 1–16 ──
  for (const [k, base] of Object.entries(P1)) {
    const keep = ['1', '3', '5', '6', '8', '10', '12', '14', '15', '16'].includes(k)
    if (L[k] || keep) draw.push(ct(0, 543, base, money(L[k], keep), { right: true }))
  }

  // ── Page 2 ──
  draw.push(...comb(ct, 1, 378, 13.4, 45, '###-##-####', digits(ret.taxpayer.ssn)))
  const rows = [122, 137.5, 152.5, 168, 183]
  ct1.withholding.slice(0, 5).forEach((w, i) => {
    draw.push(...comb(ct, 1, 109, 16.8, rows[i], '#########', digits(w.ein)))
    draw.push(ct(1, 378, rows[i], money(w.wages), { right: true }), ct(1, 543, rows[i], money(w.tax), { right: true }))
  })
  for (const [k, base] of Object.entries(P2)) {
    const keep = ['17', '18', '21'].includes(k)
    if (L[k] || keep) draw.push(ct(1, 543, base, money(L[k], keep), { right: true }))
  }
  if (L['25'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      draw.push(X(1, dep.accountType === 'savings' ? 177 : 107, 419))
      draw.push(...comb(ct, 1, 121, 16.7, 436, '#########', digits(dep.routingNumber)))
      draw.push(...comb(ct, 1, 306, 14.6, 421, '#################', dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)))
    }
  }
  const ph = digits(c.phone).slice(-10)
  if (ph.length === 10) draw.push(ct(1, 425, 592, `${ph.slice(0, 3)}-${ph.slice(3, 6)}-${ph.slice(6)}`, { size: 9 }))
  if (ret.usePaidPreparer && preparer) {
    draw.push(ct(1, 76, 664, upper(preparer.name), { size: 8 }), ct(1, 76, 689, upper([preparer.firmName, preparer.firmAddress].filter(Boolean).join(', ')).slice(0, 60), { size: 8 }))
    draw.push(ct(1, 408, 689, preparer.ptin.toUpperCase(), { size: 8 }), ct(1, 305, 664, preparer.firmEin, { size: 8 }))
  }

  // ── Page 3: Schedule 1 ──
  draw.push(...comb(ct, 2, 378, 13.4, 45, '###-##-####', digits(ret.taxpayer.ssn)))
  for (const [k, base] of Object.entries(P3)) if (L[k] || k === '38' || k === '50') draw.push(ct(2, 543, base, money(L[k], true), { right: true }))
  if (L['37'] > 0) draw.push(ct(2, 150, P3['37'], upper(d.otherAddition.description).slice(0, 45), { size: 8 }))
  if (L['49'] > 0) draw.push(ct(2, 200, P3['49'], upper(d.otherSubtraction.description).slice(0, 35), { size: 8 }))
  // ── Page 3: Schedule 2 (columns A and B) ──
  const s2 = ct1.sch2
  if (s2) {
    draw.push(ct(2, 474, 544, money(s2.line51, true), { right: true }))
    const juris = d.otherStates.filter((o) => (o.name.trim() || o.code.trim()) && o.tax > 0).slice(0, 2)
    s2.cols.forEach((c, i) => {
      const [nameX, codeX, right, dot] = i === 0 ? [318, 401, 408, 340] : [436, 516, 525, 458]
      draw.push(ct(2, nameX, 587, upper(juris[i].name).slice(0, 14), { size: 7 }), ct(2, codeX, 587, upper(juris[i].code).slice(0, 2), { size: 9 }))
      draw.push(ct(2, right, 613, money(c['53'], true), { right: true }))
      const [whole, frac] = c['54'].toFixed(4).split('.')
      draw.push(ct(2, dot - 1, 630, whole, { right: true }), ct(2, dot + 4, 630, frac))
      draw.push(ct(2, right, 652, money(c['55'], true), { right: true }), ct(2, right, 669.5, money(c['56'], true), { right: true }))
      draw.push(ct(2, right, 686.5, money(c['57'], true), { right: true }), ct(2, right, 703.5, money(c['58'], true), { right: true }))
    })
    draw.push(ct(2, 470, 722.5, money(s2.line59, true), { right: true }))
  }

  // ── Page 4: Schedule 3 and use tax ──
  draw.push(...comb(ct, 3, 378, 13.4, 45, '###-##-####', digits(ret.taxpayer.ssn)))
  const S = ct1.sch3
  const props: [string, typeof d.residence][] = [['60', d.residence], ['61', d.auto1], ['62', d.auto2]]
  for (const [k, p] of props) {
    if (!S[k]) continue
    draw.push(ct(3, 130, P4[k], upper(p.town).slice(0, 16), { size: 8 }), ct(3, 199, P4[k], upper(p.description).slice(0, 34), { size: 8 }))
    draw.push(...comb(ct, 3, 358, 9.6, P4[k] - 7, '##-##-####', digits(p.datePaid).slice(0, 8), 8))
    draw.push(ct(3, 543, P4[k], money(S[k]), { right: true }))
  }
  if (S['63'] > 0) {
    draw.push(ct(3, 543, P4['63'], money(S['63'], true), { right: true }), ct(3, 543, P4['65'], money(S['65'], true), { right: true }))
    if (S['66'] > 0) draw.push(ct(3, 518, 284, S['66'] >= 1 ? '1.00' : String(Math.round(S['66'] * 100)).padStart(2, '0'), { size: 10 }))
    draw.push(ct(3, 543, P4['67'], money(S['67'], true), { right: true }), ct(3, 543, P4['68'], money(S['68'], true), { right: true }))
  }
  draw.push(ct(3, 543, P4['69b'], money(L['15']), { right: true }), ct(3, 543, P4['69'], money(L['15'], true), { right: true }))
  void res
  return { id: 'ct1040', file: 'ct1040.pdf', title: 'Connecticut Form CT-1040', values: {}, draw }
}

export function formCtEitc(ret: TaxReturnInput, ct1: CtResult, res?: TaxReturnResult): FormFill {
  const E = ct1.eitc
  const draw: Draw[] = []
  const X = (page: number, x: number, base: number): Draw => ei(page, x, base, 'X', { size: 9 })
  draw.push(...comb(ei, 0, 366, 13.6, 78, '###-##-####', digits(ret.taxpayer.ssn)), ...comb(ei, 1, 369, 13.5, 50, '###-##-####', digits(ret.taxpayer.ssn)))
  draw.push(X(0, 305, 178), X(0, 468, 199), X(0, 460, 220))
  const kids = ct1.eitcChildren > 0 ? ret.dependents.filter((x) => x.childRelationship && x.monthsLivedWithYou > 6 && (x.age < 19 || (x.student && x.age < 24) || x.disabled)).slice(0, 3) : []
  draw.push(X(0, kids.length ? 333 : 448, 251))
  kids.forEach((k, i) => {
    const dy = i * 127.5
    const [first, last] = splitName(k.name)
    const [fn, mi] = firstAndInitial(first)
    draw.push(ei(0, 110, 311 + dy, fn), ei(0, 290, 311 + dy, mi), ei(0, 332, 311 + dy, upper(last)))
    draw.push(...comb(ei, 0, 60, 12.6, 340 + dy, '###-##-####', digits(k.ssn)))
    draw.push(ei(0, 218, 340 + dy, String(2025 - Math.max(0, Math.floor(k.age)))), ei(0, 278, 340 + dy, /son|daughter|child/i.test(k.relationship) ? '1' : /niece|nephew/i.test(k.relationship) ? '2' : /grand/i.test(k.relationship) ? '3' : /foster/i.test(k.relationship) ? '4' : '5'))
    draw.push(ei(0, 467, 340 + dy, String(Math.min(12, k.monthsLivedWithYou))))
    if (k.student) draw.push(X(0, 439, 364 + dy))
    if (k.disabled) draw.push(X(0, 439, 383 + dy))
  })
  // Page 2: wages with Connecticut withholding are on CT-1040; questions 6, 7 and 11.
  const owners = ret.filingStatus === 'mfj' ? ['taxpayer', 'spouse'] : ['taxpayer']
  const unw = ret.w2s.filter((w) => owners.includes(w.owner) && !(ret.ct.w2[w.id]?.stateTax) && w.wages > 0)
  const biz = (res?.scheduleC ?? []).filter((b) => owners.includes(b.owner) && b.netProfit !== 0)
  draw.push(X(1, unw.length ? 335 : 395, 104), X(1, biz.length || ret.businesses.length ? 407 : 471, 250), X(1, 238, 507))
  // Lines 6a–6c: W-2s without Connecticut withholding; lines 7a–7c: self-employment.
  const ein = (s: string): string => { const d = digits(s); return d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2)}` : d }
  unw.slice(0, 3).forEach((w, i) => {
    const st = ret.ct.w2[w.id]
    const top = 181 + 21 * i
    draw.push(ei(1, 72, top, ein(st?.ein ?? '')), ei(1, 240, top, upper(st?.stateId ?? '').slice(0, 20)), ei(1, 557, top, money(st?.stateIncome ?? w.wages, true), { right: true }))
  })
  biz.slice(0, 3).forEach((b, i) => {
    const src = ret.businesses.find((x) => x.id === b.id)
    const top = 324 + 20 * i
    draw.push(ei(1, 72, top, ein(src?.ein ?? '')), ei(1, 557, top, b.netProfit < 0 ? `(${money(-b.netProfit, true)})` : money(b.netProfit, true), { right: true }))
  })
  draw.push(ei(1, 557, 400, money(E['8'], true), { right: true }), ei(1, 557, 451, money(E['10'], true), { right: true }))
  if (E['15a']) { draw.push(X(1, 63, 678)); draw.push(ei(1, 557, 660, '250', { right: true })) }
  draw.push(ei(1, 557, 719, money(E['16'], true), { right: true }))
  return { id: 'cteitc', file: 'ct-eitc.pdf', title: 'Connecticut Schedule CT-EITC', values: {}, draw }
}

const cd = at(612)
/** Schedule CT-Dependent relationship code: 1 child/stepchild, 2 niece/nephew, 3 grandchild, 4 foster child, 5 other. */
export function ctRelationshipCode(rel: string): string {
  const s = rel.toLowerCase()
  if (/foster/.test(s)) return '4'
  if (/grand/.test(s)) return '3'
  if (/niece|nephew/.test(s)) return '2'
  if (/son|daughter|child|step/.test(s)) return '1'
  return '5'
}

/** Schedule CT-Dependent (landscape, no fillable fields). */
export function formCtDependent(ret: TaxReturnInput): FormFill | null {
  const deps = ret.dependents
  if (!deps.length) return null
  const draw: Draw[] = []
  draw.push(...comb(cd, 0, 491, 13.6, 57, '###-##-####', digits(ret.taxpayer.ssn)))
  draw.push(cd(0, 396, 182, 'X', { size: 10 }))
  deps.slice(0, 4).forEach((x, i) => {
    const base = 330 + i * 36
    const [first, last] = splitName(x.name)
    draw.push(cd(0, 56, base, upper(first).slice(0, 22), { size: 9 }), cd(0, 214, base, upper(last).slice(0, 20), { size: 9 }))
    const dob = digits(ret.ct.dependentBirthDates[x.id] ?? '')
    if (dob.length === 8) draw.push(...comb(cd, 0, 369, 11.1, base, '##-##-####', dob, 9))
    draw.push(...comb(cd, 0, 488, 11.1, base, '###-##-####', digits(x.ssn), 9))
    draw.push(cd(0, 685, base, ctRelationshipCode(x.relationship), { size: 10 }))
  })
  draw.push(cd(0, 207, 504, String(deps.length), { size: 10 }))
  return { id: 'ctdep', file: 'ct-dependent.pdf', title: 'Connecticut Schedule CT-Dependent', values: {}, draw }
}

export function buildCtPacket(ret: TaxReturnInput, res: TaxReturnResult, ct1: CtResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formCt1040(ret, res, ct1, preparer)]
  if (ct1.eitc['16'] > 0) forms.push(formCtEitc(ret, ct1, res))
  const dep = formCtDependent(ret)
  if (dep) forms.push(dep)
  const notIncluded = [...ct1.attach]
  if (ct1.eitc['16'] > 0 && ret.w2s.filter((w) => !(ret.ct.w2[w.id]?.stateTax) && w.wages > 0).length > 3) notIncluded.push('Schedule CT-EITC line 6: more than three W-2s without Connecticut withholding; list the rest on a separate sheet')
  if (ct1.eitc['16'] > 0 && res.scheduleC.length) notIncluded.push('Schedule CT-EITC line 7: enter each business’s Connecticut Tax Registration Number in column B if it has one')
  if (ct1.eitcChildren > 3) notIncluded.push('Schedule CT-EITC: children after the third on an attached list')
  return { forms, notIncluded }
}
