/**
 * Fills the official 2025 Mississippi Form 80-105 (public/forms/2025/ms-80105.pdf), the income / withholding schedule
 * 80-107 (ms-80107.pdf, required with every return) and Form 80-108 (ms-80108.pdf, when it has entries) from a computed
 * return. Whole dollars (the cents are printed on the forms).
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MsResult } from '../engine/ms2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const amount = (n: number): string => { const x = Math.round(n); return x < 0 ? `-${-x}` : String(x) }

/** Check-off funds on 80-108 Part III, by field. */
export const MS_FUNDS: [key: string, label: string, field: string][] = [
  ['military', 'Military Family Relief Fund', '00_25'], ['burn', 'Burn Care Fund', '00_27'], ['heritage', 'Wildlife Heritage Fund', '00_29'],
  ['education', 'Educational Trust Fund', '00_31'], ['fisheries', 'Wildlife Fisheries and Parks Foundation', '00_26'], ['volunteer', 'Commission for Volunteer Service Fund', '00_28']
]
const ALWAYS1 = new Set(['12', '17', '20', '23', '28'])
const PAGE1 = ['17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37']
const PAIRS = ['13', '14', '15', '16', ...Array.from({ length: 29 }, (_, i) => String(38 + i))]
const ALWAYS_PAIR = new Set(['13', '14', '15', '16', '38', '49', '65', '66'])

export function formMs80105(ret: TaxReturnInput, res: TaxReturnResult, ms: MsResult, preparer?: PreparerInfo | null): FormFill {
  const L = ms.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const v: Record<string, FieldValue> = {}
  v['Taxpayer First Name'] = upper(ret.taxpayer.firstName)
  v['Taxpayer Last Name'] = upper(ret.taxpayer.lastName)
  v['SSN'] = digits(ret.taxpayer.ssn)
  if (joint || fs === 'mfs') {
    v['Spouse First Name'] = upper(ret.spouse.firstName)
    v['Spouse Last Name'] = upper(ret.spouse.lastName)
    v['Spouse SSN'] = digits(ret.spouse.ssn)
  }
  v['Address'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['City'] = upper(c.city)
  v['State'] = upper(c.state).slice(0, 2)
  v['Zip'] = digits(c.zip).slice(0, 5)
  if (ret.ms.countyCode.trim()) v['County Code'] = digits(ret.ms.countyCode).slice(0, 2)
  v['Filing St'] = { mfj: '1', mfs: '3', hoh: '4', qss: '4', single: '5' }[fs]
  ret.dependents.slice(0, 4).forEach((x, i) => {
    v[`DependentName${i + 1}`] = upper(x.name).slice(0, 18)
    v[`DependentRelation${i + 1}`] = x.childRelationship && x.age < 24 ? 'C' : /parent|mother|father/i.test(x.relationship) ? 'P' : 'R'
    v[`DependentSSN${i + 1}`] = digits(x.ssn)
  })
  v['TotalDependents'] = String(L['7'])
  if (ms.boxes.taxpayer65) v['TaxpayerOver65'] = true
  if (ms.boxes.taxpayerBlind) v['TaxpayerBlind'] = true
  if (ms.boxes.spouse65) v['SpouseOver65'] = true
  if (ms.boxes.spouseBlind) v['SpouseBlind'] = true
  v['Total dependents line 7 plus number of boxes checked line 8'] = String(L['9'])
  if (L['10']) v['Line10'] = amount(L['10'])
  v['Line11'] = amount(L['11'])
  v['Line12'] = amount(L['12'])
  for (const k of PAIRS) {
    const a = L[`${k}A`] ?? 0
    const b = L[`${k}B`] ?? 0
    if (a !== 0 || ALWAYS_PAIR.has(k)) v[`${k}A`] = amount(a)
    if (joint && (b !== 0 || ALWAYS_PAIR.has(k))) v[`${k}B`] = amount(b)
  }
  for (const k of PAGE1) if ((L[k] ?? 0) !== 0 || ALWAYS1.has(k)) v[k] = amount(L[k])
  v['Page2SSN'] = digits(ret.taxpayer.ssn)
  v['Page3SSN'] = digits(ret.taxpayer.ssn)
  if (L['34'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      v['Direct Deposit Request'] = true
      v['1D'] = amount(L['34'])
      v['Routing Number 1'] = digits(dep.routingNumber).slice(0, 9)
      v['Account Number 1'] = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
      v['Check Box3'] = dep.accountType === 'savings' ? '2' : '1'
      v['2D'] = amount(L['34'])
    }
  }
  v['TaxpayerPhoneNumber'] = digits(c.phone).slice(-10)
  if (ret.usePaidPreparer && preparer) {
    v['Check Box1'] = '1'
    v['PreparerPTIN'] = preparer.ptin.toUpperCase()
    v['PreparerPhoneNumber'] = digits(preparer.phone).slice(-10)
    v['PreparerAddress'] = upper(preparer.firmAddress).slice(0, 25)
  }
  void res
  return { id: 'ms80105', file: 'ms-80105.pdf', title: 'Mississippi Form 80-105', values: v, pages: [0, 1, 2] }
}

export function formMs80107(ret: TaxReturnInput, ms: MsResult, copy = 0): FormFill {
  const v: Record<string, FieldValue> = {}
  v['Taxpayer Name'] = upper(`${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)
  ms.statements.slice(copy * 4, copy * 4 + 4).forEach((x, i) => {
    const n = i + 1
    const ssnField = n === 1 ? '1Taxpayer Social Security Number' : `${n}Txpayer Social Security Number`
    const wageField = n === 1 ? '1Mississippi Taxable Income' : `${n}Mssissippi Taxable Income`
    const whField = n === 1 ? '1Mississippi Withholding Only' : `${n}Mssissippi Withholding Only`
    v[`Check Box${n}`] = '1'
    v[`${n}PayerID`] = digits(x.payerId)
    v[`${n}Taxpayer Name`] = upper(x.name).slice(0, 19)
    v[ssnField] = digits(x.ssn)
    v[wageField] = amount(x.wages)
    v[whField] = amount(x.tax)
    v[`${n}Employer or payer name`] = upper(x.employer).slice(0, 25)
  })
  return copy ? { id: `ms80107-${copy + 1}`, file: 'ms-80107.pdf', title: `Mississippi Form 80-107 (page ${copy + 1})`, values: v, pages: [0] }
    : { id: 'ms80107', file: 'ms-80107.pdf', title: 'Mississippi Form 80-107', values: v, pages: [0] }
}

export function formMs80108(ret: TaxReturnInput, ms: MsResult): FormFill {
  const v: Record<string, FieldValue> = {}
  const L = ms.lines
  v['Taxpayer Name'] = upper(`${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)
  v['SSN'] = digits(ret.taxpayer.ssn)
  v['SSN_2'] = digits(ret.taxpayer.ssn)
  const pages = [0]
  const I = ms.itemized
  if (I) {
    v['FederalAGI'] = amount(I['1'])
    const map: Record<string, string> = { '2c': '00_3', '3a': '00_4', '3b': '00_5', '3c': '00_6', '4': '00_7', '5': '00_8', '7a': '00_10', '7c': '00_12', '8': '00_16' }
    for (const [k, f] of Object.entries(map)) if (I[k] || k === '8') v[f] = amount(I[k])
  }
  const B = ms.interest
  const bmap: Record<string, string> = { '1': '00_19', '2': '00_20', '3': '00_21', '4': '00_22', '5': '00_23', '6': '00_24' }
  if (B['1'] + B['4'] > 0) for (const [k, f] of Object.entries(bmap)) v[f] = amount(B[k])
  let gifts = 0
  for (const [key, , f] of MS_FUNDS) {
    const n = Math.round(Math.max(0, ret.ms.contributions[key] ?? 0))
    if (n) { v[f] = amount(n); gifts += n }
  }
  if (gifts) v['00_32'] = amount(L['33'])
  const rent = (L['41A'] ?? 0) + (L['41B'] ?? 0)
  const other = (L['48A'] ?? 0) + (L['48B'] ?? 0)
  if (rent || other) {
    pages.push(1)
    if (rent) { v['00_33'] = amount(rent); v['00_35'] = amount(rent); v['00_52'] = amount(rent) }
    if (other) { v['2 2'] = 'OTHER INCOME (FEDERAL SCHEDULE 1)'; v['00_56'] = amount(other); v['00_62'] = amount(other) }
  }
  return { id: 'ms80108', file: 'ms-80108.pdf', title: 'Mississippi Form 80-108', values: v, pages }
}

const msName = (ret: TaxReturnInput): string => upper(ret.filingStatus === 'mfj' ? `${ret.taxpayer.firstName} & ${ret.spouse.firstName} ${ret.taxpayer.lastName}` : `${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)
const n0 = (n: number): string => String(Math.round(n))

/** Form 80-160, page 1. */
export function formMs160(ret: TaxReturnInput, ms: MsResult, copy = 0): FormFill | null {
  const f = ms.f160
  if (!f) return null
  const L = ms.lines
  const joint = ret.filingStatus === 'mfj'
  const v: Record<string, FieldValue> = { TaxpayerName: msName(ret), SSN: digits(ret.taxpayer.ssn) }
  const cols: ['A' | 'B', string][] = joint ? [['A', '1'], ['B', '2']] : [['A', '1']]
  if (!copy) for (const [c, n] of cols) {
    v[`${n}-1`] = n0(L[`13${c}`]); v[`${n}-2`] = n0(L[`14${c}`]); v[`${n}-3`] = n0(L[`15${c}`]); v[`${n}-4`] = n0(L[`16${c}`])
  }
  const states = ret.ms.otherStates.filter((o) => o.state.trim() && o.tax > 0).slice(copy * 3, copy * 3 + 3)
  f.cols.slice(copy * 3, copy * 3 + 3).forEach((c, i) => {
    const col = String(i + 3)
    v[`State${i + 1}`] = upper(states[i].state).slice(0, 2)
    v[`${col}-1`] = n0(c['1']); v[`${col}-2`] = n0(c['2']); v[`${col}-3`] = n0(c['3']); v[`${col}-4`] = n0(c['4'])
    v[`${col}-5`] = c['5'].toFixed(2)
    v[`${col}-7`] = n0(c['7']); v[`${col}-8`] = n0(c['8']); v[`${col}-9`] = n0(c['9']); v[`${col}-10`] = n0(c['10'])
  })
  if (copy) return { id: `ms80160-${copy + 1}`, file: 'ms-80160.pdf', title: `Mississippi Form 80-160 (states ${copy * 3 + 1}–${copy * 3 + 3})`, values: v, pages: [0] }
  v['6-4'] = n0(f.total4)
  v['A-6'] = n0(f.a6); v['A-7'] = n0(f.a7); v['B-7'] = n0(f.b7)
  v['6-10'] = n0(f.line10); v['6-13'] = n0(f.line11); v['6-14'] = n0(f.line12)
  return { id: 'ms80160', file: 'ms-80160.pdf', title: 'Mississippi Form 80-160', values: v, pages: [0] }
}

/** Form 80-401 tax credit summary schedule. */
export function formMs401(ret: TaxReturnInput, ms: MsResult, copy = 0): FormFill | null {
  if (!ms.f401.length) return null
  const v: Record<string, FieldValue> = { SSN: digits(ret.taxpayer.ssn) }
  ms.f401.slice(copy * 4, copy * 4 + 4).forEach((c, i) => {
    const n = i + 1
    v[`Code${n}`] = c.code
    for (const k of ['B', 'C', 'D', 'E', 'F', 'G'] as const) if (c[k] || k === 'E' || k === 'G') v[`${k}${n}`] = n0(c[k])
  })
  if (copy) return { id: `ms80401-${copy + 1}`, file: 'ms-80401.pdf', title: `Mississippi Form 80-401 (credits ${copy * 4 + 1}–${copy * 4 + 4})`, values: v, pages: [0] }
  v.Line1 = n0(ms.f401.reduce((s, c) => s + c.E, 0))
  v.Line2 = n0(ms.f401.reduce((s, c) => s + c.G, 0))
  const ssns = ret.ms.adopteeSsns.split(/[,;\s]+/).map(digits).filter((x) => x.length === 9)
  if (ms.f401.some((c) => c.code === '25')) ssns.slice(0, 2).forEach((x, i) => { v[`AdopteeSSN${i + 1}`] = x })
  const orgs = ret.ms.charities.split(/[;\n]+/).map((x) => x.trim()).filter(Boolean)
  if (ms.f401.some((c) => ['34', '35', '36', '39', '42', '43', '45'].includes(c.code))) orgs.slice(0, 2).forEach((x, i) => { v[`CharitableOrg${i + 1}`] = upper(x) })
  return { id: 'ms80401', file: 'ms-80401.pdf', title: 'Mississippi Form 80-401', values: v }
}

export function buildMsPacket(ret: TaxReturnInput, res: TaxReturnResult, ms: MsResult, preparer?: PreparerInfo | null): FormPacket {
  const forms = [formMs80105(ret, res, ms, preparer), formMs80107(ret, ms)]
  for (let k = 1; k * 4 < ms.statements.length; k++) forms.push(formMs80107(ret, ms, k))
  const L = ms.lines
  const needs108 = !!ms.itemized || ms.interest['1'] + ms.interest['4'] > 0 || L['33'] > 0 || (L['41A'] ?? 0) + (L['41B'] ?? 0) !== 0 || (L['48A'] ?? 0) + (L['48B'] ?? 0) !== 0
  if (needs108) forms.push(formMs80108(ret, ms))
  for (const x of [formMs160(ret, ms), formMs401(ret, ms)]) if (x) forms.push(x)
  if (ms.f160) for (let k = 1; k * 3 < ms.f160.cols.length; k++) forms.push(formMs160(ret, ms, k)!)
  for (let k = 1; k * 4 < ms.f401.length; k++) forms.push(formMs401(ret, ms, k)!)
  const notIncluded = ms.attach.filter((x) => !x.startsWith('Form 80-107') && !x.startsWith('Form 80-108'))
  notIncluded.push('Your W-2s and 1099s and a copy of your federal return')
  if (ms.statements.length === 0) notIncluded.push('Form 80-107 must be filed even with no Mississippi withholding: list any income statements on it')
  forms.push(...dependentsStatement(ret, 4, 'Form 80-491, Dependents (continued)', 'st-ms-deps'))
  return { forms, notIncluded }
}
