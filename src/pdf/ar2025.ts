/**
 * Fills the official 2025 Arkansas AR1000F (public/forms/2025/ar-1000f.pdf, three pages) from a computed return.
 * Field names on this form are opaque (F_NR-1-n, F_NR0-2-n, F_NR-3-n); the mapping below was made by labelling every
 * field on a rendered copy. Whole dollars (the cents are printed on the form).
 */
import type { Owner, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { ArResult } from '../engine/ar2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const ssn = (v: string): string => { const x = digits(v); return x.length === 9 ? `${x.slice(0, 3)}-${x.slice(3, 5)}-${x.slice(5)}` : x }
const P1 = (n: number | string): string => `F_NR-1-${n}`
const P2 = (n: number | string): string => `F_NR0-2-${n}`
const P3 = (n: number | string): string => `F_NR-3-${n}`

/** Page 2 column A field number by line. */
const COL_A: Record<string, number> = {
  '8': 1, '10': 6, '11': 9, '12': 12, '13': 15, '14': 18, '15': 21, '16': 24, '18A': 31, '18B': 35, '19': 38, '20': 41, '21': 44, '22': 47,
  '23': 50, '24': 53, '25': 56, '27': 60, '28': 62, '29': 64, '30': 66, '31': 67, '32': 68, '33': 69, '34': 70, '35': 71, '36': 72, '37': 73, '38': 74
}
const PAGE3: Record<string, string> = {
  '39A': '1', '39B': '1B', '40': '2', '41': '3', '44': '7', '46': '9', '47': '10', '48': '11', '49': '12', '50': '13', '51': '14', '52C': '17'
}
const ALWAYS = new Set(['8', '23', '25', '27', '28', '29', '30', '33', '34', '37', '38', '44', '46'])

export function formArAr1000f(ret: TaxReturnInput, res: TaxReturnResult, ar: ArResult, preparer?: PreparerInfo | null): FormFill {
  const L = ar.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const v: Record<string, FieldValue> = {}
  const money = (name: string, n: number, always = false): void => {
    const x = Math.round(n)
    if (x === 0 && !always) return
    v[name] = x < 0 ? `(${-x})` : String(x)
  }

  // ── Page 1 ──
  v[P1(4)] = upper(ret.taxpayer.firstName)
  v[P1(6)] = upper(ret.taxpayer.lastName)
  v[P1(8)] = ssn(ret.taxpayer.ssn)
  if (joint) {
    v[P1(9)] = upper(ret.spouse.firstName)
    v[P1(11)] = upper(ret.spouse.lastName)
  }
  if (joint || fs === 'mfs') v[P1(13)] = ssn(ret.spouse.ssn)
  if (fs === 'mfs') v[P1(35)] = upper(`${ret.spouse.firstName} ${ret.spouse.lastName}`)
  v[P1(14)] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v[P1(15)] = upper(c.city)
  v[P1(16)] = upper(c.state)
  v[P1(17)] = digits(c.zip).slice(0, 9)
  v[P1(33)] = { single: '#0', mfj: '#1', hoh: '#2', mfs: '#4', qss: '#5' }[fs]
  const box = (o: Owner, base: number): void => {
    const b = ar.boxes[o]
    if (b.self) v[P1(base)] = true
    if (b.over65) v[P1(base + 1)] = true
    if (b.special) v[P1(base + 2)] = true
    if (b.blind) v[P1(base + 3)] = true
    if (b.deaf) v[P1(base + 4)] = true
  }
  box('taxpayer', 37)
  box('spouse', 43)
  if (ar.hohBox) v[P1(42)] = true
  v[P1(48)] = String(L['7Acount'])
  money(P1(49), L['7A'], true)
  ret.dependents.slice(0, 6).forEach((x, i) => {
    v[P1(50 + 3 * i)] = upper(x.name)
    v[P1(51 + 3 * i)] = ssn(x.ssn)
    v[P1(52 + 3 * i)] = upper(x.relationship)
  })
  if (L['7Bcount']) { v[P1(68)] = String(L['7Bcount']); money(P1(69), L['7B']) }
  money(P1(70), L['7C'], true)

  // ── Page 2 ──
  money(P2(4), ar.militaryPay.taxpayer)
  if (joint) money(P2(5), ar.militaryPay.spouse)
  money(P2(27), ar.militaryRetirement.taxpayer)
  if (joint) money(P2(28), ar.militaryRetirement.spouse)
  if (ar.pension.taxpayer.taxable) { money(P2(29), ar.pension.taxpayer.gross, true); money(P2(30), ar.pension.taxpayer.taxable, true) }
  if (joint && ar.pension.spouse.taxable) { money(P2(33), ar.pension.spouse.gross, true); money(P2(34), ar.pension.spouse.taxable, true) }
  for (const [k, n] of Object.entries(COL_A)) money(P2(n), L[k] ?? 0, ALWAYS.has(k))
  v[P2(59)] = ar.table === 'low' ? '#0' : ar.table === 'standard' ? '#1' : '#2'

  // ── Page 3 ──
  for (const [k, n] of Object.entries(PAGE3)) money(P3(n), L[k] ?? 0, ALWAYS.has(k))
  if (L['50'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      const rt = digits(dep.routingNumber).slice(0, 9)
      const acct = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
      ;[...rt].forEach((ch, i) => { v[P3(20 + i)] = ch })
      ;[...acct].forEach((ch, i) => { v[P3(29 + i)] = ch })
      v[P3(19)] = dep.accountType === 'savings' ? '#1' : '#0'
      money(P3(46), L['50'], true)
    }
  }
  v[P3(76)] = digits(c.phone).slice(-10)
  if (ret.usePaidPreparer && preparer) {
    v[P3(79)] = preparer.ptin.toUpperCase()
    v[P3(81)] = upper(preparer.firmName || preparer.name)
    v[P3(82)] = digits(preparer.phone).slice(-10)
    v[P3(83)] = upper(preparer.firmAddress)
    v[P3(80)] = '#0'
  }
  void res
  return { id: 'ar1000f', file: 'ar-1000f.pdf', title: 'Arkansas AR1000F', values: v, pages: [0, 1, 2] }
}

export function buildArPacket(ret: TaxReturnInput, res: TaxReturnResult, ar: ArResult, preparer?: PreparerInfo | null): FormPacket {
  return { forms: [formArAr1000f(ret, res, ar, preparer)], notIncluded: [...ar.attach, 'Your W-2s (attach to the front of page 1)'] }
}
