/**
 * Maps a computed Minnesota return onto the Minnesota Department of Revenue fillable forms (2025):
 * public/forms/2025/mnm1.pdf (Form M1), mnm1m.pdf (Schedule M1M), mnm1ref.pdf (Schedule M1REF) and
 * mnm1cwfc.pdf (Schedule M1CWFC). Blank lines stay blank, as the instructions ask; amounts are whole dollars.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MnResult } from '../engine/mn2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return v < 0 ? `-${-v}` : String(v)
}
const upper = (s: string): string => s.trim().toUpperCase()
const STATUS: Record<MnResult['status'], string> = {
  single: 'checkifsingle', mfj: 'checkifmarriedfilingjoint', mfs: 'checkifmarriedfilingseparately', hoh: 'checkifheadofhousehold', qss: 'checkifqualifyingwidower'
}
const header = (ret: TaxReturnInput, first: string, last: string, ssn: string): Record<string, FieldValue> => ({
  [first]: upper(ret.taxpayer.firstName), [last]: upper(ret.taxpayer.lastName), [ssn]: digits(ret.taxpayer.ssn)
})

export function formM1(ret: TaxReturnInput, res: TaxReturnResult, mn: MnResult, preparer?: PreparerInfo | null): FormFill {
  const L = mn.lines
  const d = ret.mn
  const c = ret.contact
  const joint = mn.status === 'mfj'
  const values: Record<string, FieldValue> = {
    yourfirstnameandinitial: upper(ret.taxpayer.firstName), LastName: upper(ret.taxpayer.lastName), YourSocialSecurityNumber: digits(ret.taxpayer.ssn),
    YourDateofBirth: d.birthDate.taxpayer,
    SpousesFirstNameandInitial: joint ? upper(ret.spouse.firstName) : '', Spouseslastname: joint ? upper(ret.spouse.lastName) : '',
    SpousesSocialSecurityNumber: joint ? digits(ret.spouse.ssn) : '', spousesdateofbirth: joint ? d.birthDate.spouse : '',
    CurrentHomeAddress: upper([c.street, c.apt].filter((x) => x.trim()).join(' ')), city: upper(c.city), state: upper(c.state).slice(0, 2),
    zipcode: digits(c.zip).slice(0, 9), county: upper(d.county),
    [STATUS[mn.status]]: true,
    Yourcode: d.campaignCode.taxpayer, Spousecode: joint ? d.campaignCode.spouse : '',
    'wages, salaries, tips': amt(L['A']), irapensionsannuities: amt(L['B']), unemployment: amt(L['C']), FAGI: amt(L['D'], true),
    'SS benefits': amt(L['E']), 'taxabke SS benefits': amt(L['F']),
    Taxpayersdaytimephone: digits(c.phone).slice(-10), Youremailaddress: c.email.trim()
  }
  if (mn.status === 'mfs') {
    values.Enterspousename = `${upper(ret.spouse.firstName)} ${upper(ret.spouse.lastName)}`.trim()
    values.EnterspouseSocialSecuritynumber = digits(ret.spouse.ssn)
  }
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14a', '14b', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '26', '29', '30']) {
    values[`m1line${k}`] = amt(L[k], k === '1')
  }
  if (L['24'] > 0 && ret.refundDeposit.routingNumber && ret.refundDeposit.accountNumber) {
    values.Routingnumber = digits(ret.refundDeposit.routingNumber).slice(0, 9)
    values.AccountNumber = ret.refundDeposit.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
    values[ret.refundDeposit.accountType === 'savings' ? 'checkifsavings' : 'checkifchecking'] = true
  }
  if (ret.usePaidPreparer && preparer) {
    values.PTINorVITATCErequired = preparer.ptin.toUpperCase()
    values.Preparersdaytimephone = digits(preparer.phone).slice(-10)
  }
  return { id: 'mnm1', file: 'mnm1.pdf', title: 'Minnesota Form M1', values }
}

export function formM1M(ret: TaxReturnInput, mn: MnResult): FormFill {
  const M = mn.m
  const values = header(ret, 'YourFirstNameandInitial', 'LastName', 'YourSocialSecurityNumber')
  for (const k of ['1', '3', '10', '11', '12', '13', '14', '15', '20', '25', '40']) values[`M1Mline${k}`] = amt(M[k], k === '10' || k === '40')
  if (M['13'] > 0) values.nameandgradeofeachchild = 'SEE STATEMENT'
  return { id: 'mnm1m', file: 'mnm1m.pdf', title: 'Minnesota Schedule M1M', values, pages: [0, 1] }
}

export function formM1REF(ret: TaxReturnInput, mn: MnResult): FormFill {
  const R = mn.ref
  const values = header(ret, 'YourFirstNameandInitial', 'Lastname', 'SSN')
  values.M1REFline2 = amt(R['2'])
  if (R['2'] > 0) { values.M1REFline2a = R['2a'] ? String(R['2a']) : ''; values.M1REFline2b = R['2b'] ? String(R['2b']) : '' }
  values.M1REFline14 = amt(R['14'], true)
  return { id: 'mnm1ref', file: 'mnm1ref.pdf', title: 'Minnesota Schedule M1REF', values, pages: [0] }
}

export function formM1CWFC(ret: TaxReturnInput, mn: MnResult): FormFill {
  const W = mn.cwfc
  const values = header(ret, 'Your First Name and Initial', 'Last Name', 'Your Social Security Number')
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']) {
    if (k === '13') values[k] = W['12'] > 0 ? W['13'].toFixed(2).replace(/^0/, '') : ''
    else if (k === '7') values[k] = W['7'] > 0 ? String(W['7']) : ''
    else values[k] = amt(W[k], ['1', '9', '15'].includes(k))
  }
  return { id: 'mnm1cwfc', file: 'mnm1cwfc.pdf', title: 'Minnesota Schedule M1CWFC', values, pages: [0, 1] }
}

export function buildMnPacket(ret: TaxReturnInput, res: TaxReturnResult, mn: MnResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formM1(ret, res, mn, preparer)]
  if (mn.lines['2'] > 0 || mn.lines['7'] > 0) forms.push(formM1M(ret, mn))
  if (mn.lines['22'] > 0) forms.push(formM1REF(ret, mn))
  if (mn.ref['2'] > 0) forms.push(formM1CWFC(ret, mn))
  const shown = ['Schedule M1M', 'Schedule M1REF', 'Schedule M1CWFC']
  const notIncluded = mn.attach.filter((a) => !shown.some((s) => a.startsWith(s)))
  if (mn.m['38'] > 0) notIncluded.push('Schedule M1M: put your other subtractions on their own lines (lines 16–39); only the line 40 total includes them')
  if (mn.m['3'] > 0) notIncluded.push('Schedule M1M: other additions are on line 3; move them to their own line if another fits')
  if (mn.m['13'] > 0) notIncluded.push('Schedule M1M line 13: the name and grade of each child')
  if (ret.mn.refundableCredits > 0) notIncluded.push('Schedule M1REF: put your other refundable credits on their own lines (only the line 14 total includes them)')
  return { forms, notIncluded }
}
