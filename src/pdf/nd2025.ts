/**
 * Fills the official 2025 North Dakota Form ND-1 (public/forms/2025/nd-nd1.pdf: the Office of State Tax
 * Commissioner’s fill-in form, SFN 28702 12-2025). Whole dollars.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { NdResult } from '../engine/nd2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const phone = (s: string): string => {
  const x = digits(s).slice(-10)
  return x.length === 10 ? `${x.slice(0, 3)}-${x.slice(3, 6)}-${x.slice(6)}` : x
}
const ssn = (s: string): string => {
  const x = digits(s)
  return x.length === 9 ? `${x.slice(0, 3)}-${x.slice(3, 5)}-${x.slice(5)}` : x
}
const STATUS = { single: 'Single', mfj: 'Married, jointly', mfs: 'Married, separately', hoh: 'Head', qss: 'Surviving Spouse' } as const
/** Field names by line (the field names carry the line number). */
const FIELD: Record<string, string> = {
  '1a': 'SX 1a', '1b': 'SS 1b', '2': 'NK 2', '3': 'AV 3', '4a': 'Line 4a', '4b': 'Line 4b', '5': 'SN 5', '6': 'NC 6', '7': 'S4 7', '8': 'SS 8', '9': 'AW 9',
  '10': 'AX 10', '11': 'NJ 11', '12': 'AA 12', '13': 'AO 13', '14': 'AQ 14', '15': 'AR 15', '16': 'AB 16', '17': 'Line 17', '18': 'ND 18', '19': 'Line 19',
  '20': 'SB 20', '21': 'SD 21', '22': 'AC 22', '23': 'AE 23', '24': 'Line 24', '25': 'SE 25', '26': 'SF 26', '27': 'S& 27', '28': 'AJ 28', '29': 'SG 29',
  '30': 'SQ 30', '31v': 'AS', '31w': 'SP', '31t': 'SW', '31': '31', '32': 'SR 32', '33': 'SZ 33', '35v': 'AT', '35w': 'SU', '35t': 'SY', '35': '35', '36': 'Line 36'
}

export function formNd1(ret: TaxReturnInput, nd: NdResult, preparer?: PreparerInfo | null): FormFill {
  const L = nd.lines
  const d = ret.nd
  const c = ret.contact
  const fs = ret.filingStatus
  const v: Record<string, FieldValue> = {}
  const money = (k: string, always = false): void => {
    const x = Math.round(L[k] ?? 0)
    if (x === 0 && !always) return
    v[FIELD[k]] = x < 0 ? `-${-x}` : String(x)
  }
  v['First Name MI'] = upper(ret.taxpayer.firstName)
  v['Last Name'] = upper(ret.taxpayer.lastName)
  v.SSN = ssn(ret.taxpayer.ssn)
  if (fs === 'mfj' || fs === 'mfs') {
    v['Spouse Name, MI'] = upper(ret.spouse.firstName)
    v['Spouse Last Name'] = upper(ret.spouse.lastName)
    v['Spouse SSN'] = ssn(ret.spouse.ssn)
  }
  v.Address = upper(c.street)
  if (c.apt.trim()) v.Apt = upper(c.apt)
  v.City = upper(c.city)
  v.State = upper(c.state).slice(0, 2)
  v['Zip code'] = digits(c.zip).length > 5 ? `${digits(c.zip).slice(0, 5)}-${digits(c.zip).slice(5, 9)}` : digits(c.zip)
  v[STATUS[fs]] = true
  const school = digits(d.schoolCode)
  if (school.length === 5) { v['B-1'] = school.slice(0, 2); v['B-2'] = school.slice(2) }
  if (d.incomeSourceCode) v.C = d.incomeSourceCode
  for (const k of ['1a', '1b', '4b', '17', '18', '19', '20', '24', '25', '28']) money(k, true)
  for (const k of ['2', '3', '4a', '5', '6', '7', '8', '9', '11', '12', '13', '14', '15', '16', '21', '22', '23', '26', '27']) money(k)
  if (L['29'] > 0) {
    money('29', true)
    money('30')
    for (const k of ['31v', '31w', '31t', '31']) money(k)
    money('32', true)
    const dep = ret.refundDeposit
    const route = digits(dep.routingNumber)
    const acct = dep.accountNumber.replace(/[^0-9A-Za-z-]/g, '').toUpperCase()
    if (L['32'] > 0 && route.length === 9 && acct) {
      v['routing number'] = route
      v['account number'] = acct.slice(0, 17)
      v[dep.accountType === 'savings' ? 'Savings' : 'Checking'] = true
    }
  } else {
    money('33', true)
    for (const k of ['35v', '35w', '35t', '35']) money(k)
    money('36', true)
  }
  if (d.consent1099g) v['1099 G box'] = true
  if (c.phone.trim()) v['day phone'] = phone(c.phone)
  if (ret.usePaidPreparer && preparer) {
    v['preparer name'] = upper(preparer.firmName || preparer.name)
    v.ID = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '')
    if (preparer.phone.trim()) v['preparer phone'] = phone(preparer.phone)
  }
  return { id: 'nd-1', file: 'nd-nd1.pdf', title: 'North Dakota Form ND-1', values: v }
}

export function buildNdPacket(ret: TaxReturnInput, res: TaxReturnResult, nd: NdResult, preparer?: PreparerInfo | null): FormPacket {
  void res
  return { forms: [formNd1(ret, nd, preparer)], notIncluded: nd.attach }
}
