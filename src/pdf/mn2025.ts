/**
 * Maps a computed Minnesota return onto the Minnesota Department of Revenue fillable forms (2025):
 * public/forms/2025/mnm1.pdf (Form M1), mnm1m.pdf (Schedule M1M), mnm1ref.pdf (Schedule M1REF) and
 * mnm1cwfc.pdf (Schedule M1CWFC). Blank lines stay blank, as the instructions ask; amounts are whole dollars.
 *
 * 2026: public/forms/2026/mnm1.pdf is Revenue's final draft of Form M1 (10/1/26) carrying the 2025 fields (the boxes
 * did not move), and mnm1sa.pdf is the Schedule M1SA final draft (11/4/26, no fields: values are drawn at its lines).
 * The other 2026 schedules are listed, not included, until their drafts are added.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MnResult } from '../engine/mn2025.ts'
import { MN_M1M_ADDITION_LINES } from '../engine/mn2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { currentTaxYear } from '../engine/rules.ts'

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
  for (const k of ['1', '10', '11', '12', '13', '14', '15', '20', '25', '40']) values[`M1Mline${k}`] = amt(M[k], k === '10' || k === '40')
  // Other additions: each listed item on its own line; the rest on line 3.
  const by = new Map<string, number>()
  for (const x of ret.explain?.['mn.otherAdditions'] ?? []) {
    const f = MN_M1M_ADDITION_LINES.find(([label]) => label === x.line)?.[1] ?? 'M1Mline3'
    by.set(f, (by.get(f) ?? 0) + Math.round(x.amount))
  }
  const listed = [...by.values()].reduce((s, n) => s + n, 0)
  if (listed !== M['3']) by.set('M1Mline3', (by.get('M1Mline3') ?? 0) + M['3'] - listed)
  for (const [f, n] of by) if (n > 0) values[f] = amt(n)
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

export function formM1W(ret: TaxReturnInput, mn: MnResult, copy = 0): FormFill {
  const joint = mn.status === 'mfj'
  const values: Record<string, FieldValue> = {
    'Your First Name and Initial': upper(ret.taxpayer.firstName), 'Last Name': upper(ret.taxpayer.lastName), 'Your Social Security Number': digits(ret.taxpayer.ssn),
    'If a Joint Return Spouses First Name and Initial': joint ? upper(ret.spouse.firstName) : '', 'Spouses Last Name': joint ? upper(ret.spouse.lastName) : '',
    'Spouses Social Security Number': joint ? digits(ret.spouse.ssn) : ''
  }
  const rows = mn.statements.filter((x) => x.tax > 0)
  rows.slice(copy * 5, copy * 5 + 5).forEach((x, i) => {
    const n = i + 1
    values[`a${n}`] = x.owner === 'spouse' ? '2' : '1'
    values[`b${n}`] = digits(x.stateId)
    values[`c${n}`] = amt(x.wages)
    values[`d${n}`] = amt(x.tax)
  })
  ;(ret.withholdingLists?.['mn.withholding1099'] ?? []).filter((x) => x.tax > 0).slice(copy * 5, copy * 5 + 5).forEach((x, i) => {
    const n = i + 1
    values[`a${n}_2`] = x.owner === 'spouse' ? '2' : '1'
    values[`b${n}_2`] = digits(x.stateId)
    values[`c${n}_2`] = amt(x.income)
    values[`d${n}_2`] = amt(x.tax)
  })
  if (copy > 0) return { id: `mnm1w-${copy + 1}`, file: 'mnm1w.pdf', title: `Minnesota Schedule M1W (continued, page ${copy + 1})`, values, pages: [0] }
  const w2Total = rows.reduce((s, x) => s + x.tax, 0)
  const other = Math.round(Math.max(0, ret.mn.withholding1099))
  values['1'] = amt(w2Total)
  values['2'] = amt(other)
  values['4'] = amt(w2Total + other, true)
  return { id: 'mnm1w', file: 'mnm1w.pdf', title: 'Minnesota Schedule M1W', values, pages: [0] }
}

export function formsM1DQC(ret: TaxReturnInput, mn: MnResult): FormFill[] {
  const forms: FormFill[] = []
  for (let start = 0; start < mn.dqc.length; start += 3) {
    const values: Record<string, FieldValue> = {
      'Your First Name and Initial': upper(ret.taxpayer.firstName), 'Last Name': upper(ret.taxpayer.lastName), 'Social Security Number': digits(ret.taxpayer.ssn)
    }
    mn.dqc.slice(start, start + 3).forEach((x, i) => {
      const c = 'abc'[i]
      Object.assign(values, {
        [`${c}1`]: upper(x.first), [`${c}2`]: upper(x.last), [`${c}3`]: digits(x.ssn), [`${c}5`]: upper(x.relationship),
        [`${c}6`]: true, [`${c}7`]: String(Math.max(0, Math.min(12, Math.round(x.months)))), [`${c}8`]: x.student, [`${c}9`]: x.disabled,
        [`${c}10`]: x.child, [i === 0 ? 'Check the box if they are a qualifying older child a11' : `${c}11`]: x.older
      })
    })
    forms.push({ id: `mnm1dqc${start / 3 + 1}`, file: 'mnm1dqc.pdf', title: 'Minnesota Schedule M1DQC', values, pages: [0] })
  }
  return forms
}

/** Schedule M1SA 2026 line positions: [page, line, top of the line number in points]; inner column for lines that feed a total. */
const M1SA_2026: [page: number, line: string, top: number, outer: boolean][] = [
  [0, '1', 146.6, false], [0, '2', 183.6, false], [0, '3', 207.6, false], [0, '4', 231.6, true], [0, '5', 266.6, false], [0, '6', 290.6, false],
  [0, '7', 314.6, false], [0, '8', 338.6, false], [0, '9', 362.6, false], [0, '10', 386.6, true], [0, '11', 423.6, false], [0, '12', 447.6, false],
  [0, '13', 471.6, false], [0, '14', 483.6, true], [0, '15', 519.6, false], [0, '16', 543.6, false], [0, '17', 567.6, false], [0, '18', 591.6, false],
  [0, '19', 615.6, false], [0, '20', 639.6, false], [0, '21', 663.6, true], [0, '22', 699.6, true],
  [1, '23', 99.1, false], [1, '24', 123.1, false], [1, '25', 147.1, true], [1, '26', 183.1, true], [1, '27', 207.1, true], [1, '28', 231.1, true], [1, '29', 255.1, true]
]

/** 2026 Schedule M1SA (flat final draft): the amounts drawn right-aligned on each line. */
export function formM1SA2026(ret: TaxReturnInput, mn: MnResult): FormFill {
  const S = mn.sa ?? {}
  const draw: NonNullable<FormFill['draw']> = []
  const at = (page: number, x: number, top: number, text: string, right = false, size = 10): void => { if (text) draw.push({ page, x, y: 792 - top - 9, text, size, right }) }
  at(0, 40, 128, upper(ret.taxpayer.firstName))
  at(0, 212, 128, upper(ret.taxpayer.lastName))
  at(0, 457, 128, digits(ret.taxpayer.ssn))
  for (const [page, line, top, outer] of M1SA_2026) at(page, outer ? 574 : 440, top, amt(S[line], line === '1' || line === '27' || line === '29'), true)
  return { id: 'mnm1sa', file: 'mnm1sa.pdf', title: 'Minnesota Schedule M1SA', values: {}, pages: [0, 1], draw }
}

export function buildMnPacket(ret: TaxReturnInput, res: TaxReturnResult, mn: MnResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formM1(ret, res, mn, preparer)]
  const year = currentTaxYear()
  if (year >= 2026) {
    // Only Form M1 and Schedule M1SA have 2026 drafts here; the rest of the attachments are listed.
    if (mn.deduction.method === 'itemized' && mn.sa && ret.mn.itemized === null) forms.push(formM1SA2026(ret, mn))
    const notIncluded = mn.attach.filter((a) => !(a.startsWith('Schedule M1SA') && forms.length > 1)).map((a) => (/^Schedule M1(M|REF|CWFC|DQC|W)\b/.test(a) ? `${a} — the ${year} draft is not in this app yet; copy the amounts from the Minnesota step` : a))
    if (mn.deduction.method === 'itemized' && ret.mn.itemized !== null) notIncluded.push('Your Schedule M1SA (its line 29 is on Form M1 line 4)')
    return { forms, notIncluded }
  }
  if (mn.lines['2'] > 0 || mn.lines['7'] > 0) forms.push(formM1M(ret, mn))
  if (mn.lines['22'] > 0) forms.push(formM1REF(ret, mn))
  if (mn.ref['2'] > 0) forms.push(formM1CWFC(ret, mn))
  if (mn.dqc.length > 0) forms.push(...formsM1DQC(ret, mn))
  if (mn.lines['20'] > 0) {
    const n = Math.max(1, Math.ceil(mn.statements.filter((x) => x.tax > 0).length / 5), Math.ceil((ret.withholdingLists?.['mn.withholding1099'] ?? []).filter((x) => x.tax > 0).length / 5))
    for (let k = 0; k < n; k++) forms.push(formM1W(ret, mn, k))
  }
  const shown = ['Schedule M1M', 'Schedule M1REF', 'Schedule M1CWFC', 'Schedule M1DQC', 'Schedule M1W']
  const notIncluded = mn.attach.filter((a) => !shown.some((s) => a.startsWith(s)))
  if (mn.m['38'] > 0) notIncluded.push('Schedule M1M: put your other subtractions on their own lines (lines 16–39); only the line 40 total includes them')
  if (mn.m['3'] > 0 && !(ret.explain?.['mn.otherAdditions'] ?? []).length) notIncluded.push('Schedule M1M: other additions are on line 3; list them in the Minnesota section to put each on its own line')
  if (mn.m['13'] > 0) notIncluded.push('Schedule M1M line 13: the name and grade of each child')
  if (ret.mn.refundableCredits > 0) notIncluded.push('Schedule M1REF: put your other refundable credits on their own lines (only the line 14 total includes them)')
  if (mn.dqc.length > 0) notIncluded.push('Schedule M1DQC: write each dependent’s date of birth (row 4)')
  if (mn.lines['20'] > 0 && mn.statements.some((x) => x.tax > 0 && !x.stateId.trim())) notIncluded.push('Schedule M1W column B: the employer’s seven-digit Minnesota tax ID from W-2 box 15')
  if (ret.mn.withholding1099 > 0 && !(ret.withholdingLists?.['mn.withholding1099'] ?? []).some((x) => x.tax > 0)) notIncluded.push('Schedule M1W line 2: list each 1099 or W-2G with Minnesota withholding (only the total is filled in)')
  return { forms, notIncluded }
}
