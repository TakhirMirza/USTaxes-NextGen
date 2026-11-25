/**
 * Fills the official 2025 Idaho Form 40 (public/forms/2025/id-40.pdf, the three form pages) and Form 39R
 * (public/forms/2025/id-39r.pdf, two pages). Whole dollars: the cents are preprinted.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { IdResult } from '../engine/id2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const ssnFmt = (s: string): string => {
  const x = digits(s)
  return x.length === 9 ? `${x.slice(0, 3)}-${x.slice(3, 5)}-${x.slice(5)}` : x
}
const splitName = (full: string): [string, string] => {
  const parts = full.trim().split(/\s+/)
  if (parts.length < 2) return [parts[0] ?? '', '']
  const last = parts.pop() ?? ''
  return [parts.join(' '), last]
}
const nameParts = (first: string): [string, string] => {
  const parts = first.trim().split(/\s+/)
  const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? parts.pop() ?? '' : ''
  return [parts.join(' '), mi.replace('.', '')]
}

export function formId40(ret: TaxReturnInput, res: TaxReturnResult, id: IdResult, preparer?: PreparerInfo | null): FormFill {
  const L = id.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const d = ret.id
  const v: Record<string, FieldValue> = {}
  const money = (name: string, n: number, always = false): void => {
    const x = Math.round(n)
    if (x === 0 && !always) return
    v[name] = x < 0 ? `-${-x}` : String(x)
  }
  const tp = ret.taxpayer
  const sp = ret.spouse

  // ── Page 1 ──
  const [tf, tmi] = nameParts(tp.firstName)
  v['FirstName1'] = upper(tf)
  if (tmi) v['Initial1'] = upper(tmi)
  v['LastName1'] = upper(tp.lastName)
  v['SSN'] = ssnFmt(tp.ssn)
  if (joint || fs === 'mfs') {
    const [sf, smi] = nameParts(sp.firstName)
    v['FirstName2'] = upper(sf)
    if (smi) v['MiddleInitial2'] = upper(smi)
    v['LastName2'] = upper(sp.lastName)
    v['SpouseSSN'] = ssnFmt(sp.ssn)
  }
  v['CurrentMailing'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['City'] = upper(c.city)
  v['StateAbbrv'] = upper(c.state).slice(0, 2)
  v['ZIPcode'] = digits(c.zip).slice(0, 9)
  v[{ single: 'FilingStatusSingle', mfj: 'FilingStatusMarriedJoint', mfs: 'FilingStatusMarriedSeparate', hoh: 'FilingStatusHead', qss: 'SpouseDeceased' }[fs]] = true
  const h = id.household
  if (h.a) v['6aYourself'] = String(h.a)
  if (h.b) v['6bSpouse'] = String(h.b)
  if (h.c) v['6cDependents'] = String(h.c)
  v['6dTotalHousehold'] = String(h.d)
  ret.dependents.slice(0, 4).forEach((x, i) => {
    const [first, last] = splitName(x.name)
    v[`6cDependent${i + 1}First`] = upper(first)
    v[`6cDependent${i + 1}Last`] = upper(last)
    v[`6cDependent${i + 1}SSN`] = ssnFmt(x.ssn)
    const b = (d.dependentBirthDates[x.id] ?? '').trim()
    if (b) v[`6cDependent${i + 1}Birthdate`] = b
  })
  money('IncomeL7', L['7'], true)
  money('IncomeL8', L['8'])
  money('IncomeL9', L['9'], true)
  money('IncomeL10', L['10'])
  money('IncomeL11', L['11'], true)

  // ── Page 2 ──
  const b = id.boxes
  if (b.old.taxpayer) v['L12aYourself '] = true
  if (b.old.spouse) v['L12aSpouse'] = true
  if (b.blind.taxpayer) v['L12bYourself'] = true
  if (b.blind.spouse) v['L12bSpouse'] = true
  if (b.dependent) v['L12cDependent'] = true
  money('TxCompL13', L['13'])
  money('TxCompL14', L['14'])
  money('TxCompL15', L['15'])
  money('TxCompL16', L['16'], true)
  money('TxCompL17', L['17'], true)
  money('TxCompL18', L['18'])
  money('IncomeL19', L['19'], true)
  money('TxCompL20', L['20'], true)
  money('CreditsL21', L['21'])
  money('CreditsL22', L['22'])
  money('CreditsL24', L['24'])
  money('CreditsL25', L['25'])
  money('CreditsL26', L['26'], true)
  money('OtherTaxesL28', L['28'])
  if (d.publicAssistance) v['OtherTaxesL31Check'] = true
  money('OtherTaxesL32', L['32'], true)
  for (const k of ['33', '34', '35', '36', '37', '38', '39', '40']) money(`DonationsL${k}`, L[k])
  money('DonationsL41', L['41'], true)

  // ── Page 3 ──
  money('FoodCreditL42 Amount 2', L['42'])
  money('FoodCreditL43-1 Amount 1', L['43calc'])
  if (d.donateFoodCredit) { v['FoodCreditL43-3 DonateCheckbox'] = true; v['PymntOtherCredit Donate L43-4 Amount 4'] = '0' } else money('PymntOtherCredit Donate L43-4 Amount 4', L['43'])
  money('PymntOtherCreditL44', L['44'])
  money('PymntOtherCreditL46', L['46'])
  money('PymntOtherCreditL47', L['47'])
  if (L['48'] > 0) { money('PymntOtherCreditL48-1 Paid 3', L['48']); money('PymntOtherCreditL48-4 Amount 3', L['48']) }
  money('PymntOtherCreditL50 Total 3', L['50'], true)
  money('TxDueRefundL51', L['51'])
  money('TxDueRefundL54', L['54'])
  money('TxDueRefundL55', L['55'])
  money('RefundedL56-1', L['56'])
  money('AppliedL56-2', L['56applied'])
  if (L['56'] > 0) {
    const dep = ret.refundDeposit
    const route = digits(dep.routingNumber)
    const acct = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (route.length === 9 && acct) {
      route.split('').forEach((ch, i) => { v[`DirectDepositL57Route ${i + 2}`] = ch })
      acct.slice(0, 17).split('').forEach((ch, i) => { v[`DirectDepositL57Acct${i + 2}`] = ch })
      v[dep.accountType === 'savings' ? 'DirectDepositSavingsL57-3  2' : 'DirectDepositCheckingL57-2 2'] = true
    }
  }
  if (c.phone.trim()) v['TaxpayerPhoneNo 2'] = c.phone.trim()
  if (ret.usePaidPreparer && preparer) {
    v['EIN SSN PTIN 2'] = preparer.ptin.toUpperCase()
    v['PreparerAddress 2'] = upper(preparer.firmAddress)
    v['PreparerPhoneNo 2'] = preparer.phone
  }
  void res
  return { id: 'id40', file: 'id-40.pdf', title: 'Idaho Form 40', values: v }
}

export function formId39R(ret: TaxReturnInput, id: IdResult): FormFill {
  const S = id.s39
  const d = ret.id
  const joint = ret.filingStatus === 'mfj'
  const tp = ret.taxpayer
  const sp = ret.spouse
  const v: Record<string, FieldValue> = {}
  const money = (name: string, n: number | undefined): void => {
    const x = Math.round(n ?? 0)
    if (x !== 0) v[name] = String(x)
  }
  v['Names'] = upper(joint ? `${tp.firstName} ${tp.lastName} & ${sp.firstName} ${sp.lastName}` : `${tp.firstName} ${tp.lastName}`)
  v['SSN'] = ssnFmt(tp.ssn)
  money('AL3', S['A3']); money('AL6', S['A6']); money('AL7', S['A7'])
  money('BL2', S['B2']); money('BL3', S['B3']); money('BL6', S['B6']); money('BL7', S['B7'])
  if ((S['B8e'] ?? 0) > 0) {
    v['BL8a'] = String(S['B8a'])
    money('BL8c', S['B8c'])
    v['BL8d'] = String(S['B8d'])
    v['BL8e'] = String(S['B8e'])
    money('BL8f', S['B8f'])
  }
  money('BL14', S['B14']); money('BL18', S['B18']); money('BL19', S['B19']); money('BL23', S['B23']); money('BL24', S['B24'])
  if ((S['C7'] ?? 0) > 0) {
    v['CClaimed'] = upper(d.otherState.name)
    v['CL1'] = String(S['C1']); v['CL2'] = String(S['C2']); v['CL3'] = String(S['C3'])
    v['CL4'] = (S['C4'] * 100).toFixed(2)
    v['CL5'] = String(S['C5']); v['CL6'] = String(S['C6']); v['CL7'] = String(S['C7'])
  }
  money('DL4', S['D4'])
  if (S['E4'] > 0) {
    const anyOld = d.homeMembers.some((m) => !m.disabled)
    const anyDisabled = d.homeMembers.some((m) => m.disabled)
    v[anyOld ? 'EL1-Yes' : 'EL1-No 2'] = true
    v[anyDisabled ? 'EL2-Yes 2' : 'EL2-No 2'] = true
    d.homeMembers.slice(0, 3).forEach((m, i) => {
      const [first, last] = splitName(m.name)
      v[`EL3R${i + 1}FirstName`] = upper(first)
      v[`EL3R${i + 1}LastName`] = upper(last)
      v[`EL3R${i + 1}SSN`] = ssnFmt(m.ssn)
      v[`EL3R${i + 1}Relationship`] = upper(m.relationship)
      if (m.birthDate.trim()) v[`EL3R${i + 1}Birthdate`] = m.birthDate.trim()
      if (m.disabled) v[`EL3R${i + 1}Disabled`] = true
    })
    v['EL4'] = String(S['E4'])
  }
  ret.dependents.slice(4, 7).forEach((x, i) => {
    const [first, last] = splitName(x.name)
    v[`FR${i + 1}FirstName`] = upper(first)
    v[`FR${i + 1}LastName`] = upper(last)
    v[`FR${i + 1}SSN`] = ssnFmt(x.ssn)
    const b = (d.dependentBirthDates[x.id] ?? '').trim()
    if (b) v[`FR${i + 1}Birthdate`] = b
  })
  return { id: 'id39r', file: 'id-39r.pdf', title: 'Idaho Form 39R', values: v }
}

export function buildIdPacket(ret: TaxReturnInput, res: TaxReturnResult, id: IdResult, preparer?: PreparerInfo | null): FormPacket {
  const forms = [formId40(ret, res, id, preparer)]
  if (id.attach.some((x) => x.startsWith('Form 39R'))) forms.push(formId39R(ret, id))
  const notIncluded = id.attach.filter((x) => !x.startsWith('Form 39R'))
  forms.push(...dependentsStatement(ret, 7, 'Form 40, Dependents (continued)', 'st-id-deps'))
  return { forms, notIncluded }
}
