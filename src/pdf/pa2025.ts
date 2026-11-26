/**
 * Maps a computed Pennsylvania return onto the PA Department of Revenue fill-in PDFs (2025): Form PA-40
 * (public/forms/2025/pa40.pdf), PA Schedule SP (pa40sp.pdf) and PA Schedule O (pa40o.pdf).
 * Amounts are whole dollars; losses fill the LOSS oval.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { PaResult } from '../engine/pa2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(Math.abs(n))
  return v === 0 && !keepZero ? '' : String(v)
}
const upper = (s: string): string => s.toUpperCase()
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const fullName = (p: Person): string => `${p.firstName.trim()} ${p.lastName.trim()}`.trim()
const displayName = (ret: TaxReturnInput): string => ret.filingStatus === 'mfj' && ret.spouse.firstName.trim() ? `${fullName(ret.taxpayer)} & ${fullName(ret.spouse)}` : fullName(ret.taxpayer)
const scheduleOCode = (pa: PaResult): string => {
  const kinds = [pa.scheduleO.tuition.taxpayer + pa.scheduleO.tuition.spouse > 0 ? 'T' : '', pa.scheduleO.hsa > 0 ? 'H' : '', pa.scheduleO.studentLoan > 0 ? 'S' : ''].filter(Boolean)
  return kinds.length > 1 ? 'C' : kinds[0] ?? ''
}

export function formPA40(ret: TaxReturnInput, res: TaxReturnResult, pa: PaResult, preparer?: PreparerInfo | null): FormFill {
  const L = pa.lines
  const d = ret.pa
  const c = ret.contact
  const fs = ret.filingStatus
  const showSpouse = fs === 'mfj' || fs === 'mfs'
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const values: Record<string, FieldValue> = {
    'Enter SSN shown first without dashes or spaces': digits(ret.taxpayer.ssn), 'Enter SSN of spouse without dashes or spaces': showSpouse ? digits(ret.spouse.ssn) : '',
    "Use all caps to enter taxpayer's last name": upper(ret.taxpayer.lastName.trim()), "Use all caps to enter taxpayer's first name": upper(first), 'Use Cap For Your Middle Initial': upper(mi),
    "Use all caps to enter spouse's first name": showSpouse ? upper(sFirst) : '', "Use Cap For Your Spouse's Middle Initial": showSpouse ? upper(sMi) : '',
    "Use all caps to enter spouse's last name if different from above": showSpouse && ret.spouse.lastName.trim().toUpperCase() !== ret.taxpayer.lastName.trim().toUpperCase() ? upper(ret.spouse.lastName.trim()) : '',
    'Use all caps to enter First Line of Address': upper([c.street, c.apt].filter((x) => x.trim()).join(' ')), 'Use all caps to enter City or Post Office': upper(c.city.trim()),
    'Use all caps to enter two character State abbreviation': upper(c.state.trim()), 'Enter five digit Zip Code': digits(c.zip).slice(0, 5),
    'Enter Daytime Telephone Number without parenthesis, dashes or spaces': digits(c.phone).slice(-10),
    'Enter five digit School Code from list on pags 42 & 43': digits(d.schoolCode).slice(0, 5), 'Name of School District': upper(d.schoolDistrict.trim()),
    'Your Occupation': upper(ret.taxpayer.occupation), "Spouse's occupation": fs === 'mfj' ? upper(ret.spouse.occupation) : '',
    'Residency Status': '1', 'Filing Status': fs === 'mfj' ? '2' : fs === 'mfs' ? '3' : '1',
    '1a. Gross Compensation': amt(L['1a'], true), '1b. Unreimbursed Employee Business Expenses': amt(L['1b']), '1c. Net Compensation': amt(L['1c'], true),
    '2. Interest Income': amt(L['2']), '3. Dividend  and Capital Gains Distributions Income': amt(L['3']),
    '4. Net Income or Loss from the Operation of a Business, etc': amt(L['4']), '4. Loss': pa.losses.business,
    '5. Net Gain or Loss from Sale, etc. of Property': amt(L['5']), '5. Loss': pa.losses.property,
    '6. Net Income or Loss from Rents, etc': amt(L['6']), '6. Loss': pa.losses.rents,
    '7. Estate or Trust income': amt(L['7']), '8. Gambling and Lottery Winnings': amt(L['8']), '9. Total PA Taxable Income': amt(L['9'], true),
    Code: L['10'] > 0 ? scheduleOCode(pa) : '', '10.  Other Deductions': amt(L['10']), '11. Adjusted PA Taxable Income': amt(L['11'], true),
    'Name(s)': upper(displayName(ret)),
    '12. PA Tax Liability. Multiply Line 11 by 3.07%': amt(L['12'], true), '13. Total PA Tax Withheld': amt(L['13']), '14. Credit from your PA Income Tax Return': amt(L['14']),
    '15. Estimated Installment Payments': amt(L['15']), '16. Extension Payment': amt(L['16']), '18.Total Estimated Payments and Credits': amt(L['18']),
    '21. Tax Forgiveness Credit': amt(L['21']), '22. Resident Credit': amt(L['22']), '23.Total Other Credits': amt(L['23']), '24. Total Payments and Credits': amt(L['24'], true),
    '25. USE TAX': amt(L['25'], true), '26. TAX DUE': amt(L['26']), '27.Penalties and Interest': amt(L['27']), '28. TOTAL PAYMENT': amt(L['28']),
    '29. OVERPAYMENT': amt(L['29']), '30. Refund': amt(L['30']), '31. Credit': amt(L['31'])
  }
  if (L['21'] > 0) {
    values['Tax Forgiveness'] = pa.forgiveness.married ? '2' : '1'
    values.Dependents = pa.forgiveness.children ? String(pa.forgiveness.children) : ''
    values['20. Total Eligibility Income'] = amt(L['20'], true)
  }
  if (ret.usePaidPreparer && preparer) {
    values["Preparer's Name"] = upper(preparer.name)
    values["Preparer's Telephone Number"] = digits(preparer.phone).slice(-10)
    values['Firm FEIN'] = digits(preparer.firmEin)
  }
  return { id: 'pa40', file: 'pa40.pdf', title: 'Pennsylvania Form PA-40', values }
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix']

export function scheduleSP(ret: TaxReturnInput, res: TaxReturnResult, pa: PaResult): FormFill {
  const L = pa.lines
  const f = pa.forgiveness
  const showSpouse = ret.filingStatus === 'mfj' || ret.filingStatus === 'mfs'
  const values: Record<string, FieldValue> = {
    'Enter the name of the taxpayer claiming Tax Forgiveness': upper(fullName(ret.taxpayer)), 'Enter the Social Security number shown first on the return': digits(ret.taxpayer.ssn),
    'Enter the spouse’s name (even if filing separately)': showSpouse ? upper(fullName(ret.spouse)) : '', 'Enter the spouse’s Social Security number': showSpouse ? digits(ret.spouse.ssn) : '',
    '1. – Enter: Yes, if a dependent on another taxpayer’s federal tax return; or, No, if not a dependent on another taxpayer’s federal return': ret.canBeClaimedAsDependent ? 'Yes' : 'No',
    'Click on the appropriate filing status of: unmarried; separated; married; or, deceased. See the instructions': f.married ? '3' : '1',
    'Enter the total number of dependents listed on Line 1': f.children ? String(f.children) : '',
    'Enter the taxpayer’s Social Security number': digits(ret.taxpayer.ssn)
  }
  const pct = f.percent.toFixed(2)
  if (ret.filingStatus === 'mfs') values['15 – Enter the appropriate percentage of Tax Forgiveness as a decimal from the appropriate eligibility income table found on Page 4 of the instructions for this form while using the total number of dependents from Section II, Line 2'] = pct
  else values['15 – Enter the appropriate percentage of Tax Forgiveness as a decimal from the appropriate eligibility income table found on Page 4 of the instructions  for this form while using the total number of dependents from Section II, Line 2'] = pct
  if (f.married) values['Click on the appropriate status of: married; married filing separately; married with spouse who is a dependent on another’s return; or, separated and lived apart for less than six months. See the instructions'] = ret.filingStatus === 'mfs' ? '4' : '3'
  else values['Click on the appropriate status of: single/unmarried/divorced; or, single and claimed as a dependent on another taxpayer’s return. See the instructions'] = '1'
  ret.dependents.filter((x) => x.childRelationship).slice(0, 9).forEach((k, i) => {
    const n = ROMAN[i]
    values[`1${n}.- Enter the dependent’s first and last name`] = upper(k.name)
    values[`1${n}. – Enter the dependent’s age`] = String(k.age)
    values[`1${n}. – Enter the dependent’s relationship (child, step-child, foster child, adopted child or grandchild) to the taxpayer. See the instructions`] = upper(k.relationship)
    values[`1${n}. – Enter the dependent’s Social Security number`] = digits(k.ssn)
  })
  if (ret.filingStatus === 'mfs') {
    Object.assign(values, {
      '1. – Enter the taxpayer’s total taxable income from Line 9 of the PA-40 when completing the ovals for Lines 3b, 3c or 3d in Section I': amt(L['9'], true),
      '3. - Enter the taxpayer’s amount of any nontaxable interest, dividends and gains and/or annualized income when completing the ovals for Lines 3b, 3c or 3d in Section I. See the instructions': amt(f.nontaxable),
      '11 – Add the Column B and Column C amounts for Lines 1 through 10 and enter the result here': amt(f.eligibility, true),
      '12. – Enter the PA tax liability from Line 12 of the PA-40 return when completing the ovals for Lines 3b, 3c or 3d in Section I': amt(L['12'], true),
      '13 – Enter the amount of any resident credit included on Line 22 of the PA-40 return when completing the ovals for Lines 3b, 3c or 3d in Section I': amt(L['22']),
      '14. – Subtract Line 13 from Line 12 and enter the result here when completing the ovals for Lines 3b, 3c or 3d in Section I': amt(L['12'] - L['22'], true),
      '16 – Multiply Line 14 by the decimal on Line 15 and enter the result here and on Line 21 of the PA-40 return when completing the ovals for Lines 3b, 3c or 3d in Section I': amt(L['21'], true)
    })
  } else {
    Object.assign(values, {
      '1. – Enter the total taxable income from Line 9 of the PA-40 return when completing the ovals for Lines 1a, 1b, 2, 3a or 4 in Section I': amt(L['9'], true),
      '3. - Enter the total amount of any nontaxable interest, dividends and gains and/or annualized income when completing the ovals for Lines 1a, 1b, 2, 3a or 4 in Section I. See the instructions': amt(f.nontaxable),
      '11 – Add the Column A amounts for Lines 1 through 10 and enter the result here': amt(f.eligibility, true),
      '12. – Enter the PA tax liability from Line 12 of the PA-40 return when completing the ovals for Lines 1a, 1b, 2, 3a or 4 in Section I': amt(L['12'], true),
      '13 – Enter the amount of any resident credit included on Line 22 of the PA-40 return when completing the ovals for Lines 1a, 1b, 2, 3a or 4 in Section I': amt(L['22']),
      '14. – Subtract Line 13 from Line 12 and enter the result here when completing the ovals for Lines 1a, 1b, 2, 3a or 4 in Section I': amt(L['12'] - L['22'], true),
      '16 – Multiply Line 14 by the decimal on Line 15 and enter the result here and on Line 21 of the PA-40 return when completing the ovals for Lines 1a, 1b, 2, 3a or 4 in Section I': amt(L['21'], true)
    })
  }
  return { id: 'pa40sp', file: 'pa40sp.pdf', title: 'PA Schedule SP', values }
}

export function scheduleO(ret: TaxReturnInput, pa: PaResult): FormFill {
  const o = pa.scheduleO
  const joint = ret.filingStatus === 'mfj'
  const tp = o.tuition.taxpayer + o.hsa + o.studentLoan
  const values: Record<string, FieldValue> = {
    'Name (if filing jointly, use name shown first on the PA-40)': upper(fullName(ret.taxpayer)), 'Enter the Social Security number shown first on the PA-40': digits(ret.taxpayer.ssn),
    'CONTRIBUTIONS BY TAXPAYER  (1)': amt(o.tuition.taxpayer), 'Total IRC Section 529 Contributions  TAXPAYER': amt(o.tuition.taxpayer),
    'CONTRIBUTIONS BY SPOUSE (1)': joint ? amt(o.tuition.spouse) : '', 'Total IRC Section 529 Contributions  SPOUSE': joint ? amt(o.tuition.spouse) : '',
    'PART III - Health Savings Account contributions allowed for federal purposes TAXPAYER 6(c)': amt(o.hsa),
    'PART III - Student Loan Interest Deduction TAXPAYER 7(c)': amt(o.studentLoan),
    'PART III - Add Lines 2, 4, 5, 6, and 7 and enter amounts here TAXPAYER 8(c)': amt(tp),
    'PART III - Total income reported on PA-40 Line 9 TAXPAYER 8(c)': amt(pa.lines['9'], true),
    'PART III - Lesser of Line 7 or Line 8 for taxpayer and/or spouse. TAXPAYER 9(c)': amt(Math.min(tp, pa.lines['9'])),
    'PART III - Total Other Deductions 11': amt(pa.lines['10'])
  }
  if (joint && o.tuition.spouse) {
    values['PART III - Add Lines 2, 4, 5, 6, and 7 and enter amounts here SPOUSE 8(d)'] = amt(o.tuition.spouse)
    values['PART III - Lesser of Line 7 or Line 8 for taxpayer and/or spouse. SPOUSE 9(d)'] = amt(o.tuition.spouse)
  }
  return { id: 'pa40o', file: 'pa40o.pdf', title: 'PA Schedule O', values }
}

export function buildPaPacket(ret: TaxReturnInput, res: TaxReturnResult, pa: PaResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formPA40(ret, res, pa, preparer)]
  if (pa.lines['21'] > 0) forms.push(scheduleSP(ret, res, pa))
  if (pa.lines['10'] > 0) forms.push(scheduleO(ret, pa))
  const filled = new Set(['PA Schedule O, other deductions', 'PA Schedule SP, Tax Forgiveness'])
  const notIncluded = pa.attach.filter((a) => !filled.has(a))
  if (pa.scheduleO.tuition.taxpayer + pa.scheduleO.tuition.spouse > 0) notIncluded.push('PA Schedule O Section I: each 529 beneficiary’s name and Social Security number')
  if (ret.filingStatus === 'mfj' && pa.lines['10'] > 0) notIncluded.push('PA Schedule O: split the HSA and student loan deductions between spouses if both had them')
  return { forms, notIncluded }
}
