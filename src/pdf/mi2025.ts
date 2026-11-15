/**
 * Maps a computed Michigan return onto the Michigan Department of Treasury fillable PDFs (2025): MI-1040
 * (public/forms/2025/mi1040.pdf), Schedule 1 (mischedule1.pdf), Form 4884 (mi4884.pdf) and MI-1040CR
 * (mi1040cr.pdf). Amounts are whole dollars.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MiResult } from '../engine/mi2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return String(v)
}
const upper = (s: string): string => s.toUpperCase()
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const ssnParts = (s: string): [string, string, string] => { const x = digits(s); return [x.slice(0, 3), x.slice(3, 5), x.slice(5, 9)] }

export function formMI1040(ret: TaxReturnInput, res: TaxReturnResult, mi: MiResult, preparer?: PreparerInfo | null): FormFill {
  const L = mi.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const showSpouse = joint || fs === 'mfs'
  const [first, mi1] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const [f1, f2, f3] = ssnParts(ret.taxpayer.ssn)
  const [s1, s2, s3] = ssnParts(ret.spouse.ssn)
  const values: Record<string, FieldValue> = {
    "Filer's First Name": upper(first), "Filer's Initial": upper(mi1), "Filer's Last Name": upper(ret.taxpayer.lastName.trim()), FSSN1: f1, FSSN2: f2, FSSN3: f3,
    "Spouse's First Name": joint ? upper(sFirst) : '', "Spouse's Initial": joint ? upper(sMi) : '', "Spouse's Last Name": joint ? upper(ret.spouse.lastName.trim()) : '',
    SpSSN1: showSpouse ? s1 : '', SpSSN2: showSpouse ? s2 : '', SpSSN3: showSpouse ? s3 : '',
    'Home address': upper([c.street, c.apt].filter((x) => x.trim()).join(' ')), 'City or town': upper(c.city.trim()), State: upper(c.state.trim()), 'Zip Code': digits(c.zip).slice(0, 5),
    'School District Code': digits(ret.mi.schoolDistrictCode).slice(0, 5),
    'Line 7a Single Checkbox': fs !== 'mfj' && fs !== 'mfs', 'Line 7b Checkbox': joint, 'Line 7c Checkbox': fs === 'mfs',
    'Line 7c Spouse Name': fs === 'mfs' ? upper(`${ret.spouse.firstName.trim()} ${ret.spouse.lastName.trim()}`) : '',
    'Line 8a Resident Chceckbox': true,
    'Line 9a Number': mi.exemptions.count ? String(mi.exemptions.count) : (mi.exemptions.dependentFiler ? '0' : ''), 'Line 9a': amt(L['9a'], mi.exemptions.dependentFiler),
    'Line 9b Numbers': mi.exemptions.special ? String(mi.exemptions.special) : '', 'Line 9b': amt(L['9b']),
    'Line 9c Number': mi.exemptions.veterans ? String(mi.exemptions.veterans) : '', 'Line 9c': amt(L['9c']),
    'Line 9e Checkbox': mi.exemptions.dependentFiler, 'Line 9e': amt(L['9e']), 'Line 9f': amt(L['9f'], true),
    'Line 10': amt(L['10'], true), 'Line 11': amt(L['11']), 'Line 12': amt(L['12'], true), 'Line 13': amt(L['13']), 'Line 14': amt(L['14'], true),
    'Line 15': amt(L['15'], true), 'Line 16': amt(L['16'], true), 'Line 17': amt(L['17'], true),
    'Line 18a': amt(ret.mi.otherStateCredit), 'Line 18b': amt(L['18b']), 'Line 21': amt(L['21'], true), 'Line 22': amt(L['22']), 'Line 23': amt(L['23']), 'Line 24': amt(L['24'], true), 'Line 25': amt(L['25'], true),
    'Line 26': amt(L['26']), 'Line 27': amt(L['27']), 'Line 28a': amt(L['28a']), 'Line 28b': amt(L['28b']), 'Line 29': amt(L['29']), 'Line 30': amt(L['30']),
    'Line 31': amt(L['31']), 'Line 32': amt(L['32']), 'Line 34': amt(L['34'], true),
    'Line 36': amt(L['36']), 'Line 37': amt(L['37']), 'Line 38': amt(L['38']), 'Line 39': amt(L['39'])
  }
  const dd = ret.refundDeposit
  if (L['39'] > 0 && digits(dd.routingNumber).length === 9 && digits(dd.accountNumber)) {
    values['Routing Number'] = digits(dd.routingNumber)
    values['Account Number'] = dd.accountNumber.replace(/[^0-9A-Za-z]/g, '')
    values[dd.accountType === 'savings' ? 'Savings Account Checkbox' : 'Checking Account Checkbox'] = true
  }
  if (ret.usePaidPreparer && preparer) {
    values["Preparer's Name"] = upper(preparer.name)
    values["Preparer's PTIN, FEIN, or SSN"] = preparer.ptin.toUpperCase()
    values["Preparer's Business Name, Address, and Telephone Number"] = upper(`${preparer.firmName}, ${preparer.firmAddress}, ${preparer.phone}`)
  }
  return { id: 'mi1040', file: 'mi1040.pdf', title: 'Michigan Form MI-1040', values }
}

export function scheduleMI1(ret: TaxReturnInput, mi: MiResult): FormFill {
  const A = mi.schedule1.additions
  const S = mi.schedule1.subtractions
  const [first, init] = firstAndInitial(ret.taxpayer)
  const [f1, f2, f3] = ssnParts(ret.taxpayer.ssn)
  const values: Record<string, FieldValue> = {
    "Filer's First Name": upper(first), 'Filer Initial': upper(init), "Filer's Last Name": upper(ret.taxpayer.lastName.trim()), FSSN1: f1, FSSN2: f2, FSSN3: f3,
    'Line 1': amt(A['1']), 'Line 8': amt(A['8']), 'Line 8 Describe': A['8'] ? 'SEE STATEMENT' : '', 'Line 9': amt(A['9']),
    'Line 10': amt(S['10']), 'Line 11': amt(S['11']), 'Line 14': amt(S['14']), 'Line 16': amt(S['16']), 'Line 23': amt(S['23']), 'Line 23 Describe': S['23'] ? 'SEE STATEMENT' : '',
    'Line 27': amt(S['27']), 'Line 28': amt(S['28']), 'Line 29': amt(S['29']), 'Line 31': amt(S['31'])
  }
  if (S['27'] > 0 || S['28'] > 0) {
    const joint = ret.filingStatus === 'mfj'
    const year = (p: Person, y: number): string => String(y || (p.age ? 2025 - p.age : '')).slice(-2)
    values['Line 24A'] = year(ret.taxpayer, ret.mi.birthYear.taxpayer)
    values['Line 24B'] = ret.taxpayer.age ? String(ret.taxpayer.age) : ''
    if (joint) { values['Line 24E'] = year(ret.spouse, ret.mi.birthYear.spouse); values['Line 24F'] = ret.spouse.age ? String(ret.spouse.age) : '' }
  }
  return { id: 'mischedule1', file: 'mischedule1.pdf', title: 'Michigan Schedule 1', values }
}

export function formMI4884(ret: TaxReturnInput, res: TaxReturnResult, mi: MiResult): FormFill {
  const joint = ret.filingStatus === 'mfj'
  const [first, init] = firstAndInitial(ret.taxpayer)
  const [sFirst, sInit] = firstAndInitial(ret.spouse)
  const [f1, f2, f3] = ssnParts(ret.taxpayer.ssn)
  const [s1, s2, s3] = ssnParts(ret.spouse.ssn)
  const rt = mi.retirement
  const values: Record<string, FieldValue> = {
    "Filer's First name": upper(first), 'Filers Initial': upper(init), "Filer's Last name": upper(ret.taxpayer.lastName.trim()), FSSN1: f1, FSSN2: f2, FSSN3: f3,
    "Spouse's First name": joint ? upper(sFirst) : '', "Spouse's Initial": joint ? upper(sInit) : '', "Spouse's Last name": joint ? upper(ret.spouse.lastName.trim()) : '',
    SpSSN1: joint ? s1 : '', SpSSN2: joint ? s2 : '', SpSSN3: joint ? s3 : '',
    'Line 4': String(ret.mi.birthYear.taxpayer || (ret.taxpayer.age ? 2025 - ret.taxpayer.age : '')), 'Line 5': joint ? String(ret.mi.birthYear.spouse || (ret.spouse.age ? 2025 - ret.spouse.age : '')) : ''
  }
  const owners = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  ret.retirement.filter((x) => owners.includes(x.owner) && x.taxableAmount > 0).slice(0, 8).forEach((x, i) => {
    const n = i + 1
    values[`Line 8d Row ${n}`] = x.code
    values[`Line 8e Row ${n}`] = upper(x.payer)
    values[`Line 8f Row ${n}`] = amt(x.taxableAmount)
    values[`Line 8a Private Row ${n}`] = true
  })
  const max = joint ? 131794 : 65897
  if (rt.section === 'A') {
    Object.assign(values, {
      'Line 9': amt(max), 'Line 10': amt(ret.mi.militaryRetirement), 'Line 11': amt(Math.max(0, max - ret.mi.militaryRetirement)), 'Line 12': amt(rt.publicBenefits),
      'Line 13': amt(Math.max(0, max - ret.mi.militaryRetirement - rt.publicBenefits)), 'Line 14': amt(rt.benefits - rt.publicBenefits), 'Line 15': amt(rt.deduction - rt.publicBenefits), 'Line 16': amt(rt.deduction)
    })
  } else if (rt.section === 'D') values['Line 19'] = amt(rt.deduction)
  return { id: 'mi4884', file: 'mi4884.pdf', title: 'Michigan Form 4884', values }
}

export function formMI1040CR(ret: TaxReturnInput, res: TaxReturnResult, mi: MiResult): FormFill {
  const H = mi.homestead.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const [first, init] = firstAndInitial(ret.taxpayer)
  const [sFirst, sInit] = firstAndInitial(ret.spouse)
  const [f1, f2, f3] = ssnParts(ret.taxpayer.ssn)
  const [s1, s2, s3] = ssnParts(ret.spouse.ssn)
  const special = ret.mi.specialExemptions > 0
  const values: Record<string, FieldValue> = {
    'Filers First Name': upper(first), "Filer's Initial": upper(init), "Filer's Last Name": upper(ret.taxpayer.lastName.trim()), 'FilerSSN 1': f1, FilerSSN2: f2, FilerSSN4: f3,
    "Spouse's First Name": joint ? upper(sFirst) : '', 'Spouse Initial': joint ? upper(sInit) : '', 'Spouse Last Name': joint ? upper(ret.spouse.lastName.trim()) : '',
    'SpouseSSN 1': joint || fs === 'mfs' ? s1 : '', SpouseSSN2: joint || fs === 'mfs' ? s2 : '', SpouseSSN3: joint || fs === 'mfs' ? s3 : '',
    'Home Address': upper([c.street, c.apt].filter((x) => x.trim()).join(' ')), 'City or Town': upper(c.city.trim()), State: upper(c.state.trim()), 'ZIP Code': digits(c.zip).slice(0, 5),
    'School District Code': digits(ret.mi.schoolDistrictCode).slice(0, 5),
    'Line 5a Checkbox': mi.homestead.senior, 'Line 5b Checkbox': special,
    'Line 6a Single Checkbox': !joint && fs !== 'mfs', 'Line 6b Married Filing Jointly Checkbox': joint, 'Line 6c Married Filing Seperately Checkbox': fs === 'mfs',
    'Line 7a Resident Checkbox': true,
    'Line 9': ret.mi.housing === 'own' ? amt(ret.mi.taxableValue) : '', 'Line 10': amt(H['10']), 'Line 11': amt(H['11']), 'Line 12': amt(H['12']), 'Line 13': amt(H['13'], true),
    'Line 14': amt(H['14']), 'Line 15': amt(H['15']), 'Line 16': amt(H['16']), 'Line 17': amt(H['17']), 'Line 18': amt(H['18']), 'Line 19': amt(H['19']),
    'Line 21': amt(H['21']), 'Line 23': amt(H['23']), 'Line 25': amt(H['25']), 'Line 25 Describe': H['25'] ? 'SEE STATEMENT' : '',
    'Line 28': amt(H['28'], true), 'Line 29': amt(H['28'], true), 'Line 30': amt(H['30']), 'Line 30 Describe': H['30'] ? 'FEDERAL ADJUSTMENTS' : '', 'Line 31': amt(H['31']),
    'Line 32': amt(H['30'] + H['31']), 'Line 33': amt(H['33'], true), 'Line 34': amt(H['34'], true), 'Line 35': amt(H['35'], true),
    'Line 42': amt(H['42'], true), 'Line 43': String(H['43']), 'Line 44': amt(H['44'], true)
  }
  if (special) values['Line 39'] = amt(H['42'])
  else if (mi.homestead.senior) Object.assign(values, { 'Line 36': amt(H['35']), 'Line 37': String(H['37']), 'Line 38': amt(H['42']) })
  else Object.assign(values, { 'Line 40': amt(H['35']), 'Line 41': amt(H['42']) })
  if (ret.mi.housing === 'rent') {
    Object.assign(values, {
      '52A1': upper([c.street, c.apt, c.city, c.state, digits(c.zip).slice(0, 5)].filter((x) => x.trim()).join(', ')),
      '52C1': '12', '52D1': amt(H['11'] / 12), '52E1': amt(H['11']), 'line 53': amt(H['11'])
    })
  }
  return { id: 'mi1040cr', file: 'mi1040cr.pdf', title: 'Michigan MI-1040CR', values }
}

export function buildMiPacket(ret: TaxReturnInput, res: TaxReturnResult, mi: MiResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formMI1040(ret, res, mi, preparer)]
  if (mi.lines['11'] > 0 || mi.lines['13'] > 0) forms.push(scheduleMI1(ret, mi))
  if (mi.retirement.deduction > 0) forms.push(formMI4884(ret, res, mi))
  if (mi.lines['26'] > 0) forms.push(formMI1040CR(ret, res, mi))
  const filled = new Set(['Schedule 1, additions and subtractions', 'Form 4884, retirement and pension schedule', 'MI-1040CR, homestead property tax credit claim'])
  const notIncluded = mi.attach.filter((a) => !filled.has(a))
  if (mi.retirement.deduction > 0) notIncluded.push('Form 4884 line 8: each payer’s FEIN and whether the plan is public or private (marked private here)')
  if (ret.mi.housing === 'rent' && mi.lines['26'] > 0) notIncluded.push('MI-1040CR line 52: the landlord’s name and address')
  return { forms, notIncluded }
}
