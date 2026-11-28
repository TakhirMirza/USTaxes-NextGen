/**
 * Maps a computed Massachusetts return onto the 2025 Form 1 fill-in PDF (public/forms/2025/ma1.pdf).
 * For 2026, public/forms/2026 holds DOR's early-release drafts of Form 1 and Schedules HC, X, Y, DI, B and D carrying
 * the 2025 fields (the field names keep their 2025 wording; Form 1 page 4 from line 46 and Schedule X from line 4 were
 * moved to the redrawn lines).
 * Amounts are whole dollars (the cents are printed); losses use the "X" box beside the line.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MaResult } from '../engine/ma2025.ts'
import { MA_DONATION_LETTERS } from '../engine/ma2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

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
  '35a': 'line 35a. Your Health Care penalty. Not less than 0 (from worksheet). Enclose Schedule HC',
  '35b': "line 35b. Spouse's Health Care penalty. Not less than 0 (from worksheet). Enclose Schedule HC",
  '35': 'line 35. Total health care penalty. Add lines 35a and 35b',
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const mmddyyyy = (v: string): string => {
  const t = v.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  return iso ? `${iso[2]}${iso[3]}${iso[1]}` : digits(t).slice(0, 8)
}
const splitName = (full: string): { first: string; mi: string; last: string } => {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return { first: full.trim(), mi: '', last: '' }
  const last = parts.pop() ?? ''
  const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? (parts.pop() ?? '').replace('.', '') : ''
  return { first: parts.join(' '), mi, last }
}

/** Schedule HC: health care information (lines 1–7); the penalty sections are left for the filer when they apply. File page 1 is the
 * "skip the remainder" panel, so it is not printed. */
export function scheduleMaHc(ret: TaxReturnInput, res: TaxReturnResult, ma: MaResult): FormFill {
  const d = ret.ma
  const joint = ret.filingStatus === 'mfj'
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const fagi = Math.round(res.f1040['11a'])
  const values: Record<string, FieldValue> = {
    "Taxpayer's First Name": upper(first), "Taxpayer's Middle Initial": mi, "Taxpayer's Last Name": upper(ret.taxpayer.lastName),
    "Taxpayer's Social Security Number": digits(ret.taxpayer.ssn),
    'Line 1a. Date of Birth': mmddyyyy(d.birthDate.taxpayer), 'Line 1b. Spouse’s date of birth': joint ? mmddyyyy(d.birthDate.spouse) : '',
    'line 1c. Family size. See instructions': String(ma.health.familySize),
    'Line 2. Federal adjusted gross income (required information; from U.S. Form 1040, line 11a). If married filing separately, see instructions': amt(fagi, true),
    'fill in box if line 2 is a loss': fagi < 0
  }
  const coverage = { full: 'Full-year MCC', part: 'Part-year MCC', none: 'No MCC/None' } as const
  const people: ['taxpayer' | 'spouse', string, string][] = [['taxpayer', '3a. Indicate the time period that you were enrolled in a Minimum Creditable Coverage (MCC) health insurance plan(s). See Form MA 1099-HC from your insurer or Schedule HC instructions', '']]
  if (joint) people.push(['spouse', '3b. Indicate the time period that your spouse was enrolled in a Minimum Creditable Coverage (MCC) health insurance plan(s). See Form MA 1099-HC from your insurer or Schedule HC instructions', 'Spouse '])
  for (const [o, line3, sp] of people) {
    const h = d.health[o]
    values[line3] = coverage[h.coverage]
    if (h.coverage === 'none') continue
    values[`4a. ${sp}Private insurance including ConnectorCare`] = h.plans.private
    values[`4b. ${sp}MassHealth. Fill in oval(s) and go to line 5`] = h.plans.masshealth
    values[`4c. ${sp}Medicare (including a replacement or supplemental plan). Fill in oval(s) and go to line 5`] = h.plans.medicare
    values[`4d. ${sp}U.S. military (including Veteran’s Administration and Tri-Care). Fill in oval(s) and go to line 5`] = h.plans.military
    values[`4e. ${sp}Other program. Enter program name(s) only in lines 4f and/or 4g below (see instructions)`] = h.plans.other
    if (h.plans.private || h.plans.other) {
      if (o === 'taxpayer') {
        values['4f line 1. Name of private insurance company, administrator or other government program (from box 1 of form ma 1099-hc)'] = upper(h.insurer).slice(0, 36)
        values['4f line 1a. Subscriber number (from form ma 1099-hc) note: if you were not issued form ma 1099-hc, enter the identification number from your health insurance card'] = h.subscriber.trim().slice(0, 17)
      } else {
        values['4g Line 1. Name of private insurance company, administrator or other government program for spouse (from box 1 of form ma 1099-hc)'] = upper(h.insurer).slice(0, 36)
        values['4g Line 1a. Subscriber number (from form ma 1099-hc) note: if you were not issued form ma 1099-hc, enter the identification number from your health insurance card'] = h.subscriber.trim().slice(0, 17)
      }
    }
  }
  const pages = [0]
  if (ma.health.askLine6) {
    pages.push(2)
    values['6 Was your income in 2025 at or below 150% of the federal poverty level?'] = ma.health.atOrBelowFpl ? 'Yes' : 'No'
    if (!ma.health.atOrBelowFpl) {
      for (const [o] of people) {
        const h = d.health[o]
        if (h.coverage !== 'part') continue
        MONTHS.forEach((m, i) => {
          const name = o === 'taxpayer' ? `Fill in if you had coverage for the month of ${m}` : `Fill in if your ${i < 2 ? 'spouse' : 'Spouse'} had coverage for the month of ${m}`
          values[name] = h.months[i] !== false
        })
      }
    }
  }
  const yn = (b: boolean): string => (b ? 'Yes' : 'No')
  const HC_RADIOS: Record<string, [string, string]> = {
    l8a: ['8a. Religious exemption. Are you claiming an exemption from the requirement to purchase health insurance based on your sincerely-held religious beliefs that cause you to object to substantially all forms of treatment covered by health insurance?', '8a. Religious exemption. Is your spouse claiming an exemption from the requirement to purchase health insurance based on your sincerely-held religious beliefs that cause you to object to substantially all forms of treatment covered by health insurance?'],
    l8b: ['8b. Received medical health care during the 2025 tax year?', '8b. Spouse Received medical health care during the 2025 tax year?'],
    l9: ['9 Have you obtained a Certificate of Exemption issued by the Massachusetts Health Connector for the 2025 tax year?', '9 Has your spouse obtained a Certificate of Exemption issued by the Massachusetts Health Connector for the 2025 tax year?'],
    l10: ['10 Did your employer offer affordable health insurance that met the minimum creditable coverage requirements as determined by completing the Schedule HC Worksheet for line 10?', "10 Did your spouse's employer offer affordable health insurance that met the minimum creditable coverage requirements as determined by completing the Schedule HC Worksheet for line 10?"],
    l11: ['11 Were you eligible for government-subsidized health insurance as determined by completing the Schedule HC Worksheet for Line 11?', '11 Was your spouse eligible for government-subsidized health insurance as determined by completing the Schedule HC Worksheet for Line 11?'],
    l12: ['12. Were you able to purchase affordable private health insurance that met the minimum creditable coverage requirements as determined by completing the Schedule HC Worksheet for line 12?', '12. Was your spouse able to purchase affordable private health insurance that met the minimum creditable coverage requirements as determined by completing the Schedule HC Worksheet for line 12?']
  }
  for (const [o, i] of [['taxpayer', 0], ['spouse', 1]] as const) {
    const x = ma.health.hc[o]
    if (!x) continue
    for (const k of ['l8a', 'l8b', 'l9', 'l10', 'l11', 'l12'] as const) { const b = x[k]; if (b !== null) values[HC_RADIOS[k][i]] = yn(b) }
    if (x.l9) values[i === 0 ? 'Section 9. Massachusetts certificate number' : "Section 9. Spouse's Massachusetts certificate number"] = d.hcPenalty[o].certificate.trim().slice(0, 12)
    if (x.worksheet && d.hcPenalty[o].appeal) { values[`${i === 0 ? 'I wish' : 'My spouse wishes'} to appeal the penalty. I authorize D O R to share this tax return including this schedule with the Massachusetts Health Connector for purposes of deciding this appeal`] = true; pages.push(3) }
    if (x.l10 !== null) pages.push(3)
  }
  if (ma.health.penaltyPossible.taxpayer || ma.health.penaltyPossible.spouse) pages.push(3)
  return { id: 'maschhc', file: 'maschhc.pdf', title: 'Massachusetts Schedule HC', values, pages: [...new Set(pages)].sort((a, b) => a - b) }
}

/** Schedule DI: dependent information. */
export function scheduleMaDi(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const values: Record<string, FieldValue> = { 'social security number': digits(ret.taxpayer.ssn) }
  const eicChildren = res.eic.qualifyingChildren
  let eicLeft = eicChildren
  ret.dependents.slice(0, 10).forEach((x, i) => {
    const n = i + 1
    const nm = splitName(x.name)
    values[`First Name #${n}`] = upper(nm.first)
    values[`Middle Initial #${n}`] = upper(nm.mi)
    values[`Last Name #${n}`] = upper(nm.last)
    values[`Social Security Number #${n}`] = digits(x.ssn)
    values[`relationship to taxpayer #${n}`] = upper(x.relationship)
    values[`date of birth #${n}`] = mmddyyyy(ret.ma.dependentBirthDates[x.id] ?? '')
    const eic = eicLeft > 0 && x.childRelationship && x.hasSsn && x.age < 19
    if (eic) eicLeft--
    values[`is dependent a qualifying child for earned income credit? #${n}`] = eic
  })
  return { id: 'maschdi', file: 'maschdi.pdf', title: 'Massachusetts Schedule DI', values }
}

/** Schedule B: interest, dividends and certain capital gains and losses. */
export function scheduleMaB(ret: TaxReturnInput, ma: MaResult): FormFill {
  const B = ma.scheduleB.lines
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const values: Record<string, FieldValue> = { 'First Name': upper(first), 'Middle Initial': mi, 'Last Name': upper(ret.taxpayer.lastName), 'Social Security Number': digits(ret.taxpayer.ssn) }
  const keep = new Set(['4', '7', '9', '29', '31', '33', '35', '37', '38'])
  for (const [k, v] of Object.entries(B)) values[`Line ${k}`] = amt(v, keep.has(k))
  for (const k of ['16', '19a', '19c', '21', '23', '40']) if ((B[k] ?? 0) < 0) values[`Line ${k} Checkbox`] = true
  const hasPart2 = (B['10'] ?? 0) !== 0 || (B['16'] ?? 0) !== 0 || (B['18'] ?? 0) !== 0
  if (!hasPart2) for (const k of Object.keys(B)) if (Number.parseInt(k, 10) >= 10 && Number.parseInt(k, 10) <= 28) delete values[`Line ${k}`]
  if (!hasPart2) delete values['Line 40']
  return { id: 'maschb', file: 'maschb.pdf', title: 'Massachusetts Schedule B', values }
}

const D_FIELDS: Record<string, string> = {
  '1': 'Line 1. Enter amounts from U.S. Schedule D, lines 8a and 8b, column h. See instructions',
  '6': 'Line 6. Enter amount from U.S. Schedule D, line 13, column h. If U.S. Schedule D not filed, enter he amount from U.S. Form 1040, line 7a. See instructions',
  '8': 'Line 8. Massachusetts carryover losses from prior years (from 2024 Schedule D, line 23)',
  '9': 'Line 9. Combine lines 1 through 8',
  '10c': 'Line 10c.  Combine lines 10a and 10b',
  '11': 'Line 11. Massachusetts capital gains and losses. Subtract line 10c from line 9. See instructions',
  '12': 'Line 12. Long-term gains on collectibles and pre-1996 installment sales. See instructions. Also enter amount in Schedule B, Part 2, line 11',
  '13': 'Line 13. Subtotal. Subtract line 12 from line 11. See instructions',
  '14': 'Line 14. Capital losses applied against capital gains. See instructions',
  '15': 'Line 15. Subtotal. If line 13 is greater than 0, subtract line 14 from line 13. If line 13 is less than 0, combine lines 13 and 14. If line 15 is a loss, see instructions',
  '16': 'Line 16. Long-term capital losses applied against interest and dividends (from worksheet). Not more than $2,000',
  '17': 'Line 17. Subtotal. Combine line 15 and line 16. See instructions',
  '19': 'Line 19. Subtotal. Subtract line 18 from line 17. Not less than 0',
  '20': 'Line 20. Excess exemptions (from worksheet), only if single, head of household or married filing jointly',
  '21': 'Line 21. Taxable long-term capital gains. Subtract line 20 from line 19. Not less than 0',
  '22': 'Line 22. Tax on long-term capital gains. Multiply line 21 by .05 and enter the result here and in Form 1, line 24 or Form 1-NR/PY, line 28. Note: If choosing the optional 5.85% tax rate, multiply line 21 by .0585',
  '23': 'line 23. Massachusetts available losses for carryover. Enter the amount from Schedule D, line 17, only if it is a loss'
}
const X_FIELDS: Record<string, string> = {
  '1': 'Line 1. Taxable alimony received (from U.S. return; full-and part-year residents only.) See instructions',
  '2': 'Line 2. Taxable IRA/Keogh and Roth IRA conversion distributions (from worksheet',
  '3': 'Line 3. Other gambling winnings (sources other than Massachusetts state lottery). Not less than 0. Note: Certain gambling losses are deductible under Massachusetts law. See Schedule Y, line 17. Do not report Massachusetts state lottery winnings here; instead, report them on Form 1, line 8b or Form 1-NR/PY, line 10b',
  '4': 'Line 4. Fees and other 5.0% income. See instructions. Not less than 0',
  '7': 'Line 7. Total other 5.0% income. Add lines 1 through 6. Not less than 0. Enter here and on Form 1,line 9 or Form 1-NR/PY, line 11'
}
const header = (ret: TaxReturnInput): Record<string, FieldValue> => {
  const [first, mi] = firstAndInitial(ret.taxpayer)
  return { 'First Name': upper(first), 'Middle Initial': mi, 'Last Name': upper(ret.taxpayer.lastName), 'Social Security Number': digits(ret.taxpayer.ssn) }
}

/** Schedule D: long-term capital gains and losses (excluding collectibles). */
export function scheduleMaD(ret: TaxReturnInput, ma: MaResult): FormFill {
  const D = ma.scheduleD.lines
  const values = header(ret)
  for (const [k, name] of Object.entries(D_FIELDS)) values[name] = amt(D[k], ['9', '11', '13', '17', '19', '21', '22'].includes(k))
  const lossBox: Record<string, string> = { '1': 'line 1. If A Loss, Mark An X In Box', '8': 'line 8. If A Loss, Mark An X In Box', '9': 'line 9. If A Loss, Mark An X In Box', '11': 'line 11. If A Loss, Mark An X In Box', '13': 'line 13. If A Loss, Mark An X In Box', '15': 'line 15. If A Loss, Mark An X In Box', '17': 'line 17. If A Loss, Mark An X In Box', '23': 'line 23. If A Loss, Mark An X In Box' }
  for (const [k, name] of Object.entries(lossBox)) values[name] = (D[k] ?? 0) < 0
  return { id: 'maschd', file: 'maschd.pdf', title: 'Massachusetts Schedule D', values }
}

/** Schedule X: other income. */
export function scheduleMaX(ret: TaxReturnInput, ma: MaResult): FormFill {
  const values = header(ret)
  for (const [k, name] of Object.entries(X_FIELDS)) values[name] = amt(ma.scheduleX[k], k === '7')
  return { id: 'maschx', file: 'maschx.pdf', title: 'Massachusetts Schedule X', values }
}

/** Schedule Y: other deductions. */
export function scheduleMaY(ret: TaxReturnInput, ma: MaResult): FormFill {
  const values = header(ret)
  for (const [k, v] of Object.entries(ma.scheduleY)) values[`Line ${k}`] = amt(v, k === '19')
  return { id: 'maschy', file: 'maschy.pdf', title: 'Massachusetts Schedule Y', values }
}

export function buildMaPacket(ret: TaxReturnInput, res: TaxReturnResult, ma: MaResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formMa1(ret, res, ma, preparer), scheduleMaHc(ret, res, ma)]
  if (ret.dependents.length > 0 || ma.lines['43'] > 0) forms.push(scheduleMaDi(ret, res))
  const B = ma.scheduleB.lines
  if (B['4'] - B['5'] > 0 || (B['10'] ?? 0) !== 0 || (B['16'] ?? 0) !== 0 || (B['18'] ?? 0) !== 0) forms.push(scheduleMaB(ret, ma))
  const D = ma.scheduleD.lines
  if (D['1'] !== 0 || D['6'] !== 0 || D['8'] !== 0) forms.push(scheduleMaD(ret, ma))
  if (ma.lines['9'] > 0) forms.push(scheduleMaX(ret, ma))
  if (ma.lines['15'] > 0) forms.push(scheduleMaY(ret, ma))
  const notIncluded = [...ma.attach]
  if (ma.health.hc.taxpayer?.worksheet || ma.health.hc.spouse?.worksheet) notIncluded.push('Keep the Schedule HC worksheets and the Health Care Penalty Worksheet with your records (they are not filed)')
  notIncluded.push('Signatures on page 1')
  forms.push(...dependentsStatement(ret, 10, 'Schedule DI (continued)', 'st-ma-deps'))
  return { forms, notIncluded }
}
