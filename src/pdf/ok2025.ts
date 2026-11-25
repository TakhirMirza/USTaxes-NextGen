/**
 * Fills the official 2025 Oklahoma Form 511 (pages 1–7 of the OTC 2025 Form 511 packet, public/forms/2025/ok511.pdf)
 * from a computed return. Pages 4–7 (Schedules 511-A to 511-H) are included only when a schedule has an amount.
 * Whole dollars.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { OkResult } from '../engine/ok2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const money = (n: number | undefined): string => {
  const v = Math.round(n ?? 0)
  return v === 0 ? '' : v.toLocaleString('en-US')
}
const keep0 = (n: number | undefined): string => Math.round(n ?? 0).toLocaleString('en-US')
const date = (s: string): string => {
  const x = digits(s)
  return x.length === 8 ? `${x.slice(0, 2)}/${x.slice(2, 4)}/${x.slice(4)}` : ''
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
const pct = (x: number): string => (x * 100).toFixed(2)

export function formOk511(ret: TaxReturnInput, res: TaxReturnResult, ok: OkResult, preparer?: PreparerInfo | null): FormFill {
  const L = ok.lines
  const d = ret.ok
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const v: Record<string, FieldValue> = {}
  const pages = [0, 1, 2]

  // ── Page 1 ──
  v['511 SSN1'] = digits(ret.taxpayer.ssn)
  for (const k of ['511a SSN1']) v[k] = digits(ret.taxpayer.ssn)
  const [tf, ti] = firstAndInitial(ret.taxpayer.firstName)
  v['511 Your First Name'] = tf
  v['511 Your Middle Initial'] = ti
  v['511 Your Last Name'] = upper(ret.taxpayer.lastName)
  if (joint) {
    v['511 sSSN1'] = digits(ret.spouse.ssn)
    const [sf, si] = firstAndInitial(ret.spouse.firstName)
    v['511 sFirst Name'] = sf
    v['511 sMiddle Initial'] = si
    v['511 sLast Name'] = upper(ret.spouse.lastName)
  }
  if (fs === 'mfs') {
    v['Status 3a'] = upper(`${ret.spouse.firstName} ${ret.spouse.lastName}`)
    v['Status 3b'] = digits(ret.spouse.ssn)
  }
  v['511 Address'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['511 City'] = upper(c.city)
  v['511 State'] = upper(c.state).slice(0, 2)
  v['511 ZIP'] = digits(c.zip).length === 9 ? `${digits(c.zip).slice(0, 5)}-${digits(c.zip).slice(5)}` : digits(c.zip).slice(0, 5)
  v['511 County'] = upper(d.county)
  v['Filing Status'] = { single: 'Single', mfj: 'Married Joint', mfs: 'Married Separate', hoh: 'HoH', qss: 'Widower' }[fs]
  const ex = ok.exemptions
  v['Exemptions 1'] = String(ex.regular[0])
  v['Exemptions 2'] = String(ex.special[0])
  v['Exemptions 3'] = String(ex.blind[0])
  v['Exemptions 4'] = String(ex.regular[0] + ex.special[0] + ex.blind[0])
  if (joint) {
    v['Exemptions 5'] = String(ex.regular[1])
    v['Exemptions 6'] = String(ex.special[1])
    v['Exemptions 7'] = String(ex.blind[1])
    v['Exemptions 8'] = String(ex.regular[1] + ex.special[1] + ex.blind[1])
  }
  v['Exemptions 9'] = String(ex.dependents)
  v['Exemptions 10'] = String(ex.total)
  if (ret.taxpayer.age65OrOlder || ret.taxpayer.age >= 65) v['511 65 Yourself?'] = true
  if (joint && (ret.spouse.age65OrOlder || ret.spouse.age >= 65)) v['511 65 Spouse?'] = true
  if (ret.dependents.length > 4) v['Dependents, if more than four, check here'] = true
  ret.dependents.slice(0, 4).forEach((x, i) => {
    const [first, last] = splitName(x.name)
    v[`511 Dependents First Name ${i + 1}`] = upper(first)
    v[`511 Dependents Last Name ${i + 1}`] = upper(last)
    v[`511 Dependents SSN ${i + 1}`] = digits(x.ssn)
    v[`511 Dependents Date of Birth ${i + 1}`] = date(d.dependentBirthDates[x.id] ?? '')
    v[`511 Dependents Relationship ${i + 1}`] = upper(x.relationship)
  })
  const p1: [string, string][] = [['1', '511 Part 1 1'], ['2', '511 Part 1 2'], ['3', '511 Part 1 3'], ['4', '511 Part 1 4b'], ['5', '511 Part 1 5'], ['6', '511 Part 1 6'], ['7', '511 Part 1 7'], ['8', '511 Part 2 8'], ['9', '511 Part 2 9']]
  for (const [k, name] of p1) v[name] = ['1', '3', '5', '7', '9'].includes(k) ? keep0(L[k]) : money(L[k])

  // ── Page 2 ──
  v['511 Part 2 10'] = keep0(L['10'])
  v['511 Part 2 11 A'] = String(ex.total)
  v['511 Part 2 11'] = keep0(L['11'])
  v['511 Part 2 12'] = keep0(L['12'])
  v['511 Part 2 13'] = keep0(L['13'])
  v['511 Part 2 14a'] = keep0(L['14a'])
  v['511 Part 2 14'] = keep0(L['14'])
  v['511 Part 2 15'] = money(L['15'])
  v['511 Part 2 16'] = money(L['16'])
  if (L['17'] > 0) { v['511 Part 2 18 Line #'] = d.otherCredit.code.replace(/\D/g, '').slice(0, 2); v['511 Part 2 17'] = money(L['17']) }
  v['511 Part 2 18'] = keep0(L['18'])
  if (L['19'] > 0) v['511 Part 2 19'] = money(L['19'])
  else v['Part 3 20 ck'] = true
  v['511 Part 3 20'] = keep0(L['20'])
  v['511 Part 3 21'] = money(L['21'])
  v['511 Part 3 22'] = money(L['22'])
  v['511 Part 3 23'] = money(L['23'])
  v['511 Part 3 25'] = money(L['25'])
  v['511 Part 3 28'] = money(L['28'])

  // ── Page 3 ──
  v['511 Part 3 31'] = keep0(L['31'])
  v['511 Part 3 33'] = keep0(L['33'])
  v['511 Part 4 34'] = money(L['34'])
  v['511 Part 4 35'] = money(L['35'])
  v['511 Part 4 37'] = money(L['37'])
  v['511 Part 4 38'] = money(L['38'])
  if (L['38'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      v['511 Refund'] = dep.accountType === 'savings' ? 'Savings' : 'Checking'
      v['511 RN 1'] = digits(dep.routingNumber).slice(0, 9)
      v['511 AN 1'] = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
      v['511 Outside US?'] = 'No'
    }
  }
  v['511 Part 5 39'] = money(L['39'])
  v['511 Part 5 42'] = money(L['42'])
  const ph = digits(c.phone).slice(-10)
  if (ph.length === 10) v['T511 Taxpayer Phone'] = `(${ph.slice(0, 3)}) ${ph.slice(3, 6)}-${ph.slice(6)}`
  if (ret.usePaidPreparer && preparer) {
    v['Preparer\'s Address/Phone'] = upper([preparer.firmName || preparer.name, preparer.firmAddress, preparer.phone].filter(Boolean).join(', '))
    v['Preparer\'s ID Number'] = preparer.ptin.toUpperCase()
  }

  // ── Page 4–5: Schedules 511-A, 511-B, 511-C, 511-D ──
  const A = ok.schA
  if (A['18'] > 0 || ok.schB['10'] > 0) {
    pages.push(3)
    for (const k of ['1', '2', '3', '4', '5', '6', '7']) v[`511A ${k}`] = money(A[k])
    if (A['3'] > 0) { v['511A 3-1'] = upper(d.csrsClaim.taxpayer); if (joint) v['511A 3-2'] = upper(d.csrsClaim.spouse) }
    if (A['17'] > 0) { v['511A 17 Other'] = d.otherSubtraction.code.replace(/\D/g, '').slice(0, 2); v['511A 17'] = money(A['17']) }
    v['511A 18'] = keep0(A['18'])
    v['511B 1'] = money(ok.schB['1'])
  }
  const D = ok.schD
  if (ok.schB['10'] > 0 || ok.schC['7'] > 0 || D) {
    pages.push(4)
    if (ok.schB['9'] > 0) { v['511B 9 Other Additions'] = d.otherAddition.code.replace(/\D/g, '').slice(0, 2); v['511B 9'] = money(ok.schB['9']) }
    if (ok.schB['10'] > 0) v['511B 10'] = keep0(ok.schB['10'])
    v['511C 1'] = money(ok.schC['1'])
    v['511C 3'] = money(ok.schC['3'])
    if (ok.schC['6'] > 0) { v['511C 6 Other'] = d.otherAdjustment.code.replace(/\D/g, '').slice(0, 2); v['511C 6'] = money(ok.schC['6']) }
    if (ok.schC['7'] > 0) v['511C 7'] = keep0(ok.schC['7'])
    if (D) {
      for (const k of ['1', '2', '3', '4', '5', '6']) v[`511D ${k}`] = k === '6' ? keep0(D[k]) : money(D[k])
      v['511D 7'] = D['limited'] ? 'Yes' : 'No'
      if (D['limited']) { v['511D 9'] = money(D['9']); v['511D 10'] = money(D['10']) }
      v['511D 11'] = keep0(D['11'])
    }
  }
  // ── Page 6–7: Schedules 511-F and 511-G (only when prorated) ──
  const prorated = ok.lines['7'] < ok.lines['1']
  if (prorated && ok.schF['5'] > 0) {
    pages.push(5)
    const F = ok.schF
    v['511F 1'] = money(F['1'])
    v['511F 2'] = money(F['2'])
    v['511F 3'] = money(F['3'])
    v['511F 4'] = money(F['4'])
    v['511F 5'] = money(F['5'])
    v['511F 6a'] = keep0(ok.lines['7'])
    v['511F 6b'] = keep0(ok.lines['1'])
    v['511F 6'] = pct(ok.ratio)
    v['511F 7'] = money(F['7'])
  }
  if (ok.schG['1'] > 0) {
    pages.push(6)
    const G = ok.schG
    v['511G 1'] = money(G['1'])
    v['511G 2'] = money(G['2'])
    v['511G 3a'] = keep0(ok.lines['7'])
    v['511G 3b'] = keep0(ok.lines['1'])
    v['511G 3'] = pct(ok.ratio)
    v['511G 4'] = money(G['4'])
  }
  void res
  return { id: 'ok511', file: 'ok511.pdf', title: 'Oklahoma Form 511', values: v, pages }
}

export function buildOkPacket(ret: TaxReturnInput, res: TaxReturnResult, ok: OkResult, preparer?: PreparerInfo | null): FormPacket {
  const notIncluded = [...ok.attach]
  if (ret.dependents.some((x) => !(ret.ok.dependentBirthDates[x.id] ?? '').replace(/\D/g, ''))) notIncluded.push('Page 1: dependents’ dates of birth that were not entered')
  return { forms: [formOk511(ret, res, ok, preparer), ...dependentsStatement(ret, 4, 'Form 511, Dependents (continued)', 'st-ok-deps')], notIncluded }
}
