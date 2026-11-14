/**
 * Maps a computed Virginia return onto the Virginia Department of Taxation fillable PDFs:
 * Form 760 (2025) and Schedule ADJ (2025), stored as public/forms/2025/va760.pdf and va760adj.pdf.
 *
 * Virginia's forms print ".00" after each box, so amounts are whole dollars without commas.
 * A negative amount is printed as a positive number with the "loss" oval filled.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { VaResult } from '../engine/va2025.ts'
import { parseBirthDate } from '../engine/va2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(Math.abs(n))
  return v === 0 && !keepZero ? '' : String(v)
}
/** Amount box plus its loss oval. */
const money = (values: Record<string, FieldValue>, key: string, n: number, lossKey?: string, keepZero = false): void => {
  values[key] = amt(n, keepZero)
  if (lossKey) values[lossKey] = n < 0
}
const mmddyyyy = (v: string): string => {
  const d = parseBirthDate(v)
  return d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${d.getUTCFullYear()}` : ''
}
/** "John Q" → ["John", "Q"]. */
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const fourLetters = (last: string): string => last.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()
const fullName = (p: Person): string => `${p.firstName} ${p.lastName}`.trim()

export function vaNames(ret: TaxReturnInput): string {
  if (ret.filingStatus !== 'mfj') return fullName(ret.taxpayer)
  const t = ret.taxpayer
  const s = ret.spouse
  return t.lastName.trim() && t.lastName.trim() === s.lastName.trim() ? `${t.firstName} & ${s.firstName} ${t.lastName}`.trim() : `${fullName(t)} & ${fullName(s)}`
}

export function form760(ret: TaxReturnInput, res: TaxReturnResult, va: VaResult, preparer?: PreparerInfo | null): FormFill {
  const L = va.lines
  const c = ret.contact
  const v = ret.virginia
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const joint = va.status === 2
  const separate = va.status === 3
  const values: Record<string, FieldValue> = {
    'Your Name': first, 'Middle initial': mi, 'Last name including suffix': ret.taxpayer.lastName.trim(),
    'SSN 1': digits(ret.taxpayer.ssn), 'First four letters of last name': fourLetters(ret.taxpayer.lastName),
    'Spouse Name': joint ? sFirst : '', 'Middle initial_spouse': joint ? sMi : '', 'Spouse Last Name': joint ? ret.spouse.lastName.trim() : '',
    'Spouse SSN': joint || separate ? digits(ret.spouse.ssn) : '', 'First four letters of last name_spouse': joint ? fourLetters(ret.spouse.lastName) : '',
    'Address': [c.street, c.apt].filter((x) => x.trim()).join(' '), 'City, Town OR Post Office': c.city, 'State': c.state.toUpperCase(), 'Zip Code': digits(c.zip),
    'Your Birthdate': mmddyyyy(v.birthDate.taxpayer), 'Spouse Birthdate': joint ? mmddyyyy(v.birthDate.spouse) : '',
    'Locality Code': digits(v.localityCode).slice(0, 3),
    "Dependent on Another's Return": ret.canBeClaimedAsDependent,
    'Schedule C filed with Federal': res.scheduleC.length > 0,
    'Earned Income Credit': res.eic.credit > 0, 'Earned Income Credit Amount': amt(res.eic.credit),
    'Filing Status': String(va.status), 'Federal Head of household': va.hoh,
    'Spouse Name_2': separate ? fullName(ret.spouse) : '',
    'Spouse if Filing Status 2': joint ? '1' : '', 'Dependents': va.exemptions.dependents ? String(va.exemptions.dependents) : '',
    'Total Exemptions Section A': String(va.exemptions.countA), 'Total Exemptions Dollar Amount Section A': amt(va.exemptions.amountA),
    'You over 65': va.exemptions.countB && va.exemptions.age65.taxpayer ? '1' : '', 'Spouse over 65': va.exemptions.countB && va.exemptions.age65.spouse ? '1' : '',
    'You Blind': va.exemptions.countB && va.exemptions.blind.taxpayer ? '1' : '', 'Spouse Blind': va.exemptions.countB && va.exemptions.blind.spouse ? '1' : '',
    'Total Exemptions Section B': va.exemptions.countB ? String(va.exemptions.countB) : '', 'Total Exemption Dollar Amount Section B': amt(va.exemptions.amountB),
    'You Age Deduction': amt(L['4you']), 'Spouse Age Deduction': amt(L['4spouse']), '4. Total Age Deduction': amt(L['4']),
    '5. Soc Sec and Rail benefits': amt(L['5']), '6. State Income tax refund or overpayment': amt(L['6']),
    '7. Subtractions': amt(L['7']), '8. Add lines 4,5,6 and 7': amt(L['8']),
    '10. Itemized Deductions': amt(L['10']), '11. Standard Deduction': amt(L['11']),
    '12. Total Exemptions Section A plus Section B above': amt(L['12']),
    // Page 2
    'SSN 2': digits(ret.taxpayer.ssn),
    '17. Spouse Tax Adjustment': L['17'] > 0 ? amt(L['17vagi']) : '', '17a Spouse Tax Adjustment Dollar Amount': amt(L['17']),
    '19a Your Virginia Witholding': amt(L['19a']), "19b Spouse's Virginia Witholding": amt(L['19b']),
    '20. Estimated Payments Made': amt(L['20']), '21. 2022 Overpayment applied to 2023': amt(L['21']), '22. Extension Payments': amt(L['22']),
    '23. Tax Credit for Low Income or Earned Income': amt(L['23']), '24. Credit for Taxes paid to another State': amt(L['24']),
    '25. Credits from SCH CR': amt(L['25']), '26. Add Lines 19a Through 25': amt(L['26'], true),
    '27. Tax you owe': amt(L['27']), '28. Overpayment': amt(L['28']), '29. Overpayment credited to next year': amt(L['29']),
    '30. Virginia529 and ABLE Contributions': amt(L['30']), '31.  Other Contributions from SCH VAC': amt(L['31']),
    'Fill in oval if 760C or 760F is enclosed': L['32'] > 0, '32. Addition to Tax , Penalty and Interest': amt(L['32']),
    "33. Consumer's Use Tax": amt(L['33']), '34. Add lines 29 Through 33': amt(L['34']),
    '35. Amount You Owe': amt(L['35'], L['36'] === 0), '36. Your Refund': amt(L['36']),
    'Your Phone Number': digits(c.phone).slice(-10)
  }
  money(values, '1. Federal Adjusted Gross Income', L['1'], 'Loss 1', true)
  money(values, '2. Additions', L['2'])
  money(values, '3. Add Lines 1 and 2', L['3'], 'Loss 3', true)
  money(values, '9. Virginia Adjusted Gross Income', L['9'], 'loss 9', true)
  money(values, '13 Total Deductions', L['13'], 'loss 13')
  money(values, '14. Add Lines 10,11, 12 and 13', L['14'], 'loss 14', true)
  money(values, '15. Virginia Taxable income', L['15'], 'loss 15', true)
  values['16. Amount of tax'] = amt(L['16'], true)
  values['loss 17'] = false
  values['18. Net Amount of Tax'] = amt(L['18'], true)
  const d = ret.refundDeposit
  if (L['36'] > 0 && digits(d.routingNumber).length === 9 && digits(d.accountNumber)) {
    values['Account Type'] = d.accountType
    values['Bank Routing Transit Number'] = digits(d.routingNumber)
    values['Bank Account Number'] = d.accountNumber.replace(/[^0-9A-Za-z]/g, '')
  }
  if (ret.usePaidPreparer && preparer) {
    values["Preparer's Name"] = preparer.name
    values['Preparer Firm Name'] = preparer.firmName
    values['Preparer Phone Number'] = preparer.phone
    values['Prepares PTIN'] = preparer.ptin.toUpperCase()
  }
  return { id: 'va760', file: 'va760.pdf', title: 'Virginia Form 760', values }
}

export function scheduleAdj(ret: TaxReturnInput, va: VaResult): FormFill {
  const A = va.adj.lines
  const values: Record<string, FieldValue> = {
    'Your SSN': digits(ret.taxpayer.ssn), 'Names as shown on Virginia return': vaNames(ret),
    '1. Interest and Obligations': amt(A['1']), '2a Conformity Addition': amt(A['2a']), '3. Total Additions': amt(A['3']),
    '4. Income from obligations': amt(A['4']), '5a Your Disability': amt(A['5a']), '5b Spouse Disability': amt(A['5b']),
    '6a Conformity Subtraction': amt(A['6a']), '7. Total Subtractions': amt(A['7']),
    '9. Total Deductions': amt(A['9']), '9 Loss': false,
    'Check if filing Sch ADJS': va.adj.overflow.length > 0,
    '18. Addition to Tax': amt(A['18']), '21. Total Addition to Tax, Penalty and Interest': amt(A['21'])
  }
  va.adj.additions.slice(0, 2).forEach((x, i) => {
    const k = ['2b', '2c'][i]
    values[`${k} Addition Code`] = x.code
    values[`${k} Amount`] = amt(x.amount)
  })
  va.adj.subtractions.slice(0, 3).forEach((x, i) => {
    const k = ['6b', '6c', '6d'][i]
    values[`${k} Subtraction Code`] = x.code
    values[`${k} Amount`] = amt(x.amount)
  })
  va.adj.deductions.slice(0, 3).forEach((x, i) => {
    const k = ['8a', '8b', '8c'][i]
    values[`${k} Deduction Code`] = x.code
    values[`${k} Amount`] = amt(x.amount)
  })
  const li = va.lowIncome
  if (li.option !== 'none' || li.eligible) {
    if (li.eligible) {
      values['Your Name_2'] = fullName(ret.taxpayer)
      values['Your Social Security Number_3'] = digits(ret.taxpayer.ssn)
      if (va.status !== 1) {
        values['Spouse Name_2'] = fullName(ret.spouse)
        values['Spouse Social Security Number_2'] = digits(ret.spouse.ssn)
      }
      if (va.status === 2 && va.sta) {
        values['Your Virginia Adjusted Gross Income'] = amt(va.sta.vagi.taxpayer, true)
        values['Spouse Virginia Adjusted Gross Income'] = amt(va.sta.vagi.spouse, true)
      } else values['Your Virginia Adjusted Gross Income'] = amt(va.lines['9'], true)
      ret.dependents.slice(0, 2).forEach((dep, i) => {
        values[`Dependent Name_${i + 1}`] = dep.name
        values[`Social Security Number Dependent_${i + 1}`] = digits(dep.ssn)
      })
      values['10. Total Family Virginia Adj Gross Income'] = amt(A['10'], true)
      values['10 Loss'] = A['10'] < 0
      values['11. total number of Exemptions'] = String(A['11'])
      values['12. Personal and Dependent Exemptions'] = String(A['12'])
      values['13. Multiply Line 12 by 300'] = amt(A['13'])
    }
    values['14. Enter EIC claimed on Federal Return'] = amt(A['14'])
    values['16b Multiply Line 14 by 20% (.20)'] = amt(A['16b'])
    values['17. credit amount'] = amt(A['17'])
  }
  return { id: 'va760adj', file: 'va760adj.pdf', title: 'Virginia Schedule ADJ', values }
}

const COLS7 = ['May 1 20257', 'June 15 20257', 'Sept 15 20257', 'Jan 15 20267'] as const
const COLS8 = ['May 1 20258', 'June 15 20258', 'Sept 15 20258', 'Jan 15 20268'] as const
const COLS9 = ['May 1 20259', 'June 15 20259', 'Sept 15 20259', 'Jan 15 20269'] as const
const COLS10 = ['May 1 202510', 'June 15 202510', 'Sept 15 202510', 'Jan 15 202610'] as const
const COLS11 = ['May 1 202511', 'June 15 202511', 'Sept 15 202511', 'Jan 15 202611'] as const
const COLS13 = ['May 1 202513', 'June 15 202513', 'Sept 15 202513', 'Jan 15 202613'] as const
const COLS15 = ['A May 1 202515', 'B June 15 202515', 'C Sept 15 202515', 'D Jan 15 202615'] as const
const LINE24 = ['Line 24', 'B June 15 202520 Amount of Underpayment From Line 14 Part I', 'C Sept 15 202520 Amount of Underpayment From Line 14 Part I', 'D Jan 15 202620 Amount of Underpayment From Line 14 Part I'] as const
const LINE21 = ['Line 21 A', 'B June 15 202520 Amount ofLine 21 B', 'Line 21 C', 'Line 21 D'] as const
const ABCD = ['A', 'B', 'C', 'D'] as const
const cents = (n: number): string => (Math.round(n * 100) / 100).toFixed(2)
const signed = (n: number): string => {
  const v = Math.round(n)
  return v === 0 ? '0' : v < 0 ? `(${Math.abs(v)})` : String(v)
}
const isoToUs = (iso: string): string => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`

export function form760c(ret: TaxReturnInput, va: VaResult): FormFill {
  const c = va.form760c
  const values: Record<string, FieldValue> = {
    'First Name Middle Initial and Last Name of Both If Joint  OR  Name of Estate or Trust': vaNames(ret),
    'Your Social Security Number or FEIN': digits(ret.taxpayer.ssn),
    'Spouses Social Security Number': va.status === 2 ? digits(ret.spouse.ssn) : '',
    '1 2025 Income Tax Liability After Spouse Tax Adjustment and Tax Credits If 150 or less you are not required to file Form 760C 1': amt(c.line1, true),
    '2 Enter 90 of the Amount Shown on Line 1 2': amt(c.line2, true),
    '3 2024 Income Tax Liability After Spouse Tax Adjustment and Tax Credits 3': c.line3 === null ? '' : amt(c.line3, true),
    '4 Enter the Amount From Line 2 or Line 3 Whichever Is Less 4': amt(c.line4, true),
    '5 Enter the Number of Installment Periods for Which You Were Liable to Make Payments 5': String(c.line5)
  }
  const long = (prefix: string, rest: string): string => `${prefix}${rest}`
  c.columns.forEach((col, i) => {
    values[long(COLS7[i], ' Tax Liability Divide the amount on Line 4 by the number of installments reported on Line 5 and enter the result in the appropriate columns')] = amt(col.required, true)
    values[long(COLS8[i], ' Enter the Income Tax Withheld for Each Installment Period')] = amt(col.withheld)
    values[long(COLS9[i], ' Enter the Overpayment Credit From Your 2024 Income Tax Return')] = amt(col.overpaymentCredit)
    values[long(COLS10[i], ' Enter the Amount of Any Timely Payment Made for Each Installment Period in the Appropriate Column Do not enter any late payments')] = amt(col.estimated)
    values[long(COLS11[i], ' Underpayment or Overpayment Subtract Lines 8 9 and 10 From Line 7 See instructions for overpayment')] = signed(col.line11)
    values[long(COLS13[i], ' Enter the Total Timely Payments Made as of Each Installment Due Date From Lines 8 9 10 and 12 For ex in Column A enter all payments made by May 1 2025')] = amt(col.line13, true)
    values[`Line  14 ${ABCD[i]}`] = amt(col.underpayment, true)
    values[long(COLS15[i], ' Total Amount Paid and Withheld From January 1 2025 Through the Installment Date Indicated')] = amt(col.paidToDate, true)
    values[['25', '50', '75', '100'][i]] = col.exception1 === null ? '' : amt(col.exception1, true)
    if (col.exceptionMet) {
      values[`Line 20 ${ABCD[i]}`] = 'Exception 1'
      values[LINE24[i]] = '0'
    } else if (col.underpayment > 0 || col.pieces.length) {
      values[`Line 20 ${ABCD[i]}`] = amt(col.underpayment, true)
      if (col.pieces.length === 1) {
        values[LINE21[i]] = isoToUs(col.pieces[0].paid)
        values[`Line 22 ${ABCD[i]}`] = String(col.pieces[0].days)
        values[`Line 23 ${ABCD[i]}`] = (col.pieces[0].days * 0.00025).toFixed(5)
      } else if (col.pieces.length > 1) {
        values[LINE21[i]] = 'See stmt'
      }
      values[LINE24[i]] = cents(col.addition)
    }
  })
  // Line 12 and the Late Payment/Overpayment Table: overpayments applied to earlier underpayments.
  const late = new Map<string, number[]>()
  c.columns.forEach((col, i) => col.pieces.filter((p) => p.paid !== '2026-05-01').forEach((p) => {
    const row = late.get(p.paid) ?? [0, 0, 0, 0]
    row[i] += p.amount
    late.set(p.paid, row)
  }))
  const rows12 = [
    { m: '12a', amount: 'Amount', cols: ['May 1 2025Row7', 'June 15 2025Row7', 'Sept 15 2025Row7', 'Jan 15 2026Row7'] },
    { m: '12b', amount: 'Amount_2', cols: ['May 1 2025', 'June 15 2025', 'Sept 15 2025', 'Jan 15 2026'] },
    { m: '12c', amount: 'Amount_3', cols: ['May 1 2025_2', 'June 15 2025_2', 'Sept 15 2025_2', 'Jan 15 2026_2'] },
    { m: '12d', amount: 'Amount_4', cols: ['May 1 2025_3', 'June 15 2025_3', 'Sept 15 2025_3', 'Jan 15 2026_3'] }
  ]
  const table = [['Date of Payment', 'Payment Amount'], ['Date of Payment_2', 'Payment Amount_2'], ['Date of Payment_3', 'Payment Amount_3'], ['Date of Payment_4', 'Payment Amount_4']]
  ;[...late.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 4).forEach(([date, amounts], k) => {
    const row = rows12[k]
    const total = amounts.reduce((a, b) => a + b, 0)
    values[`${row.m} Month`] = date.slice(5, 7)
    values[`${row.m} Day`] = date.slice(8, 10)
    values[`${row.m} Year`] = date.slice(2, 4)
    values[row.amount] = amt(total, true)
    amounts.forEach((a, i) => { if (a > 0) values[row.cols[i]] = amt(a, true) })
    values[table[k][0]] = isoToUs(date)
    values[table[k][1]] = amt(total, true)
  })
  values['100 of 2024 Tax'] = c.line3 === null ? '' : amt(c.line3, true)
  const [dollars, centsPart] = cents(c.addition).split('.')
  values['Line 25 Dollars'] = dollars
  values['Line 25 Cents'] = centsPart
  return { id: 'va760c', file: 'va760c.pdf', title: 'Virginia Form 760C', values }
}

export function buildVirginiaPacket(ret: TaxReturnInput, res: TaxReturnResult, va: VaResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [form760(ret, res, va, preparer)]
  if (va.adj.needed) forms.push(scheduleAdj(ret, va))
  if (va.needs760c) forms.push(form760c(ret, va))
  const notIncluded: string[] = []
  if (va.itemized.used) notIncluded.push('Virginia Schedule A (itemized deductions), line 19 goes on Form 760 line 10')
  if (va.adj.overflow.length) notIncluded.push('Schedule ADJS for coded additions, subtractions or deductions that do not fit on Schedule ADJ')
  if (va.lines['24'] > 0) notIncluded.push('Schedule OSC and a copy of the other state’s return (line 24)')
  if (va.lines['25'] > 0) notIncluded.push('Schedule CR (line 25)')
  if (va.lines['30'] + va.lines['31'] > 0) notIncluded.push('Schedule VAC (lines 30–31)')
  if (va.lines['32'] > 0 && !va.needs760c) notIncluded.push('Form 760C or 760F showing the addition to tax you entered (line 32)')
  if (va.needs760c && va.form760c.columns.some((c) => c.pieces.length > 1)) notIncluded.push('A statement for Form 760C lines 21–23: an underpayment was paid off in parts on different dates (each part, its date, days and amount are on the Virginia step)')
  if (va.status === 2 && va.lines['17'] > 0) notIncluded.push('Spouse Tax Adjustment worksheet (keep with your records)')
  if (ret.dependents.length > 2 && va.lowIncome.eligible) notIncluded.push('Dependents after the second for the Schedule ADJ line 10 table')
  return { forms, notIncluded }
}
