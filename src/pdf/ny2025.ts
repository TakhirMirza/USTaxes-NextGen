/**
 * Maps a computed New York return onto the Department of Taxation and Finance fill-in PDFs (2025):
 * Form IT-201 (public/forms/2025/nyit201.pdf), IT-213 (nyit213.pdf) and IT-215 (nyit215.pdf).
 * Amounts are whole dollars; losses carry a minus sign.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { careQualifyingPerson, eicChild } from '../engine/compute.ts'
import type { NyResult } from '../engine/ny2025.ts'
import { parseBirthDate } from '../engine/va2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return String(v)
}
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const splitName = (full: string): [string, string] => {
  const parts = full.trim().split(/\s+/)
  return parts.length > 1 ? [parts.slice(0, -1).join(' '), parts[parts.length - 1]] : [full.trim(), '']
}
/** MMDDYYYY. */
const dob = (v: string): string => {
  const d = parseBirthDate(v)
  return d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${d.getUTCFullYear()}` : ''
}
const upper = (s: string): string => s.toUpperCase()
const displayName = (ret: TaxReturnInput): string => {
  const t = `${ret.taxpayer.firstName.trim()} ${ret.taxpayer.lastName.trim()}`.trim()
  return ret.filingStatus === 'mfj' && ret.spouse.firstName.trim() ? `${t} & ${ret.spouse.firstName.trim()} ${ret.spouse.lastName.trim()}`.trim() : t
}
const STATUS: Record<TaxReturnInput['filingStatus'], string> = {
  single: '1 Single',
  mfj: '2 Married Filing Joint Return (enter spouses social security number above)',
  mfs: '3 Married Filing Seperate Return (enter spouses social security number above)',
  hoh: 'Head of Household (with qualifying person)',
  qss: 'Qualifying widow(er) with dependent child'
}

export function formIT201(ret: TaxReturnInput, res: TaxReturnResult, ny: NyResult, preparer?: PreparerInfo | null): FormFill {
  const L = ny.lines
  const d = ret.ny
  const c = ret.contact
  const joint = ret.filingStatus === 'mfj'
  const showSpouse = joint || ret.filingStatus === 'mfs'
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const values: Record<string, FieldValue> = {
    TP_first_name: upper(first), TP_MI: upper(mi), TP_last_name: upper(ret.taxpayer.lastName.trim()), TP_DOB: dob(d.birthDate.taxpayer), TP_SSN: digits(ret.taxpayer.ssn),
    Spouse_first_name: showSpouse ? upper(sFirst) : '', Spouse_MI: showSpouse ? upper(sMi) : '', Spouse_last_name: showSpouse ? upper(ret.spouse.lastName.trim()) : '',
    Spouse_DOB: joint ? dob(d.birthDate.spouse) : '', Spouse_SSN: showSpouse ? digits(ret.spouse.ssn) : '',
    TP_mail_address: upper(c.street.trim()), TP_mail_apt: upper(c.apt.trim()), TP_mail_city: upper(c.city.trim()), TP_mail_state: upper(c.state.trim()), TP_mail_zip: digits(c.zip).slice(0, 5),
    TP_home_address: upper(c.street.trim()), TP_home_apt: upper(c.apt.trim()), TP_home_city: upper(c.city.trim()), TP_home_zip: digits(c.zip).slice(0, 5),
    NYS_county_residence: upper(d.county.trim()), SD_name: upper(d.schoolDistrict.trim()), SD_code: digits(d.schoolDistrictCode).slice(0, 3),
    Filing_status: STATUS[ret.filingStatus],
    Itemized: res.deduction.used === 'itemized' ? 'yes' : 'no',
    Dependent: ret.canBeClaimedAsDependent ? 'yes' : 'no',
    yonkers_freeze_credit: d.locality === 'yonkers' ? 'yes' : 'no',
    D1_Yonkers: d.locality === 'yonkers' ? '12' : '', D3_Yonkers: d.locality === 'yonkers' && joint ? '12' : '',
    E1: d.locality === 'nyc' ? 'yes' : 'no', E2: d.locality === 'nyc' ? '365' : '',
    F1_NYC: d.locality === 'nyc' ? '12' : '', F2_NYC: d.locality === 'nyc' && joint ? '12' : '',
    Name_as_page1: displayName(ret),
    '34Deduction': ny.deduction.method === 'itemized' ? 'Itemized' : 'Standard',
    H_additional_dependents: ret.dependents.length > 7
  }
  ret.dependents.slice(0, 7).forEach((dep, i) => {
    const n = i + 1
    const [f, l] = splitName(dep.name)
    values[`H_first${n}`] = upper(f)
    values[`H_last${n}`] = upper(l)
    values[`H_relationship${n}`] = upper(dep.relationship)
    values[`H_dependent_ssn${n}`] = digits(dep.ssn)
    values[`H_dependent_dob${n}`] = dob(d.dependentBirthDates[dep.id] ?? '')
  })
  const keep = new Set(['19', '24', '33', '35', '37', '38', '39', '44', '46', '58', '59', '61', '62', '76'])
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '47a', '48', '49', '50', '51', '52', '53', '54', '54a', '54b', '54c', '54d', '54e', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '69a', '70', '70a', '71', '72', '73', '74', '75', '76', '77', '78', '78a', '78b', '79', '80', '81', '82']) {
    values[`Line${k}`] = amt(L[k], keep.has(k) || (k === '34'))
  }
  values.Line36 = amt(L['36'])
  values.Line12 = amt(L['12'])
  if (L['16']) values['15_identify'] = 'SEE FEDERAL RETURN'
  if (L['18']) values['18_identify'] = 'SEE FEDERAL SCHEDULE 1'
  const dd = ret.refundDeposit
  if (L['78b'] > 0) {
    const deposit = digits(dd.routingNumber).length === 9 && !!digits(dd.accountNumber)
    values.Line78_refund = deposit ? 'direct deposit' : 'check'
    if (deposit) {
      values.Line83a_account = dd.accountType === 'savings' ? 'personal savings' : 'personal checking'
      values.Line83b_routing = digits(dd.routingNumber)
      values.Line83c_account_num = dd.accountNumber.replace(/[^0-9A-Za-z]/g, '')
    }
  }
  values.TP_occupation = upper(ret.taxpayer.occupation)
  if (joint) values.Spouse_occupation = upper(ret.spouse.occupation)
  const phone = digits(c.phone).slice(-10)
  if (phone.length === 10) { values.day_ac = phone.slice(0, 3); values.day_phone = `${phone.slice(3, 6)}-${phone.slice(6)}` }
  values.sign_email = c.email.trim()
  if (ret.usePaidPreparer && preparer) {
    Object.assign(values, {
      Prep_name: upper(preparer.name), firm_name: upper(preparer.firmName), Firm_address1: upper(preparer.firmAddress),
      Prep_PTIN_SSN: preparer.ptin.toUpperCase(), Prep_EIN: digits(preparer.firmEin)
    })
  }
  return { id: 'nyit201', file: 'nyit201.pdf', title: 'New York Form IT-201', values }
}

/** Form IT-213: Empire State child credit. */
export function formIT213(ret: TaxReturnInput, res: TaxReturnResult, ny: NyResult): FormFill {
  const L = ny.lines
  const e = ny.escc
  const fagi = Math.floor(Math.max(0, res.f1040['11a']) / 1000) * 1000
  const values: Record<string, FieldValue> = {
    'Page 1 Zone 6': displayName(ret), 'Page 1 Zone 8': digits(ret.taxpayer.ssn),
    'Page 1 Zone 12': e.under4 ? String(e.under4) : '', 'Page 1 Zone 15': amt(e.under4 * 1000),
    'Page 1 Zone 19': e.age4to16 ? String(e.age4to16) : '', 'Page 1 Zone 22': amt(e.age4to16 * 330),
    'Page 1 Zone 26': amt(e.under4 * 1000 + e.age4to16 * 330, true), 'Page 1 Zone 30': amt(fagi, true),
    'Page 1 Zone 39': amt(e.reduction ? Math.round(e.reduction / 0.0165) : 0, true), 'Page 1 Zone 43': amt(e.reduction, true), 'Page 1 Zone 47': amt(L['63'], true)
  }
  ret.dependents.filter((x) => x.childRelationship && x.age < 17).slice(0, 6).forEach((k, i) => {
    const [f, l] = splitName(k.name)
    values[`Page 1 Zone ${51 + i}`] = upper(f)
    values[`Page 1 Zone ${63 + i}`] = upper(l)
    values[`Page 1 Zone ${75 + i}`] = digits(k.ssn)
    values[`Page 1 Zone ${81 + i}`] = dob(ret.ny.dependentBirthDates[k.id] ?? '')
  })
  return { id: 'nyit213', file: 'nyit213.pdf', title: 'New York Form IT-213', values }
}

/** Form IT-215: NYS and NYC earned income credit. */
export function formIT215(ret: TaxReturnInput, res: TaxReturnResult, ny: NyResult): FormFill {
  const L = ny.lines
  const wages = Math.round(res.f1040['1z'])
  const kids = ret.dependents.filter(eicChild).slice(0, 3)
  const values: Record<string, FieldValue> = {
    'Your last name': displayName(ret), 'Your SSN': digits(ret.taxpayer.ssn),
    'Line 1': 'Yes', 'Line 1a': 'No', 'Line 3': kids.length ? 'Yes' : 'No', 'Line 5': 'No',
    '6 dollars15': amt(wages), '8 dollars15': amt(Math.round(res.eic.earnedIncome) - wages), '9 dollars15': amt(res.f1040['11a'], true),
    '10 dollars15': amt(ny.eic.federal), '12 dollars15': amt(ny.eic.tentative),
    '13 dollars15': amt(ny.eic.worksheetB, true), '14 dollars15': amt(L['40'], true), '15 dollars15': amt(Math.min(ny.eic.worksheetB, L['40']), true),
    '16 dollars15': amt(L['65'], true),
    'Worksheet B 1 dollars15': amt(L['39'], true), 'Worksheet B 2 dollars15': amt(L['41']), 'Worksheet B 4 dollars15': amt(L['41']), 'Worksheet B 5 dollars15': amt(ny.eic.worksheetB, true),
    '27 dollars15': amt(L['70'])
  }
  if (ret.filingStatus === 'mfs') values['Line 2'] = 'Yes'
  kids.forEach((k, i) => {
    const n = i + 1
    const [f, l] = splitName(k.name)
    values[`ln34fn${n}`] = upper(f)
    values[`ln34ln${n}`] = upper(l)
    values[`ln34real${n}`] = upper(k.relationship)
    values[`ln34ssn${n}`] = digits(k.ssn)
    values[`ln34birth${n}`] = dob(ret.ny.dependentBirthDates[k.id] ?? '')
    values[`month${n}`] = String(Math.min(12, k.monthsLivedWithYou))
    values[`ln34student${n}`] = k.age >= 19 && k.student
    values[`ln34disability${n}`] = k.disabled
  })
  return { id: 'nyit215', file: 'nyit215.pdf', title: 'New York Form IT-215', values }
}

/** Form IT-216: NYS and NYC child and dependent care credit. */
export function formIT216(ret: TaxReturnInput, res: TaxReturnResult, ny: NyResult): FormFill {
  const c = ny.care
  const values: Record<string, FieldValue> = {
    'Your last name': displayName(ret), 'Your SSN': digits(ret.taxpayer.ssn),
    'Already Filed': 'No', 'line 4': 'Yes',
    '3 total qualifying persons': String(c.persons), '3a dollars16': amt(c.line3a),
    '5 dollars16': amt(c.line5), '6 dollars16': amt(c.line6), '7 dollars16': amt(c.line7), '8 dollars16': amt(c.line8, true),
    '9 dollars16': amt(res.f1040['11a'], true), 'line 10': String(Math.round(c.line10 * 100)).padStart(2, '0'), '11 dollars16': amt(c.line11, true),
    '12 dollars16': amt(c.line11, true), '13 IT201 filers dollars16': amt(ny.lines['33'], true), '13 first number16': c.line13.toFixed(3),
    '14 dollars16': amt(c.line14, true), '23 dollars16': amt(c.nycCredit ? c.under4Expenses : 0), '24 dollars16': amt(c.nycCredit),
    '25 dollars16': amt(ny.lines['64'], true)
  }
  ret.dependentCare.providers.slice(0, 2).forEach((p, i) => {
    const n = i + 1
    values[`2_${n}_a`] = upper(p.name)
    values[`2_${n}_b_street`] = upper(p.address)
    values[`2_${n}_c`] = digits(p.tin)
    values[`2_${n}_d`] = amt(p.amountPaid)
  })
  const persons = ret.dependents.filter(careQualifyingPerson).sort((a, b) => a.age - b.age).slice(0, 5)
  const ssnField = ['3 social security number16', '3 social security 216', '3 social security number316', '3 social security 416', '3 social security 516']
  const dobField = ['3 Year of Birth16', '3 Year of Birth 216', '3 Year of Birth316', '3 Year of Birth 416', '3 Year of Birth 516']
  persons.forEach((p, i) => {
    const n = `${i + 1}16`
    const [f, l] = splitName(p.name)
    values[`3 first name ${n}`] = upper(f)
    values[`3 last name ${n}`] = upper(l)
    values[ssnField[i]] = digits(p.ssn)
    values[dobField[i]] = dob(ret.ny.dependentBirthDates[p.id] ?? '')
    values[`disability ${n}`] = p.disabled
    if (persons.length === 1) values[`3 qualified expenses ${n}`] = amt(c.line3a)
  })
  return { id: 'nyit216', file: 'nyit216.pdf', title: 'New York Form IT-216', values }
}

/** Form IT-270: NYC income tax elimination credit. */
export function formIT270(ret: TaxReturnInput, res: TaxReturnResult, ny: NyResult): FormFill {
  const e = ny.elimination
  return {
    id: 'nyit270', file: 'nyit270.pdf', title: 'New York Form IT-270',
    values: {
      NameReturn: displayName(ret), SSN: digits(ret.taxpayer.ssn),
      LineA: 'Yes', LineB: 'No', LineC: 'No', LineD: 'No', LineE: 'No',
      Line1: amt(res.f1040['11a'], true), Line2: amt(e.threshold, true), Line3: amt(e.line3, true), Line4: amt(5000 - e.line3, true),
      Line5: e.line5.toFixed(4), Line6: amt(ny.lines['54'], true), Line7: amt(ny.care.nycCredit, true), Line8: amt(ny.lines['70'], true),
      Line9: amt(ny.care.nycCredit + ny.lines['70'], true), Line10: amt(e.line10, true), Line11: amt(ny.lines['70a'], true)
    }
  }
}

/** Form IT-196: New York itemized deductions. */
export function formIT196(ret: TaxReturnInput, res: TaxReturnResult, ny: NyResult): FormFill {
  const L = ny.deduction.it196?.lines ?? {}
  const values: Record<string, FieldValue> = { Name: displayName(ret), SSN: digits(ret.taxpayer.ssn) }
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '9', '10', '15', '16', '17', '19', '25', '26', '27', '28', '39', '40', '41', '42', '44', '45', '46', '47', '48', '49']) values[`Line${k}`] = amt(L[k])
  if (L['5']) values.Line5ab = 'Income'
  values.Over_line19 = Math.round(res.f1040['11a']) > 204400 ? 'Yes' : 'No'
  if (L['25']) values.Line21 = amt(L['25'])
  return { id: 'nyit196', file: 'nyit196.pdf', title: 'New York Form IT-196', values }
}

export function buildNyPacket(ret: TaxReturnInput, res: TaxReturnResult, ny: NyResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formIT201(ret, res, ny, preparer)]
  if (ny.escc.under4 + ny.escc.age4to16 > 0) forms.push(formIT213(ret, res, ny))
  if (ny.lines['65'] > 0 || ny.lines['70'] > 0) forms.push(formIT215(ret, res, ny))
  if (ny.lines['64'] > 0) forms.push(formIT216(ret, res, ny))
  if (ny.lines['70a'] > 0) forms.push(formIT270(ret, res, ny))
  if (ny.deduction.method === 'itemized') forms.push(formIT196(ret, res, ny))
  const filled = new Set(['Form IT-213, Empire State child credit', 'Form IT-215, earned income credit', 'Form IT-216, child and dependent care credit', 'Form IT-270, NYC income tax elimination credit', 'Form IT-196, New York itemized deductions'])
  const notIncluded = ny.attach.filter((a) => !filled.has(a))
  notIncluded.push('Item D1 on page 1: mark whether you had a financial account in a foreign country')
  if (ret.dependents.length > 7) notIncluded.push('Form IT-201 item H continued: dependents after the seventh')
  if (ny.lines['64'] > 0) {
    notIncluded.push('Form IT-216 line 2: each care provider’s city, state and ZIP code')
    if (ret.dependents.filter(careQualifyingPerson).length > 1) notIncluded.push('Form IT-216 line 3 column C: split the care expenses among the qualifying persons')
  }
  return { forms, notIncluded }
}
