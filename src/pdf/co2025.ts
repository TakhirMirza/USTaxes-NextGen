/**
 * Maps a computed Colorado return onto the Colorado DOR fillable forms (2025): public/forms/2025/co104.pdf
 * (DR 0104, 8 pages), co104ad.pdf (DR 0104AD), co104cr.pdf (DR 0104CR), co104cn.pdf (DR 0104CN) and co0347.pdf
 * (DR 0347). Amounts are whole dollars.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { CoResult } from '../engine/co2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { explainStatement, money0, statementForms } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return v < 0 ? `(${-v})` : String(v)
}
const upper = (s: string): string => s.trim().toUpperCase()
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const q = (n: string | number): string => `Form Question ${n}`

export function formCo104(ret: TaxReturnInput, res: TaxReturnResult, co: CoResult, preparer?: PreparerInfo | null): FormFill {
  const L = co.lines
  const d = ret.co
  const c = ret.contact
  const joint = ret.filingStatus === 'mfj'
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const values: Record<string, FieldValue> = {
    RB1: '1',
    'Last Name': upper(ret.taxpayer.lastName), 'First Name': upper(first), 'Middle Initial': mi, 'Social Security Number': digits(ret.taxpayer.ssn),
    'Date of Birth': d.birthDate.taxpayer, 'State of Issue': upper(d.idState.taxpayer).slice(0, 2), 'ID Number': upper(d.idLast4.taxpayer).slice(-4),
    'Date of Issuance': d.idIssued.taxpayer,
    'Spouse Last Name': joint ? upper(ret.spouse.lastName) : '', 'Spouse First Name': joint ? upper(sFirst) : '', 'Spouse Middle Initial': joint ? sMi : '',
    'Spouse Social Security Number': joint ? digits(ret.spouse.ssn) : '', 'Spouse Date of Birth': joint ? d.birthDate.spouse : '',
    'Spouse State of Issue': joint ? upper(d.idState.spouse).slice(0, 2) : '', 'Spouse ID Number': joint ? upper(d.idLast4.spouse).slice(-4) : '',
    'Spouse Date of Issuance': joint ? d.idIssued.spouse : '',
    'Physical Street Address 2': upper([c.street, c.apt].filter((x) => x.trim()).join(' ')), 'Phone Number 3': digits(c.phone).slice(-10),
    'City 4': upper(c.city), 'State 5': upper(c.state).slice(0, 2), 'ZIP Code 4': digits(c.zip).slice(0, 9),
    'Explain Other Additions': L['9'] > 0 ? (d.otherStateBondInterest > 0 ? 'NON-COLORADO BOND INTEREST' : 'SEE STATEMENT') : ''
  }
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23',
    '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47']) {
    values[q(k)] = amt(L[k], ['1', '10', '12', '13', '16', '21', '23', '33', '34', '37', '39'].includes(k))
  }
  co.dependents.forEach((x, i) => {
    const n = i + 1
    values[`Last Name Dependent ${n}`] = upper(x.last)
    values[`First Name Dependent ${n}`] = upper(x.first)
    values[`Social Security Number Dependent ${n}`] = digits(x.ssn)
    values[`Year of Birth Dependent ${n}`] = String(x.birthYear)
    values[`C6 - Qualifying Child ${n}`] = x.childTaxCredit
  })
  if (L['42'] > 0 && ret.refundDeposit.routingNumber && ret.refundDeposit.accountNumber) {
    values['Routing Number 4'] = digits(ret.refundDeposit.routingNumber).slice(0, 9)
    values['Acount Number 4'] = ret.refundDeposit.accountNumber.replace(/[^0-9A-Za-z-]/g, '').slice(0, 17)
    if (ret.refundDeposit.accountType === 'savings') values.RB7 = '2'
    else values.RB6 = '1'
  }
  values.RB9 = '1'
  if (ret.usePaidPreparer && preparer) {
    values['Paid Preparer’s Name 2'] = upper(preparer.name)
    values['Paid Preparer’s Phone Number 2'] = digits(preparer.phone).slice(-10)
  }
  return { id: 'co104', file: 'co104.pdf', title: 'Colorado Form DR 0104', values }
}

export function formCo104AD(ret: TaxReturnInput, co: CoResult): FormFill {
  const A = co.ad
  const values: Record<string, FieldValue> = {
    Name: `${upper(ret.taxpayer.firstName)} ${upper(ret.taxpayer.lastName)}`.trim(), 'SSN or ITIN': digits(ret.taxpayer.ssn)
  }
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22']) values[q(k)] = amt(A[k], k === '22')
  values[q(23)] = amt(A['20'])
  if (A['20'] > 0) values['Other Subtractions Expanation'] = 'SEE STATEMENT'
  if (A['12'] > 0) values['Total Contribution Qualifying Charitable'] = amt(A['12c'])
  const name = `${upper(ret.taxpayer.firstName)} ${upper(ret.taxpayer.lastName)}`.trim()
  if (A['10'] > 0) Object.assign(values, { 'Total Contribution CollegeInvest': amt(A['10']), 'Owners Name CollegeInvest': name, 'SSN or ITIN Owner CollegeInvest': digits(ret.taxpayer.ssn) })
  if (A['11'] > 0) Object.assign(values, { 'Total Contribution Colorado ABLE': amt(A['11']), 'Owners Name Colorado ABLE': name, 'SSN or ITIN Owner Colorado ABLE': digits(ret.taxpayer.ssn) })
  return { id: 'co104ad', file: 'co104ad.pdf', title: 'Colorado DR 0104AD (subtractions)', values, pages: [0, 1, 2] }
}

export function formCo104CR(ret: TaxReturnInput, co: CoResult): FormFill {
  const CR = co.cr
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const values: Record<string, FieldValue> = {
    'Taxpayer Last Name': upper(ret.taxpayer.lastName), 'Taxpayer First Name': upper(first), 'Taxpayer Middle Initial': mi, 'Social Security Number': digits(ret.taxpayer.ssn),
    'Taxpayer Last Name_1': upper(ret.taxpayer.lastName), 'Taxpayer First Name_1': upper(first), 'Taxpayer Middle Initial_1': mi, 'Social Security Number_1': digits(ret.taxpayer.ssn),
    [q(1)]: amt(CR['1']), [q(2)]: amt(CR['2']), [q(3)]: amt(CR['3']), [q(4)]: amt(CR['4']), [q(5)]: amt(CR['5']),
    [q(26)]: amt(CR['26'], true), [q(34)]: amt(CR['34']), [q(63)]: amt(CR['65'])
  }
  const d = ret.co.cr
  for (let n = 7; n <= 25; n++) if (CR[String(n)] > 0) values[q(n)] = amt(CR[String(n)])
  if (CR['29'] !== undefined) {
    values[q(27)] = upper(d.otherState.name)
    for (const n of [28, 29, 30, 32, 33]) values[q(n)] = amt(CR[String(n)], true)
    values[q(31)] = CR['31'].toFixed(4)
  } else if (CR['34'] > 0) values[q(33)] = amt(CR['34'])
  const pages = [0, 1, 2, 3]
  for (const [k, x] of Object.entries(co.crUsed)) {
    values[`Credit Available ${k}A`] = amt(x.a, true)
    values[`Credit Used ${k}B`] = amt(x.b, true)
    pages.push(4 + Math.floor((+k <= 39 ? 0 : +k <= 46 ? 1 : +k <= 53 ? 2 : +k <= 59 ? 3 : 4)))
  }
  if (co.crUsed['51'] && d.historicCert.trim()) values[q(52)] = upper(d.historicCert)
  if (co.crUsed['61'] && d.homelessCert.trim()) values[q(62)] = upper(d.homelessCert)
  if (Object.keys(co.crUsed).length) values['Credit Available 64A'] = amt(CR['64'], true)
  if (CR['65'] > 0) pages.push(8)
  return { id: 'co104cr', file: 'co104cr.pdf', title: 'Colorado DR 0104CR (credits)', values, pages: [...new Set(pages)].sort((a, b) => a - b) }
}

export function formCo104CN(ret: TaxReturnInput, co: CoResult): FormFill {
  const N = co.cn
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const values: Record<string, FieldValue> = {
    'Last Name': upper(ret.taxpayer.lastName), 'First Name': upper(first), 'Middle Initial': mi, 'SSN or ITIN': digits(ret.taxpayer.ssn),
    [q(1)]: amt(N['1'], true), [q(11)]: amt(N['11'], true)
  }
  if (N['4'] > 0) Object.assign(values, { [q(2)]: String(N['2']), [q(3)]: amt(N['3']), [q(4)]: amt(N['4']) })
  if (N['7'] > 0) Object.assign(values, { [q(5)]: String(N['5']), [q(6)]: amt(N['6']), [q(7)]: amt(N['7']) })
  if (N['10'] > 0) Object.assign(values, { [q(8)]: String(N['8']), [q(9)]: amt(N['9']), [q(10)]: amt(N['10']) })
  return { id: 'co104cn', file: 'co104cn.pdf', title: 'Colorado DR 0104CN (child tax credit)', values, pages: [4, 5] }
}

export function formCo0347(ret: TaxReturnInput, co: CoResult): FormFill {
  const K = co.care
  const values: Record<string, FieldValue> = {
    'For Tax Year': '2025', 'Taxpayer Name': `${upper(ret.taxpayer.firstName)} ${upper(ret.taxpayer.lastName)}`.trim(), 'SSN or ITIN': digits(ret.taxpayer.ssn),
    '2(e). Sum of all child care expenses': amt(K['2e'], true), '2(f). Enter earned income': amt(K['2f'], true),
    '2(g). Earned Income for joint return': amt(K['2g']),
    [q(3)]: amt(K['3'], true), [q(4)]: amt(K['4'], true), [q(5)]: amt(K['5'], true), [q(6)]: amt(K['6'], true)
  }
  if (K['9'] !== undefined) Object.assign(values, { [q(8)]: amt(K['8'], true), [q(9)]: amt(K['9'], true) })
  if (K['12'] !== undefined) Object.assign(values, { [q(11)]: amt(K['11'], true), [q(12)]: amt(K['12'], true) })
  const providers = ret.dependentCare.providers.slice(0, 2)
  const P = [
    { name: '1(a) Care Providers First Name or Business Name', tin: '(b) SSN, ITIN or FEIN', street: 'Street Address of Care Provider', paid: '(d) Amount Paid' },
    { name: '1(e) Care Providers First Name or Business Name 1', tin: '(f) SSN, ITIN or FEIN', street: '(g) Street Address of Care Provider', paid: '(h) Amount Paid' }
  ]
  providers.forEach((x, i) => {
    values[P[i].name] = upper(x.name)
    values[P[i].tin] = digits(x.tin)
    values[P[i].street] = upper(x.address)
    values[P[i].paid] = amt(x.amountPaid)
  })
  const kids = ret.dependents.filter((x) => x.age < 13 || x.disabled).slice(0, 4)
  kids.forEach((x, i) => {
    const s = 'abcd'[i]
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    values[`2(${s}). Child's First Name`] = upper(parts.join(' '))
    values[`Last Name of Child (2${s})`] = upper(last)
    values[`Year of birth (2${s})`] = String(2025 - Math.max(0, Math.floor(x.age)))
    values[`SSN or ITIN (2${s})`] = digits(x.ssn)
  })
  return { id: 'co0347', file: 'co0347.pdf', title: 'Colorado DR 0347 (child care credit)', values, pages: [2, 3, 4, 5] }
}

export function buildCoPacket(ret: TaxReturnInput, res: TaxReturnResult, co: CoResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formCo104(ret, res, co, preparer)]
  if (co.lines['11'] > 0) forms.push(formCo104AD(ret, co))
  if (co.cr['26'] > 0 || co.cr['65'] > 0) forms.push(formCo104CR(ret, co))
  if (co.cr['1'] > 0) forms.push(formCo104CN(ret, co))
  if (co.cr['2'] > 0) forms.push(formCo0347(ret, co))
  const shown = new Set(['DR 0104AD', 'DR 0104CR', 'DR 0104CN', 'DR 0347'])
  const notIncluded = co.attach.filter((a) => ![...shown].some((s) => a.startsWith(s)))
  if (co.cr['34'] > 0 && co.cr['29'] === undefined) notIncluded.push('DR 0104CR Part II (lines 27–33): enter the other state’s figures in the Colorado section to fill them in; only the line 34 credit is entered')
  if (ret.co.nonrefundableCredits > 0 && !Object.keys(co.crUsed).length) notIncluded.push('DR 0104CR Part III: list your other nonrefundable credits by line in the Colorado section (only the line 65 total is filled in)')
  if (ret.co.refundableCredits > 0 && !Object.values(ret.co.cr.refundable).some((x) => x > 0)) notIncluded.push('DR 0104CR: enter your other refundable credits on their own lines (lines 7–25) in the Colorado section')
  {
    const st = explainStatement(ret, 'co.otherAdditions', ret.co.otherAdditions, { id: 'st-co-otherAdditions', attachTo: 'Form DR 0104, line 9', title: 'Other additions' })
    if (st.length) forms.push(...st)
    else if (ret.co.otherAdditions > 0) notIncluded.push('A statement explaining other additions (DR 0104 line 9)')
  }
  {
    const st = explainStatement(ret, 'co.otherSubtractions', ret.co.otherSubtractions, { id: 'st-co-otherSubtractions', attachTo: 'Form DR 0104AD, line 20', title: 'Other subtractions' })
    if (st.length) forms.push(...st)
    else if (ret.co.otherSubtractions > 0) notIncluded.push('A statement explaining other subtractions (DR 0104AD line 20)')
  }
  if (co.cr['2'] > 0) notIncluded.push('A copy of federal Form 2441 (with DR 0347); on DR 0347 add each child’s care expenses (only the total on line 2(e) is filled in)')
  const moreProviders = ret.dependentCare.providers.slice(2)
  if (moreProviders.length && forms.some((f) => f.id === 'co0347')) forms.push(...statementForms(ret, {
    id: 'st-co-0347', attachTo: 'Form DR 0347, line 1 (continued)', title: 'Care providers after the second',
    columns: [{ label: 'Care provider', width: 150 }, { label: 'SSN, ITIN or FEIN', width: 90 }, { label: 'Address', width: 190 }, { label: 'Amount paid', width: 72, right: true }],
    rows: moreProviders.map((x) => [x.name, x.tin, x.address, money0(x.amountPaid)]),
    total: ['Total', '', '', money0(moreProviders.reduce((s, x) => s + x.amountPaid, 0))],
  }))
  return { forms, notIncluded }
}
