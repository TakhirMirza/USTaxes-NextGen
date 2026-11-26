/**
 * Maps a computed Arizona return onto the ADOR fillable Form 140 (2025): public/forms/2025/az140.pdf, pages 1–2
 * (the return), 3 (charitable standard deduction increase), 4 (more dependents and exemptions), 5 (other additions)
 * and 6 (other subtractions). Amounts are whole dollars; the form prints the cents.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { AzResult } from '../engine/az2025.ts'
import { AZ_DONATION_LINES, AZ_OTHER_ADDITION_LINES, AZ_OTHER_SUBTRACTION_LINES } from '../engine/az2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

const FILE = 'az140.pdf'
const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return String(v)
}
const signed = (n: number | undefined): string => {
  const v = Math.round(n ?? 0)
  return v < 0 ? `(${-v})` : v === 0 ? '0' : String(v)
}
const upper = (s: string): string => s.trim().toUpperCase()
const count = (n: number): string => (n > 0 ? String(n) : '')
const fullFirst = (p: Person): string => upper(p.firstName)
const splitName = (name: string): [string, string] => {
  const parts = name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts.pop() ?? '' : ''
  return [upper(parts.join(' ')), upper(last)]
}
const STATUS: Record<AzResult['status'], string> = { mfj: 'Married Filing Joint Return', hoh: 'Head of Household', mfs: 'Married Filing Separate Return', single: 'Single' }
const DONATION_FIELDS: Record<string, string> = {
  '64': 'Solutions Teams Assigned to Schools', '65': 'Arizona Wildlife', '66': 'Child Abuse Prevention', '67': 'Domestic Violence Services',
  '68': 'Political Gift', '69': 'Neighbors Helping Neighbors', '70': 'Special Olympics', '71': "Veterans' Donations Fund",
  '72': "I Didn't Pay Enough Fund", '73': 'Sustainable State Parks and Road Fund', '74': 'Spay/Neuter of Animals'
}
/** Field names on page 1 (lines 12–35) and page 2 (lines 36–80), keyed by line. */
const LINE_FIELDS: Record<string, string> = {
  '12': 'Federal adjusted gross income (from your federal return)', '14': 'Modified federal adjusted gross income',
  '15': 'Non-Arizona municipal interest', '17': 'Total federal depreciation',
  '18': 'Other Additions to Income:  Complete Other Additions to Arizona Gross Income schedule on page 5',
  '19': 'Subtotal:  Add lines 14 through 18 and enter the total',
  '24': 'Multiply line 23 by 25% (.25) and enter the result', '25': 'Net capital gain derived from investment in qualified small business',
  '26': 'Recalculated Arizona depreciation', '28': 'Interest on U.S. obligations such as U.S. savings bonds and treasury bills',
  '29a': 'Exclusion for federal, Arizona state or local government pensions (up to $2,500 per taxpayer)',
  '29b': 'Exclusion for benefits, annuities and pensions for retired/retainer pay of the uniformed services',
  '30': 'U.S. Social Security or Railroad Retirement Act benefits included as income on your federal return (taxable amount)',
  '31': 'Certain wages of American Indians', '32': 'Pay received for active service as a member of the reserves, national guard or the U.S. armed forces',
  '33': 'Net operating loss adjustment', '34a': '34a', '34b': '34b', '34c': '34c', '35': 'Subtract lines 24 through 34c from line 19',
  '36': 'Other Subtractions from Income.  Complete Other Subtraction from Arizona Gross Income schedule on page 6',
  '37': 'Subtract line 36 from line 35.  Enter the difference', '38': 'Age 65 or over:  Multiply the number in box 8 by $2,100',
  '39': 'Blind:  Multiply the number in box 9 by $1,500', '40': 'Other Exemptions',
  '41': 'Qualifying parents and grandparents:  Multiply the number in box 11a by $10,000',
  '42': 'Arizona adjusted gross income:  Subtract lines 38 through 41 from line 37.  If less than zero, enter “0”',
  '43': 'Deductions:  Check box and enter amount',
  '44': 'If you checked box 43S and claim charitable contributions, check 44C. Complete page 3',
  '45': 'Arizona taxable income:  Subtract lines 43 and 44 from line 42.  If less than zero, enter “0”',
  '46': 'Tax:  Multiply line 45 by 2.5% (.025).  Enter the result',
  '47': 'Tax from recapture of credits from Arizona Form 301, Part 2, line 30', '48': 'Subtotal of tax:  Add lines 46 and 47.  Enter the total',
  '49': 'Dependent Tax Credit.  See instructions', '50': 'Family income tax credit (from the worksheet - see instructions)',
  '51': 'Nonrefundable Credits from Arizona Form 301, Part 2, line 60',
  '52': 'Balance of tax:  Subtract lines 49, 50 and 51 from line 48.  If the sum of lines 49, 50 and 51 is greater than line 48, enter “0”',
  '53': '2025 AZ income tax withheld', '54a': '54a', '54b': '54b', '54c': '54c Add 54a and 54b', '55': '2025 AZ extension payment (Form 204)',
  '56': 'Increased Excise Tax Credit (from the worksheet - see instructions)', '57': 'Property Tax Credit from Arizona Form 140PTC',
  '58': 'Other refundable credits:  Check the box(es) and enter the total amount',
  '59': 'Total payments and refundable credits:  Add lines 53 through 58',
  '60': 'TAX DUE:  If line 52 is larger than line 59, subtract line 59 from line 52.  Enter amount of tax due. Skip lines 61, 62 and 63',
  '61': 'OVERPAYMENT:  If line 59 is larger than line 52, subtract line 52 from line 59.  Enter amount of overpayment',
  '62': 'Amount of line 61 to be applied to 2026 estimated tax', '63': 'Balance of overpayment:  Subtract line 62 from line 61.  Enter the difference',
  '76': 'Estimated payment penalty', '78': 'Add lines 64 through 74 and 76', '79': 'REFUND: Subtract line 78 from line 63',
  '80': 'AMOUNT OWED:  Add lines 60 and 78. Make check payable to Arizona Department of Revenue; write your SSN on payment; and include with your return'
}
/** Lines printed even when zero. */
const KEEP = new Set(['12', '14', '19', '35', '37', '42', '43', '45', '46', '48', '52', '59'])

export function formAz140(ret: TaxReturnInput, res: TaxReturnResult, az: AzResult, preparer?: PreparerInfo | null): FormFill {
  const L = az.lines
  const d = ret.az
  const c = ret.contact
  const showSpouse = az.status === 'mfj' || az.status === 'mfs'
  const values: Record<string, FieldValue> = {
    'Your First Name and Middle Initial': fullFirst(ret.taxpayer), 'Your Last Name': upper(ret.taxpayer.lastName), 'Your SSN': digits(ret.taxpayer.ssn),
    "Spouse's First Name and Middle Initial": showSpouse ? fullFirst(ret.spouse) : '', "Spouse's Last Name": showSpouse ? upper(ret.spouse.lastName) : '',
    "Spouse's SSN": showSpouse ? digits(ret.spouse.ssn) : '',
    'Current Home Address - number and street, rural route': upper(c.street), 'Apartment Number': upper(c.apt),
    'Daytime Phone': digits(c.phone).slice(-10), 'City, Town, Post Office': upper(c.city), State: upper(c.state).slice(0, 2), 'ZIP Code': digits(c.zip).slice(0, 5),
    'Filing Status': STATUS[az.status],
    'Age 65 or over': count(az.counts.age65), Blind: count(az.counts.blind), 'Dependents Under age of 17': count(az.counts.under17),
    'Dependents Age 17 and over': count(az.counts.over17), 'Qualifying parents and grandparents': count(az.counts.parents),
    'Total net capital gain or (loss)': signed(L['20']), 'Total net short-term capital gain or (loss)': signed(L['21']),
    'Total net long-term capital gain or (loss)': signed(L['22']), 'Net long-term capital gain from assets acquired after December 31, 2011': amt(L['23'], true),
    '1b': `${fullFirst(ret.taxpayer)} ${upper(ret.taxpayer.lastName)}`.trim(), '1c': digits(ret.taxpayer.ssn),
    '40E': count(az.counts.other),
    'Itemized/Standard': az.deduction.method === 'itemized' ? 'Itemized' : 'Standard',
    '44C checkbox': L['44'] > 0
  }
  if (az.status === 'hoh') {
    const q = ret.dependents[0]
    values['Head of Household'] = q ? upper(q.name) : ''
  }
  for (const [k, name] of Object.entries(LINE_FIELDS)) values[name] = amt(L[k], KEEP.has(k))
  for (const k of AZ_DONATION_LINES) values[DONATION_FIELDS[k]] = amt(L[k])
  if (L['68'] > 0 && d.politicalParty) values['Political Party'] = d.politicalParty
  // Dependents: three on page 1 (10c–10e), the rest on page 4 (10f–10p).
  const rows = ['c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p']
  az.dependents.slice(0, rows.length).forEach((x, i) => {
    const row = `10${rows[i]}`
    const [first, last] = splitName(x.name)
    values[`${row} First`] = first
    values[`${row} Last`] = last
    values[`${row} SSN`] = digits(x.ssn)
    values[`${row} Relationship`] = upper(x.relationship)
    values[`${row} Mo in Home`] = String(Math.max(0, Math.min(12, Math.round(x.months))))
    values[`${row}_10a check box`] = x.under17
    values[`${row}_10b check box`] = !x.under17
  })
  if (az.dependents.length > 3) values['10a 10b check box'] = true
  if (L['61'] > 0 && L['79'] > 0 && ret.refundDeposit.routingNumber && ret.refundDeposit.accountNumber) {
    values.Refund = ret.refundDeposit.accountType === 'savings' ? 'Savings Account' : 'Checking Account'
    values['Routing Number'] = digits(ret.refundDeposit.routingNumber).slice(0, 9)
    values['Account Number'] = ret.refundDeposit.accountNumber.replace(/[^0-9A-Za-z-]/g, '').slice(0, 17)
  }
  if (ret.usePaidPreparer && preparer) {
    values["Firm's Name"] = upper(preparer.firmName || preparer.name)
    values["Paid Preparer's TIN"] = preparer.ptin.toUpperCase()
    values["Paid Preparer's Phone Number"] = digits(preparer.phone).slice(-10)
  }
  // Page 3: standard deduction increase for charitable contributions.
  const C = az.charity
  if (L['44'] > 0) {
    Object.assign(values, {
      '2025 Gifts by cash or check': amt(C['1C'], true), '2025 Other than by cash or check': amt(C['2C'], true), 'Carryover from prior year': amt(C['3C'], true),
      'Add lines 1C through 3C and enter the total': amt(C['4C'], true),
      'Total charitable contributions made in 2025 for which you are claiming a credit under Arizona law for the current (2025) or prior (2024) tax year': amt(C['5C'], true),
      'Subtract line 5c from line 4c and enter the difference. If less than zero, enter 0': amt(C['6C'], true),
      'Multiply line 6C by 34% (.34) and enter the result': amt(C['7C'], true)
    })
  }
  if (L['18'] > 0) Object.assign(values, spreadAzLines(ret.explain?.['az.otherAdditions'] ?? [], L['18'], AZ_OTHER_ADDITION_LINES), { 'Total Other Additions:  Add all amounts and enter the total here and on page 1, line 18': amt(L['18']) })
  if (L['36'] > 0) Object.assign(values, spreadAzLines(ret.explain?.['az.otherSubtractions'] ?? [], L['36'], AZ_OTHER_SUBTRACTION_LINES), { 'Total Other Subtractions:  Add all amounts and enter the total here and on page 2, line 36': amt(L['36']) })
  const pages = [0, 1]
  if (L['44'] > 0) pages.push(2)
  if (az.dependents.length > 3) pages.push(3)
  if (L['18'] > 0) pages.push(4)
  if (L['36'] > 0) pages.push(5)
  return { id: 'az140', file: FILE, title: 'Arizona Form 140', values, pages }
}

/** Form 140PTC property tax refund (credit) claim, filed separately. */
export function formAz140ptc(ret: TaxReturnInput, az: AzResult): FormFill | null {
  const t = az.ptc
  if (!t) return null
  const p = ret.az.ptc
  const c = ret.contact
  const joint = ret.filingStatus === 'mfj'
  const v: Record<string, FieldValue> = {}
  const n = (x: number): string => String(Math.round(x))
  v.FirstNameTP = ret.taxpayer.firstName.trim().toUpperCase(); v.LastNameTP = ret.taxpayer.lastName.trim().toUpperCase()
  v['SSN_TP.1'] = ret.taxpayer.ssn.replace(/\D/g, '')
  if (joint) { v.FirstNameSpouse = ret.spouse.firstName.trim().toUpperCase(); v.LastNameSpouse = ret.spouse.lastName.trim().toUpperCase(); v.SSN_Spouse = ret.spouse.ssn.replace(/\D/g, '') }
  v.HomeAddress = c.street.trim().toUpperCase(); v.Apt = c.apt.trim().toUpperCase(); v.City = c.city.trim().toUpperCase(); v.State = c.state.trim().toUpperCase(); v.Zip = c.zip.replace(/\D/g, '').slice(0, 5)
  if (c.phone) v['Phone.Daytime'] = c.phone.replace(/\D/g, '')
  v.DateBirth = p.birthDate.replace(/\D/g, '')
  const old = ret.taxpayer.age >= 65 || ret.taxpayer.age65OrOlder
  v.rdo4 = p.own ? '#1' : '#0'
  v.rdo5 = '#0'; v.rdo6 = '#0'; v.rdo7 = '#0'
  v.rdo8 = old ? '#0' : '#1'; v.rdo9 = p.ssi ? '#0' : '#1'
  const L = t.lines
  v['10'] = n(L['10'])
  v[p.livedAlone ? 'chk.11a' : 'chk.11b'] = true
  v['11'] = n(L['11'])
  if (L['12']) v['12'] = n(L['12'])
  if (L['13']) v['13'] = n(L['13'])
  v['14'] = n(L['14']); v['15'] = n(L['15'])
  if (p.claimedByName.trim()) { v.TaxpayerName = p.claimedByName.trim().toUpperCase(); v.TPssn = p.claimedBySsn.replace(/\D/g, ''); v.TPaddress = p.claimedByAddress.trim().toUpperCase() }
  if (L['17']) v['17'] = n(L['17'])
  if (L['18'] !== undefined) v['18'] = n(L['18'])
  v['19'] = n(L['19'])
  // Page 2
  v.NameTP = `${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`.trim().toUpperCase(); v['SSN_TP.2'] = ret.taxpayer.ssn.replace(/\D/g, '')
  for (const [k, cols] of Object.entries(t.income)) {
    const row = k.toLowerCase()
    cols.forEach((x, j) => { if (x || j === 3) v[`part1.${row}${j + 1}`] = n(x) })
  }
  v['part1.j4'] = n(t.J)
  t.dependents.forEach((x, i) => {
    const r = ['a', 'b', 'c'][i]
    v[`D10${r}.1.1`] = x.name.trim().toUpperCase(); v[`D10${r}.1.3`] = x.ssn.replace(/\D/g, ''); v[`D10${r}.1.4`] = x.relationship.trim().toUpperCase(); v[`D10${r}.1.5`] = String(x.months)
  })
  if (L['p2'] !== undefined) for (const k of ['2', '3', '4', '5', '6']) v[`part2.${k}`] = n(L[`p${k}`])
  return { id: 'az140ptc', file: 'az-140ptc.pdf', title: 'Arizona Form 140PTC (filed separately)', values: v }
}

/** Items on their page 5/6 lines; whatever is not on a named line (or the difference from the total) goes on "Other adjustments". */
function spreadAzLines(items: { line: string; amount: number }[], total: number, lines: string[]): Record<string, FieldValue> {
  const other = lines[lines.length - 1]
  const by = new Map<string, number>()
  for (const x of items) {
    const f = lines.includes(x.line) ? x.line : other
    by.set(f, (by.get(f) ?? 0) + Math.round(x.amount))
  }
  const listed = [...by.values()].reduce((s, n) => s + n, 0)
  if (listed !== total) by.set(other, (by.get(other) ?? 0) + total - listed)
  const out: Record<string, FieldValue> = {}
  for (const [f, n] of by) if (n) out[f] = n < 0 ? `(${Math.abs(n)})` : String(n)
  return out
}

export function buildAzPacket(ret: TaxReturnInput, res: TaxReturnResult, az: AzResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formAz140(ret, res, az, preparer)]
  const ptc = formAz140ptc(ret, az)
  if (ptc) forms.push(ptc)
  const notIncluded = az.attach.filter((a) => !a.startsWith('Form 140 page'))
  if (az.lines['18'] > 0 && !(ret.explain?.['az.otherAdditions'] ?? []).length) notIncluded.push('Page 5: the total is on the Other adjustments line; list the items in the Arizona section to put each on its own line')
  if (az.lines['36'] > 0 && !(ret.explain?.['az.otherSubtractions'] ?? []).length) notIncluded.push('Page 6: the total is on the Other adjustments line; list the items in the Arizona section to put each on its own line')
  if (az.counts.parents > 0) notIncluded.push('Names, SSNs and details of the qualifying parents or grandparents (lines 11b–11c and page 4, Part 2)')
  if (az.counts.other > 0) notIncluded.push('Page 4, Part 3: the people you claim as other exemptions')
  forms.push(...dependentsStatement(ret, 14, 'Form 140, page 4, Dependents (continued)', 'st-az-deps'))
  return { forms, notIncluded }
}
