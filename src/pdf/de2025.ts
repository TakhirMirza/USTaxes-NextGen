/**
 * Fills the official 2025 Delaware forms (public/forms/2025/): PIT-RES (pages 1–3; the amended-return page 4 is
 * dropped), PIT-RSS (Schedules I–V), PIT-RSA (itemized deductions) and PIT-CRS (credits). The Division of Revenue’s
 * fill-in PDFs with the Prepare-for-print / Reset buttons and scripts removed. Whole dollars: the cents are preprinted.
 */
import type { Owner, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { DeResult } from '../engine/de2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { statementForms } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const SUFFIX = /^(JR|SR|II|III|IV|V)\.?$/i
/** First name, middle initial and suffix from "First M" and "Last Jr". */
const nameParts = (first: string, last: string): { first: string; mi: string; last: string; suffix: string } => {
  const f = first.trim().split(/\s+/)
  const mi = f.length > 1 && /^[A-Za-z]\.?$/.test(f[f.length - 1]) ? (f.pop() ?? '').replace('.', '') : ''
  const l = last.trim().split(/\s+/)
  const suffix = l.length > 1 && SUFFIX.test(l[l.length - 1]) ? (l.pop() ?? '').replace('.', '') : ''
  return { first: f.join(' '), mi, last: l.join(' '), suffix }
}
const mmddyyyy = (s: string): string => {
  const m = s.trim().match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/)
  return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : s.trim()
}
const fmtPhone = (s: string): string => {
  const x = digits(s).slice(-10)
  return x.length === 10 ? `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}` : x
}
const STATUS_BUTTON = { 1: '#4', 2: '#0', 3: '#1', 4: '#2', 5: '#3' } as const
/** Schedule III fields by letter. */
export const DE_FUNDS: [letter: string, field: string, name: string][] = [
  ['A', '0200', 'Non-game wildlife'], ['B', '0210', 'Beau Biden Foundation'], ['C', '0220', 'Emergency housing'], ['D', '0230', 'Breast cancer education'],
  ['E', '0240', 'Organ donations'], ['F', '0250', 'Diabetes education'], ['G', '0260', 'Veterans home'], ['H', '0270', 'Delaware National Guard'],
  ['I', '0280', 'Juvenile diabetes fund'], ['J', '0290', 'Multiple sclerosis society'], ['K', '0300', 'Ovarian cancer foundation'], ['L', '0310', 'SL24: UnLocke the Light Foundation'],
  ['M', '0320', 'White Clay Creek'], ['N', '0330', 'Home of the Brave'], ['P', '0350', 'Veterans trust fund'], ['Q', '0360', 'Protect Delaware’s children fund'],
  ['R', '0370', 'Food Bank of Delaware'], ['S', '0380', 'Delaware Habitat for Humanity'], ['T', '0390', 'B+ childhood cancer'], ['U', '0395', 'Combined Campaign for Justice']
]

/** Delaware's EITC children for PIT-RSS Schedule II (the same test as the federal qualifying child, up to three). */
export const deEitcChildren = (ret: TaxReturnInput) => ret.dependents.filter((x) => x.childRelationship && x.monthsLivedWithYou > 6 && (x.age < 19 || (x.student && x.age < 24) || x.disabled)).slice(0, 3)

const moneyIn = (v: Record<string, FieldValue>) => (name: string, n: number | undefined, always = false): void => {
  const x = Math.round(n ?? 0)
  if (x === 0 && !always) return
  v[name] = x < 0 ? `-${-x}` : String(x)
}

function headerName(ret: TaxReturnInput, de: DeResult): string {
  const t = ret.taxpayer
  const s = ret.spouse
  const married = de.status === 2 || de.status === 4
  if (!married) return upper(`${t.firstName} ${t.lastName}`)
  return t.lastName.trim().toUpperCase() === s.lastName.trim().toUpperCase()
    ? upper(`${t.firstName} & ${s.firstName} ${t.lastName}`)
    : upper(`${t.firstName} ${t.lastName} & ${s.firstName} ${s.lastName}`)
}

export function formPitRes(ret: TaxReturnInput, res: TaxReturnResult, de: DeResult, preparer?: PreparerInfo | null): FormFill {
  void res
  const { A, B, lines: L } = de
  const two = de.status === 4
  const c = ret.contact
  const d = ret.de
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  const both = (line: string, always = false): void => {
    money(`ln${line}ColB`, B[line], always)
    if (two) money(`ln${line}ColA`, A[line], always)
  }

  // ── Page 1 ──
  const tp = nameParts(ret.taxpayer.firstName, ret.taxpayer.lastName)
  v.taxPayerID = digits(ret.taxpayer.ssn)
  v.firstName = upper(tp.first)
  if (tp.mi) v.middleInitial = upper(tp.mi)
  v.lastName = upper(tp.last)
  if (tp.suffix) v.suffix = upper(tp.suffix)
  if (de.status !== 1 && de.status !== 5) {
    const sp = nameParts(ret.spouse.firstName, ret.spouse.lastName)
    v.spouseTaxpayerID = digits(ret.spouse.ssn)
    v.spouseFirstName = upper(sp.first)
    if (sp.mi) v.spouseMiddleInitial = upper(sp.mi)
    v.spouseLastName = upper(sp.last)
    if (sp.suffix) v.spouseSuffix = upper(sp.suffix)
  }
  v.homeAddress = upper(c.street)
  // The apartment number has no field of its own; it follows the street.
  if (c.apt.trim()) v.homeAddress = upper(`${c.street} APT ${c.apt.replace(/^(apt|#)\s*/i, '')}`)
  v.city = upper(c.city)
  v.state = upper(c.state).slice(0, 2)
  v.zip = digits(c.zip).length > 5 ? `${digits(c.zip).slice(0, 5)}-${digits(c.zip).slice(5, 9)}` : digits(c.zip)
  v.filingStatusRadio = STATUS_BUTTON[de.status]
  if (ret.canBeClaimedAsDependent) v.PITRES_ClaimDependent = true
  for (const k of ['1', '4', '10', '12']) both(k, true)
  for (const k of ['2', '3', '5', '6', '7', '8a', '8b', '9', '11']) both(k)
  // The field names drop the "a" of line 8a.
  if (v.ln8aColB !== undefined) { v.ln08ColB = v.ln8aColB; delete v.ln8aColB }
  if (v.ln8aColA !== undefined) { v.ln08ColA = v.ln8aColA; delete v.ln8aColA }
  if (v.ln8bColB !== undefined) { v.ln08bColB = v.ln8bColB; delete v.ln8bColB }
  if (v.ln8bColA !== undefined) { v.ln08bColA = v.ln8bColA; delete v.ln8bColA }
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '9']) {
    for (const col of ['A', 'B']) if (v[`ln${k}Col${col}`] !== undefined) { v[`ln0${k}Col${col}`] = v[`ln${k}Col${col}`]; delete v[`ln${k}Col${col}`] }
  }
  // Line 6 and 8b boxes: column B is "you", column A "spouse" (status 4).
  const colOf = (o: Owner): 'Self' | 'Spouse' => (o === 'spouse' && two ? 'Spouse' : 'Self')
  for (const o of ['taxpayer', 'spouse'] as Owner[]) {
    if (!(de.status === 2 || two) && o === 'spouse') continue
    const who = two ? colOf(o) : o === 'taxpayer' ? 'Self' : 'Spouse'
    if (d.militaryPension[o] && (two ? (o === 'spouse' ? A['6'] : B['6']) : B['6']) > 0) v[`ln06${who}MP`] = true
    if ((d.tuition529[o] ?? 0) > 0) v[`ln08b${who}529`] = true
    if ((d.able[o] ?? 0) > 0) v[`ln08b${who}ABLE`] = true
  }
  if (de.itemize) for (const k of ['13', '14', '15', '16', '17', '18', '19']) both(k, ['13', '17', '19'].includes(k))

  // ── Page 2 ──
  v.tpName = headerName(ret, de)
  v.tpID = digits(ret.taxpayer.ssn)
  v.ln20DeductionType = de.itemize ? '#1' : '#0'
  both('20', true)
  both('21')
  if (!de.itemize) {
    const old = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age >= 65 || (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age65OrOlder
    const people: [Owner, 'ColA' | 'ColB'][] = two ? [['spouse', 'ColA'], ['taxpayer', 'ColB']] : de.status === 2 ? [['spouse', 'ColA'], ['taxpayer', 'ColB']] : [['taxpayer', 'ColB']]
    for (const [o, col] of people) {
      const p = o === 'taxpayer' ? ret.taxpayer : ret.spouse
      if (old(o)) v[`ln21${col}over65`] = true
      if (p.blind) v[`ln21${col}blind`] = true
    }
  }
  for (const k of ['22', '23', '24', '26']) both(k, true)
  for (const k of ['25', '27a', '27b', '28', '29', '30', '31']) both(k)
  both('32', true)
  both('33', true)
  const exA = two ? de.exemptions.A : 0
  const exB = de.exemptions.B
  if (exA + exB > 0) {
    v.ln27aNoOfExemptions = String(exA + exB)
    v.ln27aNoOfExemptionsColB = String(exB)
    if (two) v.ln27aNoOfExemptionsColA = String(exA)
  }
  const sixty = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age >= 60 || (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age65OrOlder
  const married = de.status === 2 || two
  let boxes = 0
  if (sixty('taxpayer')) { v.ln27bChkBoxSelfOver65 = true; boxes++ }
  if (married && sixty('spouse')) { v.ln27bChkBoxSpouseOver65 = true; boxes++ }
  if (boxes) v.ln27bnumberBoxesChecked = String(boxes)
  if (d.firefighter.taxpayer.trim()) v.ln29SelfFirefighter = upper(d.firefighter.taxpayer)
  if (married && d.firefighter.spouse.trim()) v.ln29SpouseFirefighter = upper(d.firefighter.spouse)
  if (de.eitc) {
    both('34', true)
    v.eitcRefundable = de.eitc.l16 > 0 ? '#0' : '#1'
  }
  for (const k of ['35', '36', '37', '38', '39']) both(k)
  both('40', true)

  // ── Page 3 ──
  both('41')
  both('42')
  money('ln43ColB', L['43'])
  money('ln44ColB', L['44'])
  money('ln45ColB', L['45'])
  if (L['45'] > 0) v.pitund = true
  money('ln46ColB', L['46'], L['47'] === 0)
  money('ln47ColB', L['47'], L['46'] === 0)
  if (L['47'] > 0) {
    const dep = ret.refundDeposit
    const route = digits(dep.routingNumber)
    const acct = dep.accountNumber.replace(/[^0-9A-Za-z-]/g, '').toUpperCase()
    if (route.length === 9 && acct) {
      v.directDepositRoutingNum = route
      v.directDepositAcctNum = acct.slice(0, 17)
      v.directDepositType = dep.accountType === 'savings' ? '#1' : '#0'
      v.foreignAccount = '#1'
    }
  }
  if (d.dmvId.trim()) v.dmvStateID = upper(d.dmvId).replace(/[^0-9A-Z]/g, '').slice(0, 9)
  if (c.phone.trim()) v.homePhone = fmtPhone(c.phone)
  if (c.email.trim()) v.emailAddress = c.email.trim()
  if (ret.usePaidPreparer && preparer) {
    if (preparer.firmAddress.trim()) {
      const parts = preparer.firmAddress.split(',').map((s) => s.trim())
      const m = (parts[parts.length - 1] ?? '').match(/^([A-Za-z]{2})\s+(\d{5}(?:-?\d{4})?)$/)
      if (m && parts.length >= 3) {
        v.ppSigAddress = upper(parts.slice(0, -2).join(', '))
        v.ppSigCity = upper(parts[parts.length - 2])
        v.ppSigState = m[1].toUpperCase()
        v.ppSigZip = m[2]
      } else v.ppSigAddress = upper(preparer.firmAddress)
    }
    v.ppSigEINSSNPTIN = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9)
    if (preparer.phone.trim()) v.ppSigPhone = fmtPhone(preparer.phone)
  }
  return { id: 'de-res', file: 'de-pitres.pdf', title: 'Delaware Form PIT-RES', values: v }
}

export function formPitRss(ret: TaxReturnInput, de: DeResult): FormFill | null {
  const d = ret.de
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  const two = de.status === 4
  const pages: number[] = []
  // ── Schedule I ──
  const credit = (de.A['28'] ?? 0) + (de.B['28'] ?? 0)
  if (credit > 0) {
    v['PIT-RSS_Ln01State'] = upper(d.otherState.state).slice(0, 2)
    const col = two && d.otherState.owner === 'spouse' ? '0030' : '0040'
    const tot = col === '0030' ? '0050' : '0060'
    money(`PIT-RSS_${col}-1`, credit, true)
    money(`PIT-RSS_${tot}`, credit, true)
  }
  // ── Schedule II ──
  const e = de.eitc
  if (e) {
    deEitcChildren(ret).forEach((k, i) => {
      const n = i + 1
      const parts = k.name.trim().split(/\s+/)
      const last = parts.length > 1 ? parts.pop() ?? '' : ret.taxpayer.lastName
      v[`PIT-RSS_0070-${n}`] = upper(parts.join(' '))
      v[`PIT-RSS_0080-${n}`] = upper(last)
      if (k.ssn) v[`PIT-RSS_0090-${n}`] = digits(k.ssn)
      const dob = d.dependentBirthDates[k.id] ?? ''
      if (dob.trim()) v[`PIT-RSS_0100-${n}`] = mmddyyyy(dob)
      v[`ln10Child${n}`] = k.age < 24 && k.student ? '#0' : '#1'
      v[`ln11Child${n}`] = k.disabled ? '#0' : '#1'
    })
    money('PIT-RSS_0150', e.l12, true)
    money('PIT-RSS_0160', e.l13, true)
    money('PIT-RSS_0170', e.l14, true)
    money('PIT-RSS_0180', e.l15, true)
    if (e.l16 > 0) money('PIT-RSS_0190', e.l16, true)
    else money('PIT-RSS_0195', e.l17, true)
  }
  if (credit > 0 || e) pages.push(0)
  // ── Schedule III ──
  if (de.lines['43'] > 0) {
    for (const [letter, field] of DE_FUNDS) money(`PIT-RSS_${field}`, d.contributions[letter])
    money('PIT-RSS_0400', de.lines['43'], true)
    pages.push(1)
  }
  // ── Schedules IV and V ──
  const owners: Owner[] = de.status === 2 || two ? ['taxpayer', 'spouse'] : ['taxpayer']
  const rows: { type: 'w2' | '1099'; name: string; ein: string; state: string; wages: number; tax: number; owner: Owner }[] = []
  for (const w of ret.w2s.filter((x) => owners.includes(x.owner))) {
    const s = d.w2[w.id]
    if (!s || !(s.stateTax > 0)) continue
    rows.push({ type: 'w2', name: w.employer, ein: s.ein, state: 'DE', wages: s.stateIncome ?? w.wages, tax: s.stateTax, owner: w.owner })
  }
  for (const x of ret.retirement.filter((y) => owners.includes(y.owner))) {
    const s = d.r1099[x.id]
    if (!s || !(s.stateTax > 0)) continue
    rows.push({ type: '1099', name: x.payer, ein: s.ein, state: 'DE', wages: s.stateIncome ?? x.taxableAmount, tax: s.stateTax, owner: x.owner })
  }
  rows.slice(0, 11).forEach((row, i) => {
    const n = i + 1
    const nn = String(n).padStart(2, '0')
    v[`Sch4RadioLn${nn}`] = row.type === 'w2' ? '#0' : '#1'
    v[`PIT-RSS_0510-${n}`] = upper(row.name).slice(0, 40)
    if (row.ein) v[`PIT-RSS_0520-${n}`] = digits(row.ein)
    v[`PIT-RSS_0530-${n}`] = row.state
    money(`PIT-RSS_0540-${n}`, row.wages, true)
    money(`PIT-RSS_0550-${n}`, row.tax, true)
    v[`sch4TPSpouse${nn}`] = row.owner === 'spouse' ? '#1' : '#0'
  })
  const scorp = d.sCorp.filter((x) => x.amount > 0).slice(0, 8)
  scorp.forEach((x, i) => {
    const n = i + 1
    if (x.fein) v[`PIT-RSS_0600-${n}`] = digits(x.fein)
    v[`PIT-RSS_0610-${n}`] = upper(x.name)
    v[`PIT-RSS_0620-${n}`] = digits((x.owner === 'spouse' ? ret.spouse : ret.taxpayer).ssn)
    money(`PIT-RSS_0630-${n}`, x.amount, true)
  })
  if (rows.length + scorp.length > 0) pages.push(2)
  if (!pages.length) return null
  v['PIT-RSS_TaxpayerName'] = headerName(ret, de)
  v['PIT-RSS_TaxpayerID'] = digits(ret.taxpayer.ssn)
  return { id: 'de-rss', file: 'de-pitrss.pdf', title: 'Delaware Form PIT-RSS', values: v, pages }
}

export function formPitRsa(ret: TaxReturnInput, de: DeResult): FormFill | null {
  if (!de.itemize) return null
  const S = de.rsa
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  v.PIT_RSA_0000 = headerName(ret, de)
  v.PIT_RSA_0010 = digits(ret.taxpayer.ssn)
  money('ln01', S['1'])
  money('ln02', S['2'], true)
  money('ln03', S['3'], true)
  money('ln04', S['4'], true)
  money('ln05a', S['5a'])
  if (S['5b'] > 0) { money('ln05b', S['5b']); v.ln05bChk = true }
  money('ln05c', S['5c'])
  money('ln05d', S['5d'])
  money('ln05e', S['5e'], true)
  money('ln05f', S['5f'], true)
  money('ln07', S['7'], true)
  money('ln08a', S['8a'])
  money('ln08e', S['8e'], true)
  money('ln10', S['10'], true)
  money('ln11', S['11'])
  money('ln12', S['12'])
  money('ln14', S['14'], true)
  if (S['16'] > 0) { money('ln16', S['16']); v.ln16Desc1 = 'OTHER ITEMIZED DEDUCTIONS (SEE STATEMENT)' }
  money('ln17a', S['17a'], true)
  if (de.status === 4) { money('ln17bA', de.rsaA, true); money('ln17bB', S['17a'] - de.rsaA, true) }
  const standard = (de.status === 2 ? 6500 : 3250 * (de.status === 4 ? 2 : 1))
  if ((de.A['19'] ?? 0) + (de.B['19'] ?? 0) < standard) v.ln18Chk = true
  return { id: 'de-rsa', file: 'de-pitrsa.pdf', title: 'Delaware Form PIT-RSA', values: v }
}

export function formPitCrs(ret: TaxReturnInput, de: DeResult): FormFill | null {
  const K = de.crs
  if (K['19'] + K['22'] + K['30'] === 0) return null
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  v.taxpayerName = headerName(ret, de)
  v.taxpayerID = digits(ret.taxpayer.ssn)
  for (const k of ['1', '2', '4', '5', '7', '8', '10', '11', '12', '14', '15']) money(`ln${k.padStart(2, '0')}`, K[k])
  for (const k of ['3', '6', '9', '13', '16']) money(`ln${k.padStart(2, '0')}`, K[k])
  if (K['17'] > 0) { v.ln17 = String(K['17']); money('ln18', K['18'], true) }
  money('ln19', K['19'], true)
  money('ln20', K['20'], true)
  money('ln21', K['21'], true)
  money('ln22', K['22'])
  money('ln23', K['23'], true)
  money('ln24', K['24'], true)
  for (const k of ['25', '26', '27', '28', '29']) money(`ln${k}`, K[k])
  money('ln30', K['30'], true)
  return { id: 'de-crs', file: 'de-pitcrs.pdf', title: 'Delaware Form PIT-CRS', values: v }
}

/** Form PIT-UND page 1: Part 1 and the short method (Part 2). */
export function formPitUnd(ret: TaxReturnInput, de: DeResult): FormFill | null {
  const P = de.und
  if (!P || !(de.lines['45'] > 0)) return null
  const v: Record<string, FieldValue> = {}
  const t = ret.taxpayer
  v.tpName = (ret.filingStatus === 'mfj' ? `${t.firstName} & ${ret.spouse.firstName} ${t.lastName}` : `${t.firstName} ${t.lastName}`).trim().toUpperCase()
  v.tpID = t.ssn.replace(/\D/g, '')
  for (const k of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) if (P[k] !== undefined) v[`ln${k}`] = String(Math.round(P[k]))
  if (ret.de.und.farmer) v.farmerFisherman = true
  if (!P['part3']) return { id: 'de-und', file: 'de-pitund.pdf', title: 'Delaware Form PIT-UND', values: v, pages: [0] }
  if (P['annualized']) v.annualizedMethod = true
  const n = (x: number | undefined): string => (x === undefined ? '' : String(Math.round(x)))
  const two = (x: string): string => (x.length === 1 ? `0${x}` : x)
  for (const k of 'abcd') {
    for (const ln of ['2', '4', '5', '7', '8', '9', '10', '11', '12', '13']) v[`ln${two(ln)}${k}`] = n(P[`${ln}${k}`])
    for (const ln of ['15', '17', '18', '20', '22', '23', '25', '27', '28', '29', '30', '31', '35', '37', '38']) v[`ln${ln}${k}`] = n(P[`${ln}${k}`])
    if (k !== 'a') for (const ln of ['21', '24', '32', '33', '34']) v[`ln${ln}${k}`] = n(P[`${ln}${k}`])
    if (k !== 'd') v[`ln26${k}`] = n(P[`26${k}`])
    if (k === 'b' || k === 'c') v[`ln36${k}`] = n(P[`36${k}`])
    if (P[`40${k}`] !== undefined) { v[`ln40${k}`] = String(P[`40${k}`]); v[`ln41${k}`] = P[`41${k}`].toFixed(4); v[`ln42${k}`] = P[`42${k}`].toFixed(2) }
  }
  v.ln43 = n(P['43'])
  return { id: 'de-und', file: 'de-pitund.pdf', title: 'Delaware Form PIT-UND', values: v, pages: [0, 1, 2] }
}

export function buildDePacket(ret: TaxReturnInput, res: TaxReturnResult, de: DeResult, preparer?: PreparerInfo | null): FormPacket {
  const forms = [formPitRes(ret, res, de, preparer), formPitRss(ret, de), formPitRsa(ret, de), formPitCrs(ret, de), formPitUnd(ret, de)].filter((x): x is FormFill => x !== null)
  const notIncluded = [...de.attach]
  if (de.undPieces.length && forms.some((f) => f.file === 'de-pitund.pdf')) {
    const us = (iso: string): string => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`
    const c2 = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    forms.push(...statementForms(ret, {
      id: 'st-de-und', attachTo: 'Form PIT-UND, Part 5 (lines 39–42)', title: 'Underpayments paid off by more than one payment',
      columns: [{ label: 'Column', width: 50 }, { label: 'Due date', width: 70 }, { label: 'Part of underpayment', width: 100, right: true }, { label: 'Paid on', width: 70 }, { label: 'Days', width: 50, right: true }, { label: 'Rate (0.05% a day)', width: 80, right: true }, { label: 'Penalty', width: 80, right: true }],
      rows: de.undPieces.map((x) => [`(${x.period})`, us(x.due), c2(x.amount), us(x.paid), String(x.days), (Math.round(x.days * 0.0005 * 10000) / 10000).toFixed(4), c2(x.penalty)]),
      note: 'Line 42 of each column is the sum of its parts. Payments are applied first to the earliest unpaid installment.'
    }))
  }
  return { forms, notIncluded }
}
