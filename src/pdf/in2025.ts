/**
 * Maps a computed Indiana return onto the Indiana DOR fillable forms (2025): public/forms/2025/init40.pdf (IT-40),
 * ins1.pdf, ins2.pdf, ins3.pdf, ins5.pdf (Schedule 5 and IN-DONATE), ins6.pdf, ins7.pdf and indep.pdf (IN-DEP).
 * Amounts are whole dollars; the forms print the cents.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { InResult } from '../engine/in2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return v < 0 ? `-${-v}` : String(v)
}
const upper = (s: string): string => s.trim().toUpperCase()
const firstAndInitial = (first: string): [string, string] => {
  const parts = first.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [first.trim(), '']
}
const ssn3 = (ssn: string, a: string, b: string, c: string): Record<string, string> => {
  const s = digits(ssn)
  return { [a]: s.slice(0, 3), [b]: s.slice(3, 5), [c]: s.slice(5, 9) }
}
const names = (ret: TaxReturnInput): string => {
  const a = `${upper(ret.taxpayer.firstName)} ${upper(ret.taxpayer.lastName)}`.trim()
  return ret.filingStatus === 'mfj' ? `${a} & ${upper(ret.spouse.firstName)} ${upper(ret.spouse.lastName)}`.trim() : a
}
const header = (ret: TaxReturnInput, ssnA = 'SSN 1', ssnB = 'SSN 2', ssnC = 'SSN 3'): Record<string, FieldValue> => ({ Name: names(ret), ...ssn3(ret.taxpayer.ssn, ssnA, ssnB, ssnC) })

export function formIt40(ret: TaxReturnInput, res: TaxReturnResult, it: InResult): FormFill {
  const L = it.lines
  const d = ret.in
  const c = ret.contact
  const joint = ret.filingStatus === 'mfj'
  const [first, mi] = firstAndInitial(ret.taxpayer.firstName)
  const [sFirst, sMi] = firstAndInitial(ret.spouse.firstName)
  const spouseShown = joint || ret.filingStatus === 'mfs'
  const values: Record<string, FieldValue> = {
    ...ssn3(ret.taxpayer.ssn, 'SSN 1', 'SSN 2', 'SSN 3'),
    ...(spouseShown ? ssn3(ret.spouse.ssn, 'Spouse SSN 1', 'Spouse SSN 2', 'Spouse SSN 3') : {}),
    'Married Filing Separately': ret.filingStatus === 'mfs',
    'Your First Name': upper(first), 'Your Middle Initial': mi, 'Your Last Name': upper(ret.taxpayer.lastName),
    'Spouse First Name': joint ? upper(sFirst) : '', 'Spouse Middle Initial': joint ? sMi : '', 'Spouse Last Name': joint ? upper(ret.spouse.lastName) : '',
    'Present Address': upper([c.street, c.apt].filter((x) => x.trim()).join(' ')), 'Present City': upper(c.city), 'Present State': upper(c.state).slice(0, 2), 'Present ZIP': digits(c.zip).slice(0, 9),
    'County You Lived': digits(d.countyLived.taxpayer), 'County You Worked': digits(d.countyWorked.taxpayer),
    'County Spouse Lived': joint ? digits(d.countyLived.spouse) : '', 'County Spouse Worked': joint ? digits(d.countyWorked.spouse) : ''
  }
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19c', '19d', '20', '21', '23', '26']) {
    values[`Line ${k}`] = amt(L[k], ['1', '3', '5', '7', '11', '15'].includes(k))
  }
  if (L['21'] > 0 && ret.refundDeposit.routingNumber && ret.refundDeposit.accountNumber) {
    values['Routing Number'] = digits(ret.refundDeposit.routingNumber).slice(0, 9)
    values['Account Number'] = ret.refundDeposit.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
    values['Account Type'] = ret.refundDeposit.accountType === 'savings' ? '#1' : '#0'
  }
  return { id: 'init40', file: 'init40.pdf', title: 'Indiana Form IT-40', values }
}

export function formsInSchedules(ret: TaxReturnInput, res: TaxReturnResult, it: InResult, preparer?: PreparerInfo | null): FormFill[] {
  const forms: FormFill[] = []
  const d = ret.in
  const { s1, s2, s3, s5, s6 } = it
  if (s1['7'] > 0) {
    const v: Record<string, FieldValue> = { ...header(ret), 'Line 3': amt(s1['3']), 'Line 6a': amt(s1['6a']), 'Line 7': amt(s1['7'], true) }
    if (s1['6a'] > 0) v['Addback Name 1'] = 'OTHER ADD-BACKS (SEE STATEMENT)'
    forms.push({ id: 'ins1', file: 'ins1.pdf', title: 'Indiana Schedule 1 (add-backs)', values: v })
  }
  if (s2['12'] > 0) {
    const v: Record<string, FieldValue> = { ...header(ret) }
    for (const k of ['1', '2', '3', '4', '5', '7', '8', '11a']) v[`Line ${k}`] = amt(s2[k])
    v['Line 12'] = amt(s2['12'], true)
    if (s2['1'] > 0) Object.assign(v, { 'Rent Paid': amt(s2['rent']), 'Months Rented': String(Math.min(12, Math.max(1, Math.round(d.monthsRented)))), 'Landlord Name and Address': upper(d.landlord) })
    if (s2['2'] > 0) Object.assign(v, { 'Property Tax Paid': amt(s2['tax']), 'Months Lived': String(Math.min(12, Math.max(1, Math.round(d.monthsLivedHome)))) })
    if (s2['11a'] > 0) v['Deduction Name 1'] = 'OTHER DEDUCTIONS (SEE STATEMENT)'
    forms.push({ id: 'ins2', file: 'ins2.pdf', title: 'Indiana Schedule 2 (deductions)', values: v })
  }
  {
    const v: Record<string, FieldValue> = { ...header(ret), 'Line 1': amt(s3['1']), 'IN-DEP Box 5': s3['box5'] ? String(s3['box5']) : '', 'Line 2': amt(s3['2']),
      'IN-DEP Box 6': s3['box6'] ? String(s3['box6']) : '', 'Line 3': amt(s3['3']), 'Line 4': amt(s3['4']), 'Line 5': amt(s3['5']),
      'IN-DEP-A Box 6': s3['6n'] ? String(s3['6n']) : '', 'Line 6': amt(s3['6']), 'Line 7': amt(s3['7'], true),
      'You 65 1': it.boxes.age65.includes('taxpayer'), 'Spouse 65 1': it.boxes.age65.includes('spouse'),
      'You Blind': it.boxes.blind.includes('taxpayer'), 'Spouse Blind': it.boxes.blind.includes('spouse'), 'X Box 1': s3['4n'] ? String(s3['4n']) : '',
      'You 65 2': it.boxes.extra65.includes('taxpayer'), 'Spouse 65 2': it.boxes.extra65.includes('spouse'), 'X Box 2': s3['5n'] ? String(s3['5n']) : '',
      'IT-40 Line 1': it.boxes.age65.length ? amt(it.lines['1'], true) : '' }
    forms.push({ id: 'ins3', file: 'ins3.pdf', title: 'Indiana Schedule 3 (exemptions)', values: v })
  }
  if (it.dependents.length > 0) {
    for (let start = 0; start < it.dependents.length; start += 4) {
      const v: Record<string, FieldValue> = { ...header(ret, 'Your SSN 1', 'Your SSN 2', 'Your SSN 3') }
      it.dependents.slice(start, start + 4).forEach((x, i) => {
        const n = i + 1
        Object.assign(v, {
          [`First Name Dependent ${n}`]: upper(x.first), [`Last Name Dependent ${n}`]: upper(x.last),
          ...ssn3(x.ssn, `SSN 1 Dependent ${n}`, `SSN 2 Dependent ${n}`, `SSN 3 Dependent ${n}`),
          [`DOB 3 Dependent ${n}`]: String(2025 - Math.max(0, Math.floor(x.age))),
          [`Additional Exemption ${n + 4}`]: x.child, [`First Time ${n + 4}`]: x.firstTime
        })
      })
      if (start === 0) { v['Box 8'] = String(s3['box5']); v['Box 7'] = s3['box6'] ? String(s3['box6']) : '0' }
      forms.push({ id: `indep${start / 4 + 1}`, file: 'indep.pdf', title: 'Indiana Schedule IN-DEP', values: v })
    }
  }
  if (s5['13'] > 0 || it.lines['17'] > 0) {
    const v: Record<string, FieldValue> = { ...header(ret) }
    for (const k of ['1', '2', '4', '5', '6', '11']) v[`Line 1.${k}`] = amt(s5[k])
    v['Line 1.13'] = amt(s5['13'], true)
    if (it.lines['17'] > 0) Object.assign(v, { 'Fund Name 1': 'SEE STATEMENT', 'Line 2.1a': amt(it.lines['17']), 'Line 2.2': amt(it.lines['17']) })
    forms.push({ id: 'ins5', file: 'ins5.pdf', title: 'Indiana Schedule 5 and IN-DONATE', values: v })
  }
  if (s6['8'] > 0) {
    const v: Record<string, FieldValue> = { ...header(ret), 'Line 4': amt(s6['4']), 'Line 5': amt(s6['5']), 'Line 6a': amt(s6['6a']), 'Line 8': amt(s6['8'], true) }
    if (s6['6a'] > 0) v['Credit Name 6.1'] = 'OTHER CREDITS (SEE STATEMENT)'
    forms.push({ id: 'ins6', file: 'ins6.pdf', title: 'Indiana Schedule 6 (offset credits)', values: v })
  }
  {
    const v: Record<string, FieldValue> = { ...header(ret), 'Federal Filing': '#0', 'Taxpayer Telephone': digits(ret.contact.phone).slice(-10), 'Taxpayer Email': ret.contact.email.trim() }
    if (ret.usePaidPreparer && preparer) Object.assign(v, { 'Firm Name': upper(preparer.firmName || preparer.name), PTIN: preparer.ptin.toUpperCase() })
    forms.push({ id: 'ins7', file: 'ins7.pdf', title: 'Indiana Schedule 7 (additional information)', values: v })
  }
  return forms
}

export function formCt40(ret: TaxReturnInput, it: InResult): FormFill {
  const c = ret.contact
  const joint = ret.filingStatus === 'mfj'
  const rate = (x: number): string => (x > 0 ? x.toFixed(6).replace(/^0\./, '').replace(/0+$/, '') : '')
  const ct = it.county
  const values: Record<string, FieldValue> = {
    ...header(ret),
    'Your principal residence address ': upper([c.street, c.apt].filter((x) => x.trim()).join(' ')),
    'Present City ': upper(c.city), 'Present State ': upper(c.state).slice(0, 2), 'Present ZIP ': digits(c.zip).slice(0, 9),
    'Line 1A': amt(ct.incomeA, true), 'Line 2B 2': rate(ct.rateA), 'Line 3A': amt(ct.incomeA * ct.rateA, true),
    'Line 4': amt(ct.tax, true), 'Line 7': amt(ct.tax, true)
  }
  if (joint) Object.assign(values, {
    'Spouse principal residence address ': upper([c.street, c.apt].filter((x) => x.trim()).join(' ')),
    'Present City 2': upper(c.city), 'Present State 2': upper(c.state).slice(0, 2), 'Present ZIP 2': digits(c.zip).slice(0, 9)
  })
  if (ct.codeB) Object.assign(values, { 'Line 1B': amt(ct.incomeB, true), 'Line 2B': rate(ct.rateB), 'Line 3B': amt(ct.incomeB * ct.rateB, true) })
  return { id: 'inct40', file: 'inct40.pdf', title: 'Indiana Schedule CT-40 (county tax)', values, pages: [0, 1] }
}

export function formInEic(ret: TaxReturnInput, res: TaxReturnResult, it: InResult): FormFill {
  const values: Record<string, FieldValue> = {
    ...header(ret), 'Federal EIC': amt(res.f1040['27a'], true), 'Earned Income': amt(res.eic.earnedIncome, true), 'Indiana EIC': amt(it.s5['6'], true)
  }
  const kids = ret.dependents.filter((x) => x.childRelationship && x.monthsLivedWithYou > 6 && (x.age < 19 || (x.student && x.age < 24) || x.disabled)).slice(0, res.eic.qualifyingChildren).slice(0, 3)
  kids.forEach((x, i) => {
    const n = i + 1
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    const rel = /grand/i.test(x.relationship) ? 'B' : /step/i.test(x.relationship) ? 'C' : /foster/i.test(x.relationship) ? 'D' : /son|daughter|child/i.test(x.relationship || 'child') ? 'A' : 'E'
    const age = x.age < 18 ? 'A' : x.age === 18 ? 'B' : x.disabled && !x.student ? 'D' : 'C'
    Object.assign(values, {
      [`First Name ${n}`]: upper(parts.join(' ')), [`Last Name ${n}`]: upper(last), ...ssn3(x.ssn, `SSN 1 Child ${n}`, `SSN 2 Child ${n}`, `SSN 3 Child ${n}`),
      [`Relationship ${n}`]: rel, [`Age ${n}`]: age, [`Location ${n}`]: 'A'
    })
  })
  return { id: 'ineic', file: 'ineic.pdf', title: 'Indiana Schedule IN-EIC', values, pages: [0] }
}

export function buildInPacket(ret: TaxReturnInput, res: TaxReturnResult, it: InResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formIt40(ret, res, it), ...formsInSchedules(ret, res, it, preparer), formCt40(ret, it)]
  if (it.s5['6'] > 0) forms.push(formInEic(ret, res, it))
  const shown = ['Schedule 7', 'Schedule CT-40', 'Schedule IN-EIC']
  const notIncluded = it.attach.filter((a) => !shown.some((s) => a.startsWith(s)))
  if (it.dependents.length > 0) notIncluded.push('Schedule IN-DEP: each dependent’s month and day of birth (only the year is filled in)')
  if (ret.in.donations > 0) notIncluded.push('Schedule IN-DONATE: fill in each fund’s name and 3-digit code')
  if (it.county.codeB) notIncluded.push('Schedule CT-40: check how the income is split between you and your spouse (lines 1A and 1B)')
  return { forms, notIncluded }
}
