/**
 * Fills the official 2025 Arkansas AR1000F (public/forms/2025/ar-1000f.pdf, three pages) and its schedules AR1000ADJ, AR3,
 * AR1000D, AR2441 and AR1000TC from a computed return.
 * Field names on this form are opaque (F_NR-1-n, F_NR0-2-n, F_NR-3-n); the mapping below was made by labelling every
 * field on a rendered copy. Whole dollars (the cents are printed on the form).
 */
import type { Owner, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { careQualifyingPerson } from '../engine/compute.ts'
import type { ArResult } from '../engine/ar2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

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

const fullName = (ret: TaxReturnInput): string => upper(`${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)
const money = (v: Record<string, FieldValue>, name: string, n: number | undefined, always = false): void => {
  const x = Math.round(n ?? 0)
  if (x === 0 && !always) return
  v[name] = x < 0 ? `(${-x})` : String(x)
}

/** AR1000D: Federal Schedule D column and column (A); column (B) is for filing status 4 only. */
const D_FIELDS: Record<string, [fed: number | null, a: number]> = {
  '1': [3, 4], '2': [null, 7], '3': [null, 10], '4': [13, 14], '5': [null, 17], '6': [null, 20], '7a': [null, 23], '7b': [null, 26],
  '8': [null, 29], '9': [31, 32], '10': [null, 35], '11': [null, 38], '12': [null, 41]
}
export function formAr1000d(ret: TaxReturnInput, ar: ArResult): FormFill | null {
  const D = ar.d
  if (!D) return null
  const v: Record<string, FieldValue> = { 'D-1': fullName(ret), 'D-2': ssn(ret.taxpayer.ssn) }
  for (const [k, [fed, a]] of Object.entries(D_FIELDS)) {
    if (fed !== null) money(v, `D-${fed}`, D[k])
    money(v, `D-${a}`, D[k], k === '12')
  }
  return { id: 'ar1000d', file: 'ar-1000d.pdf', title: 'Arkansas AR1000D', values: v }
}

/** AR1000ADJ column (A) field number by line. */
const ADJ_A: Record<string, number> = {
  '1': 3, '2': 6, '3': 9, '4': 12, '5': 15, '6': 18, '7': 21, '8': 24, '9': 27, '10': 30, '11': 33, '12': 38, '13': 41, '14': 44, '15': 47, '16': 50,
  '17': 53, '18': 56, '19': 59
}
export function formAr1000adj(ret: TaxReturnInput, ar: ArResult): FormFill | null {
  const A = ar.adj
  if (!(A['19'] > 0)) return null
  const v: Record<string, FieldValue> = { 'ADJ-1': fullName(ret), 'ADJ-2': ssn(ret.taxpayer.ssn) }
  for (const [k, n] of Object.entries(ADJ_A)) money(v, `ADJ-${n}`, A[k], k === '19')
  if (A['12'] > 0) {
    v['ADJ-36'] = upper(ret.ar.adj.alimonyName)
    v['ADJ-37'] = ssn(ret.ar.adj.alimonySsn)
  }
  return { id: 'ar1000adj', file: 'ar-1000adj.pdf', title: 'Arkansas AR1000ADJ', values: v }
}

/** AR3 field number by line (lines 31–35 are for filing status 4 or 5 and are left blank). */
const AR3_F: Record<string, number> = {
  '1': 3, '2': 4, '3': 6, '4': 7, '5': 8, '6': 10, '7': 11, '8': 12, '9': 15, '10': 16, '11': 17, '12': 18, '13': 19, '14': 20, '15': 21, '16': 23,
  '17': 24, '18': 26, '19': 27, '20': 28, '21': 30, '22': 31, '23': 32, '24': 33, '25': 34, '26': 35, '27': 36, '28': 38, '29': 39, '30': 40
}
export function formAr3(ret: TaxReturnInput, ar: ArResult): FormFill | null {
  if (ar.table !== 'itemized') return null
  const I = ar.ar3
  const i3 = ret.ar.ar3
  const v: Record<string, FieldValue> = { 'AR3-1': fullName(ret), 'AR3-2': ssn(ret.taxpayer.ssn) }
  for (const [k, n] of Object.entries(AR3_F)) money(v, `AR3-${n}`, I[k], ['4', '7', '12', '17', '30'].includes(k))
  if (I['6'] > 0) v['AR3-9'] = upper([ret.itemized.personalPropertyTax > 0 ? 'PERSONAL PROPERTY' : '', i3.otherTaxes > 0 ? i3.otherTaxesType || 'OTHER' : ''].filter(Boolean).join(', '))
  if (I['9'] > 0) { v['AR3-13'] = upper(i3.individualName); v['AR3-14'] = upper(i3.individualAddress) }
  if (I['16'] > 0) v['AR3-22'] = upper(i3.charityCarryoverType || 'CARRYOVER')
  if (I['21'] > 0) v['AR3-29'] = upper(i3.otherExpensesType)
  if (I['28'] > 0) v['AR3-37'] = upper(i3.otherDeductionsType || 'OTHER')
  return { id: 'ar3', file: 'ar-3.pdf', title: 'Arkansas AR3', values: v }
}

/** AR2441, built from the federal Form 2441 (same 2025 rules; Part III line n is federal line n + 1). */
export function formAr2441(ret: TaxReturnInput, res: TaxReturnResult, ar: ArResult): FormFill | null {
  const f = res.form2441
  if (!(ar.lines['35'] > 0) && !f.partIII) return null
  const care = ret.dependentCare
  const v: Record<string, FieldValue> = { 'AR41-1': fullName(ret), 'AR41-2': ssn(ret.taxpayer.ssn) }
  const rows: [string, string, string, string][] = [['AR41-4', 'AR41-5', 'AR41-6', 'AR41-7'], ['AR41-8', 'AR41-9', 'AR41-10', 'AR41-11']]
  care.providers.slice(0, 2).forEach((p, i) => {
    const [name, address, tin, amount] = rows[i]
    v[name] = upper(p.name); v[address] = upper(p.address); v[tin] = p.tin.trim(); money(v, amount, p.amountPaid)
  })
  const persons = ret.dependents.filter(careQualifyingPerson).slice(0, 2)
  const columnTotal = f.partIII ? f.partIII.line30 : Math.round(care.expenses)
  const per = persons.length ? Math.floor(columnTotal / persons.length) : 0
  const prow: [string, string, string, string][] = [['AR41-12', 'AR41-13', 'AR41-14', 'AR41-15'], ['AR41-16', 'AR41-17', 'AR41-18', 'AR41-19']]
  persons.forEach((d, i) => {
    const [first, last, id, amount] = prow[i]
    const parts = d.name.trim().split(/\s+/)
    v[first] = upper(parts.slice(0, -1).join(' ') || parts[0] || ''); v[last] = upper(parts.length > 1 ? parts[parts.length - 1] : '')
    v[id] = ssn(d.ssn); money(v, amount, i === 0 ? columnTotal - per * (persons.length - 1) : per)
  })
  money(v, 'AR41-20', f.line3, true); money(v, 'AR41-21', f.line4, true); money(v, 'AR41-22', f.line5, true); money(v, 'AR41-23', f.expensesUsed, true)
  money(v, 'AR41-24', res.f1040['11a'], true)
  if (f.rate) v['AR41-25'] = String(Math.round(f.rate * 100)).padStart(2, '0')
  money(v, 'AR41-26', f.credit, true); money(v, 'AR41-27', ar.lines['35'], true)
  const p = f.partIII
  if (p) {
    const P3: [string, number][] = [
      ['AR41-28', p.line12], ['AR41-31', p.line12], ['AR41-32', p.line16], ['AR41-33', p.line17], ['AR41-34', p.line18], ['AR41-35', p.line19],
      ['AR41-36', p.line20], ['AR41-37', p.line21], ['AR41-39', p.line12], ['AR41-41', p.line25], ['AR41-42', p.line26], ['AR41-43', p.line27],
      ['AR41-44', p.line28], ['AR41-45', p.line29], ['AR41-46', p.line30], ['AR41-47', p.line31]
    ]
    for (const [name, n] of P3) money(v, name, n, true)
    v['AR41-38B'] = '0'
  }
  return { id: 'ar2441', file: 'ar-2441.pdf', title: 'Arkansas AR2441', values: v, pages: p ? undefined : [0] }
}

export function formAr1000tc(ret: TaxReturnInput, ar: ArResult): FormFill | null {
  const T = ar.tc
  if (!(T['9'] > 0)) return null
  const tc = ret.ar.tc
  const v: Record<string, FieldValue> = { 'TC-1': fullName(ret), 'TC-2': ssn(ret.taxpayer.ssn) }
  const lineField: Record<string, string> = { '1': 'TC-3', '2': 'TC-4', '3': 'TC-5', '4': 'TC-6', '5': 'TC-7', '6': 'TC-8', '7': 'TC-8B', '8': 'TC-39', '9': 'TC-40' }
  for (const [k, name] of Object.entries(lineField)) money(v, name, T[k], k === '9')
  tc.developmental.filter((x) => x.name.trim()).slice(0, 6).forEach((x, i) => {
    v[`TC-${9 + i * 2}`] = upper(x.name)
    v[`TC-${10 + i * 2}`] = ssn(x.ssn)
  })
  for (const [o, start] of [['taxpayer', 21], ['spouse', 30]] as [Owner, number][]) {
    tc.business.filter((b) => b.owner === o && b.amount > 0).slice(0, 3).forEach((b, i) => {
      const n = start + i * 3
      v[`TC-${n}`] = b.code.trim()
      if (b.fein.trim()) v[`TC-${n + 1}`] = b.fein.trim()
      money(v, `TC-${n + 2}`, b.amount)
    })
  }
  return { id: 'ar1000tc', file: 'ar-1000tc.pdf', title: 'Arkansas AR1000TC', values: v }
}

export function buildArPacket(ret: TaxReturnInput, res: TaxReturnResult, ar: ArResult, preparer?: PreparerInfo | null): FormPacket {
  const forms = [formArAr1000f(ret, res, ar, preparer), formAr1000adj(ret, ar), formAr3(ret, ar), formAr1000d(ret, ar), formAr2441(ret, res, ar), formAr1000tc(ret, ar)]
  forms.push(...dependentsStatement(ret, 6, 'AR1000F, Dependents (continued)', 'st-ar-deps'))
  return { forms: forms.filter((x): x is FormFill => x !== null), notIncluded: [...ar.attach, 'Your W-2s (attach to the front of page 1)'] }
}
