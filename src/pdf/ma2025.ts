/**
 * Maps a computed Massachusetts return onto the 2025 Form 1 fill-in PDF (public/forms/2025/ma1.pdf).
 * Amounts are whole dollars (the cents are printed); losses use the "X" box beside the line.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MaResult } from '../engine/ma2025.ts'
import { MA_DONATION_LETTERS } from '../engine/ma2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.abs(Math.round(n))
  if (v === 0) return keepZero ? '0' : ''
  return String(v)
}
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const STATUS: Record<TaxReturnInput['filingStatus'], string> = { single: 'Single', mfj: 'Married filing jointly', mfs: 'Married filing separately', hoh: 'Head of household', qss: 'Single' }

/** Field names are the form's own; "line N. …" prefixes identify them. */
const F = {
  '3': 'line 3. Wages, salaries, tips and other employee compensation (from all Forms W-2)',
  '4': 'line 4. Taxable pensions and annuities. Attach any Form(s) 1099-R with Massachusetts withholding. See instructions',
  '5': 'line 5. Massachusetts bank interest',
  '6a': 'line 6a. Business/profession income or loss. Enclose Schedule C',
  '7': 'line 7. If you are reporting rental, royalty, REMIC, partnership, S corporation, or trust income or loss, see instructions',
  '8a': 'line 8a. Unemployment compensation. See instructions',
  '8b': 'line 8b. Massachusetts state lottery winnings',
  '9': 'line 9. Other income from Schedule X, line 7. Enclose Schedule X; not less than 0',
  '10': 'line 10. Total 5.0% income. Add lines 3 through 9. Be sure to subtract any losses in lines 6 or 7',
  '11a': 'line 11a. Amount you paid to Social Security, Medicare, Railroad, U.S. or Massachusetts retirement. Not more than $2,000',
  '11b': 'line 11b. Amount spouse paid to Social Security, Medicare, Railroad, U.S. or Massachusetts retirement. Not more than $2,000',
  '14': 'line 14 rental deduction. line 14a divided by 2',
  '14a': 'line 14a. Enter the total qualified rent paid in 2025 in the box',
  '15': 'line 15. Other deductions from Schedule Y, line 19. Enclose Schedule Y',
  '16': 'line 16. Total deductions. Add lines 11 through 15',
  '17': 'line 17. 5.0% Income after deductions. Subtract line 16 from line 10. Not less than 0',
  '18': 'line 18. Total exemption amount (from line 2g)',
  '19': 'line 19. 5.0% Income After Exemptions. Subtract line 18 from line 17. Not less than 0. If line 17 is less than line 18, see instructions',
  '20': 'line 20. Interest And Dividend Income (from Schedule B, line 38). Not less than 0. Enclose Schedule B',
  '21': 'line 21. Total Taxable 5.0% Income. Add lines 19 and 20',
  '22': 'line 22. Tax On 5.0% Income (from tax table). If line 21 is more than $24,000, multiply by .05',
  '23a': 'line 23a.  8.5% Income From Schedule B (see instructions). Not less than 0. Enclose Schedule B',
  '23aTax': 'line 23a multiplied by .085',
  '23': 'line 23. Total Tax On Income From Schedule B. Add lines 23a and 23b',
  '24': 'line 24. Tax On Long-Term Capital Gains (from Schedule D, line 22). Not less than 0. Enclose Schedule D',
  '28a': 'line 28a. Income tax. Add lines 22 through 26',
  '28b': 'line 28b. 4% Surtax (from Schedule 4% Surtax, line 7). See instructions',
  '28': 'line 28. Total tax. Add lines 28a and 28b',
  '29': 'line 29. Limited Income Credit (from worksheet)',
  '30': 'line 30. Income tax due to another state or jurisdiction (from worksheet). Not less than 0. Enclose Schedule OJC',
  '31': 'line 31. Other credits (from Schedule CMS)',
  '32': 'line 32. Income Tax After Credits. Subtract total of lines 29 through 31 from line 28. Not less than 0',
  '33': 'line 33. Total voluntary fund contributions. Add lines 33a through 33f',
  '34': 'line 34. Use tax due on Internet, mail order and other out-of-state purchases (from worksheet)',
  '37': 'line 37. Income Tax After Credits, Contributions, Use Tax And Hc Penalty. Add lines 32 through 36',
  '38a': 'Line 38a. Massachusetts income tax withheld from Form(s) W-2',
  '38b': 'Line 38b. Massachusetts income tax withheld from Form(s) 1099. Enclose Schedule 62-WH. See instructions',
  '38c': 'Line 38c. Massachusetts income tax withheld from other forms. Enclose Schedule 62-WH. See instructions',
  '38': 'Line 38. Total Massachusetts income tax withheld. Add lines 38a through 38c',
  '39': 'line 39. 2024 overpayment applied to your 2025 estimated tax (from 2024 Form 1, line 52 or Form 1-NR/PY, line 56.)',
  '40': 'Line 40. 2025 Massachusetts estimated tax payments. Do not include line 39 amount',
  '41': 'line 41. Payments made with extension',
  '43a': 'line 43a. number of qualifying children for earned income credit',
  '43b': 'line 43b. Amount of earned income credit from U.S. return',
  '43c': 'line 43c. percentage of federal earned income credit allowed. see instructions',
  '43': 'line 43. line 43b multiplied by percentage in line 43c',
  '44': 'line 44. Senior Circuit Breaker Credit. Enclose Schedule CB',
  '46a': 'line 46a. enter number of dependents for child and family tax credit',
  '46b': 'line 46b. amount of child and family tax credit. see instructions',
  '46': 'line 46. child and family tax credit. multiply line 46a by line 46b',
  '48': 'line 48. Total Refundable Credits. Add lines 43 through 47',
  '51': 'line 51. Total. Add lines 38 through 42 and lines 48 through 50',
  '52': 'line 52. Overpayment. If line 37 is smaller than line 51, subtract line 37 from line 51. If line 37 is larger than line 51, go to line 55. If line 37 and line 51 are equal, enter 0 in line 54',
  '53': 'line 53. Amount of overpayment you want applied to your 2026 estimated tax',
  '54': 'line 54. This Is Your Refund. Subtract line 53 from line 52. Mail to: Massachusetts DOR, PO Box 7000, Boston, MA 02204',
  '55': 'line 55. Tax Due. Subtract line 51 from line 37. Pay in full online at mass.gov/masstaxconnect'
} as const
const DONATION: Record<string, string> = {
  a: 'line 33a. Voluntary fund contributions. Endangered Wildlife Conservation', b: 'line 33b. Voluntary fund contributions. Organ transplant',
  c: 'line 33c. Voluntary fund contributions. Massachusetts Public Health HIV and Hepatitis Fund', d: 'line 33d. Voluntary fund contributions. Massachusetts U.S. Olympic',
  e: 'line 33e. Voluntary fund contributions. Massachusetts Military Family Relief', f: 'line 33f. Voluntary fund contributions. Homeless Animal Prevention And Care'
}
const KEEP_ZERO = new Set(['10', '16', '17', '18', '19', '21', '22', '28', '32', '37', '51'])

export function formMa1(ret: TaxReturnInput, res: TaxReturnResult, ma: MaResult, preparer?: PreparerInfo | null): FormFill {
  const L = ma.lines
  const d = ret.ma
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const showSpouse = joint || fs === 'mfs'
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const f = res.f1040
  const values: Record<string, FieldValue> = {
    "taxpayer's first name": upper(first), "taxpayer's middle initial": mi, "taxpayer's last name": upper(ret.taxpayer.lastName),
    "taxpayer's social security number": digits(ret.taxpayer.ssn),
    "Spouse's first name": showSpouse ? upper(sFirst) : '', "Spouse's middle initial": showSpouse ? sMi : '', "spouse's last name": showSpouse ? upper(ret.spouse.lastName) : '',
    "spouse's social security number": showSpouse ? digits(ret.spouse.ssn) : '',
    'Mailing address (no. & street; apt./suite/postal box). If you have a foreign address, also complete line below': upper([c.street, c.apt].filter((x) => x.trim()).join(' ')),
    'city or town': upper(c.city), state: upper(c.state).slice(0, 2), zip: digits(c.zip).slice(0, 9),
    '1$ Taxpayer': d.electionFund.taxpayer, '1$ Spouse': joint && d.electionFund.spouse,
    'state election campaign fund contributuion total': String((d.electionFund.taxpayer ? 1 : 0) + (joint && d.electionFund.spouse ? 1 : 0) || ''),
    taxpayer: d.veteran.taxpayer, spouse: joint && d.veteran.spouse,
    'reporting digital assets (see instructions)': ret.digitalAssets === true,
    'a Total federal income from U.S. Form 1040, line 9': amt(f['9'], true), 'fill in box if line a is a loss': f['9'] < 0,
    'b Total federal income from U.S. Form 1040, line 11a': amt(f['11a'], true), 'fill in box if line b is a loss': f['11a'] < 0,
    'line 1 filing status': STATUS[fs],
    'line 2a Personal exemptions. Single/Married filing separately ($4,400), Head of household ($6,800), Married filing jointly ($8,800)': amt(L['2a']),
    'line 2b. Number of dependents (do not include yourself or your spouse). Enclose Schedule DI': L['2bCount'] ? String(L['2bCount']) : '',
    'line 2b Total. Number of dependents multiplied by $1000': amt(L['2b']),
    'line 2c taxpayer age 65 or over before 2026': ret.taxpayer.age65OrOlder || ret.taxpayer.age >= 65,
    "line 2c taxpayer's spouse age 65 or over before 2026": joint && (ret.spouse.age65OrOlder || ret.spouse.age >= 65),
    'total number of over age 65 or over before 2026': L['2cCount'] ? String(L['2cCount']) : '',
    'line 2c Total. Number of age 65 or over before 2026 multiplied by $700': amt(L['2c']),
    'line 2d taxpayer blindness exemption': ret.taxpayer.blind, "line 2d taxpayer's spouse blindness exemption": joint && ret.spouse.blind,
    'total number taking blindness exemption': L['2dCount'] ? String(L['2dCount']) : '',
    'line 2d Total. Number of blindness exemption multiplied by $2,200': amt(L['2d']),
    'line 2e Medical or dental exemption amount from U.S. Schedule A, line 4': amt(L['2e']),
    'line 2g. Total exemptions. Add lines 2a through 2f. Enter here and on line 18': amt(L['2g'], true),
    'fill in box if line 6a is a loss': L['6a'] < 0, 'fill in box if line 7 is a loss': L['7'] < 0, 'fill in box if line 10 is a loss': L['10'] < 0,
    'line 24 excess exemption. If excess exemptions were used in calculating lines 20, 23 or 24, fill in oval and see instructions': ma.excessExemptions > 0 && (L['20'] + L['23a'] + L['24'] > 0 || ma.scheduleB.interest + ma.scheduleB.dividends > 0),
    'line 27. If you qualify for No Tax Status, fill in oval and enter 0 in line 28 (from worksheet)': ma.noTaxStatus,
    'taxpayer email address': c.email.trim()
  }
  for (const [k, name] of Object.entries(F)) values[name] = amt(L[k], KEEP_ZERO.has(k))
  values[F['43c']] = L['43'] > 0 ? '40%' : ''
  values[F['46b']] = L['46'] > 0 ? '440' : ''
  values[F['43a']] = L['43'] > 0 && L['43a'] ? String(L['43a']) : ''
  values[F['46a']] = L['46'] > 0 ? String(L['46a']) : ''
  if (ma.noTaxStatus) values[F['28']] = '0'
  for (const k of MA_DONATION_LETTERS) values[DONATION[k]] = amt(L[`33${k}`])
  const phone = digits(c.phone).slice(-10)
  if (phone) values['taxpayer phone number'] = phone
  if (L['54'] > 0 && ret.refundDeposit.routingNumber && ret.refundDeposit.accountNumber) {
    values['direct deposit'] = ret.refundDeposit.accountType === 'savings' ? 'Savings' : 'Checking'
    values['Direct deposit of refund. Routing number (first two digits must be 01 to 12 or 21 to 32)'] = digits(ret.refundDeposit.routingNumber)
    values['Direct deposit of refund. Account number'] = ret.refundDeposit.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
  }
  if (ret.usePaidPreparer && preparer) {
    values['Print Paid Preparer’S Name'] = upper(preparer.name)
    values["Paid Preparer's Social Security number or Preparer's Tax Identification number"] = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9)
    values["Paid Preparer's phone number"] = digits(preparer.phone).slice(-10)
    values["Paid Preparer's Employer Identification number"] = digits(preparer.firmEin)
    values['fill in if paid preparer is self-employed'] = preparer.selfEmployed
  }
  return { id: 'ma1', file: 'ma1.pdf', title: 'Massachusetts Form 1', values }
}

export function buildMaPacket(ret: TaxReturnInput, res: TaxReturnResult, ma: MaResult, preparer?: PreparerInfo | null): FormPacket {
  return { forms: [formMa1(ret, res, ma, preparer)], notIncluded: [...ma.attach, 'Signatures on page 1'] }
}
