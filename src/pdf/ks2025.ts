/**
 * Fills the official 2025 Kansas K-40 (public/forms/2025/ks-k40.pdf) and Schedule S Part A (ks-schs.pdf) from a
 * computed return. Whole dollars; negative amounts are entered without a sign and the minus box is marked.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { KsResult } from '../engine/ks2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const ssn = (v: string): string => { const x = digits(v); return x.length === 9 ? `${x.slice(0, 3)}-${x.slice(3, 5)}-${x.slice(5)}` : x }
const four = (s: string): string => upper(s).replace(/[^A-Z]/g, '').slice(0, 4)
const whole = (n: number): string => String(Math.abs(Math.round(n)))

const K: Record<string, string> = {
  '1': '1 federal adjusted gross income, as reported on your federal income tax return', '2': '2 modifications, from Sch S line a27, enclose sch s',
  '3': '3 kansas adjusted gross income, line 2 added or subtracted from line 1', '4': '4 standard deduction or itemized deductions', '5': '5 exemption allowance, x number of exemptions claimed',
  '6': '6 total dudecutions, add lines 4 and 5', '7': '7 taxable income, subtract line6 from line 3; if less than zero enter 0', '8': '8 tax, use tax tables ot tax computation schedule',
  '11': '11 kansas tax on lump sum distributions, residents only', '12': '12 total income tax, residnets add lines 8 and 11; nonresidents enter amount form line 10',
  '13': '13 credit for taxes paid to other states - enclose return(s) from other states', '14': '14 credit for child and dependent care expenses', '15': '15 other credits',
  '16': '16 subtotal, subtract lines 13, 14 and 15 from line 12', '17': '17 earned income tax credit', '18': '18 total tax balance, subtract lines 17 from line 16; Cannot be less than zero',
  '19': '19 kansas income tax withheld from w2 and or 1099s', '20': '20 estimated tax paid', '21': '21 amount paid with kansas extension', '22': '22 refundable portion of earned income tax credit',
  '23': '23 refundable portion of tax credits', '27': '27 total refundable credits, add lines 19 - 25 and subtract line 26', '28': '28 underpayment, if line 18 is greater than line 27 enter the difference here',
  '32': '32 amount you owe, add lines 28 - 31 and any entries on lines 35 - 42', '33': '33 overpayment, if line 18 is less than 27 enter differnce here',
  '34': '34 credit forward, enter amount you wish to be applied to your 2026 estimated tax', '35': '35 chickadee checkoff', '36': '36 senior citizens meals on wheels contribution program',
  '37': '37 breast cancer research fund', '38': '38 military emergency relief fund', '39': '39 kansas hometown heros fund', '40': '40 kansas creative arts industry fund',
  '41': '41 local school district contribution fund', '42': '42 Kansas Histric Site Contribution Fund', '43': '43 refund, subtract lines 34 - 42 from line 33'
}
const ALWAYS = new Set(['1', '3', '4', '5', '6', '7', '8', '12', '16', '18', '27'])
const SCH: Record<string, string> = {
  A1: 'line a1 state and municipal bond interest', A2: 'line a2 contributions to all kpers', A8: 'line a8 other additions to federal adjustment gross income',
  A9: 'line a9 total additions to federal adjustment gross income - add lines a1 thru a8', A10: 'line a10 social security benefits', A12: 'line a12 interest on us gov obligations',
  A13: 'line a13 state or local income tax refund', A14: 'line a14 retirement benefits', A16: 'line a16 contributions to learning quest', A21: 'line a21 contributions to able savings account',
  A25: 'line a25 other subtractions from fagi', A26: 'line a26 total subtractions from fagi - add lines a10 thru a25',
  A27: 'line a27 net modifications to fagi - subtract line a26 from line a9. enter total here and on line 2 of Form K-40. If negative click on minus box'
}

function names(ret: TaxReturnInput, v: Record<string, FieldValue>, both: boolean): void {
  v['your first name'] = upper(ret.taxpayer.firstName)
  v['your last name'] = upper(ret.taxpayer.lastName)
  if (both) {
    v['spouses first name'] = upper(ret.spouse.firstName)
    v['spouses last name'] = upper(ret.spouse.lastName)
  }
}

export function formKsK40(ret: TaxReturnInput, res: TaxReturnResult, ks: KsResult, preparer?: PreparerInfo | null): FormFill {
  const L = ks.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const both = joint || fs === 'mfs'
  const d = ret.ks
  const v: Record<string, FieldValue> = {}
  names(ret, v, both)
  v['enter the first four letters of your last name - all CAPS'] = four(ret.taxpayer.lastName)
  v['your social security number'] = ssn(ret.taxpayer.ssn)
  if (both) {
    v['enter the first four letters of your spouses last name - all CAPS'] = four(ret.spouse.lastName)
    v['your spouses social security number'] = ssn(ret.spouse.ssn)
  }
  v['mailing address'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['city town or post office'] = upper(c.city)
  v['state - abbreviation'] = upper(c.state).slice(0, 2)
  v['zip code - 5 digit'] = digits(c.zip).slice(0, 5)
  if (d.schoolDistrict.trim()) v['school district number'] = digits(d.schoolDistrict).slice(0, 3)
  if (d.county.trim()) v['county - abbreviation'] = upper(d.county).slice(0, 2)
  v['daytime telephone number'] = digits(c.phone).slice(-10)
  v[{ single: 'filing status - single', mfj: 'filing status - married filing joint', mfs: 'filing status - married filing separate', hoh: 'filing status - head of household', qss: 'filing status - married filing joint' }[fs]] = true
  v['residency status - resident'] = true
  if (joint) {
    v['Check Box - Married individuals filing a joint return, check the box to the left, enter 2 in the box to the right and enter $18,320 in the currency box'] = true
    v['Enter "2" in this box - Only if Married filing Joint'] = '2'
    v['Enter $18,320 - Only if Married Filing Joint Return'] = '18320'
  } else {
    v['Check Box - Married individuals filing a seperate return, individuals with a filing status of Single or Head of Household, check the box to the left, enter "1" in the box to the right and $9,160 in the currency box'] = true
    v['Enter "1" in this box - Only if married filing seperate, filing status of single, or Heads of Household'] = '1'
    v['Enter $9,160 - Only if married filing seperate, filing status of single, or Heads of Household'] = '9160'
  }
  if (ks.exemptions.hoh) v['If filing status is Head of Household, enter $2,320. If not - leave blank'] = '2320'
  const ex = ks.exemptions
  let count = ex.count + (ex.hoh ? 1 : 0)
  if (ex.dependents) {
    v['Dependents, enter the number of individuals you may claim as a dependent in the first box, multiply by $2,320 and enter total in the currency box to the right'] = String(ex.dependents / 2320)
    v['multiply number of dependents by $2,320 and enter total here'] = String(ex.dependents)
    count += ex.dependents / 2320
  }
  if (ex.newborns) {
    v['Enter the number of children you may claim as a dependent who were born in this tax year'] = String(ex.newborns / 2320)
    v['multiply number of exemptions by $2,320 and enter total here_1'] = String(ex.newborns)
    count += ex.newborns / 2320
  }
  if (ex.veterans) {
    v['If claiming the Disabled Veteran Personal Exemption Allowance, in the first box enter the total number of disabled veterand being claimed including yourself. Multiply by $2,250 and enter total in the currency box to the right'] = String(ex.veterans / 2320)
    v['Multiply number of disabled veterans being claimed by $2,250 and enter result here'] = String(ex.veterans)
    count += ex.veterans / 2320
  }
  v['total kansas exemptions'] = String(count)
  v['Total Kansas Exemption Amount. Add all amounts and enter result here'] = String(L['5'])
  ret.dependents.slice(0, 6).forEach((x, i) => {
    const s = i === 0 ? '' : `_${i}`
    v[`enter requested information for all persons claimed as a dependent - name${s}`] = upper(x.name)
    v[`enter requested information for all persons claimed as a dependent - relationship${s}`] = upper(x.relationship)
    v[`enter requested information for all persons claimed as a dependent - social security number${s}`] = ssn(x.ssn)
  })

  // ── Page 2 ──
  for (const [k, name] of Object.entries(K)) {
    const n = L[k] ?? 0
    if (n !== 0 || ALWAYS.has(k)) v[name] = whole(n)
  }
  for (const k of ['1', '2', '3']) if ((L[k] ?? 0) < 0) v[`${k} if a negative check this field`] = true
  if (L['2'] === 0) delete v[K['2']]
  if (L['41'] > 0 && d.schoolDistrict.trim()) v['41 school district number'] = digits(d.schoolDistrict).slice(0, 3)
  v['9 nonresident percentage, from sch s line b23 or if 100% enter 100.0000'] = '100.0000'
  if (ret.usePaidPreparer && preparer) {
    v['i authorize the director of taxation or the directors designee to discuss my return and enclosures with my preparer'] = true
    v['preparers phone number'] = digits(preparer.phone).slice(-10)
    v['preparers PTIN, ein or ssn'] = preparer.ptin.toUpperCase()
  }
  void res
  return { id: 'ksk40', file: 'ks-k40.pdf', title: 'Kansas K-40', values: v, pages: [0, 1] }
}

export function formKsSchS(ret: TaxReturnInput, ks: KsResult): FormFill {
  const S = ks.scheduleS
  const both = ret.filingStatus === 'mfj' || ret.filingStatus === 'mfs'
  const v: Record<string, FieldValue> = {}
  names(ret, v, both)
  v['first four letters of your last name'] = four(ret.taxpayer.lastName)
  v['your social security number'] = ssn(ret.taxpayer.ssn)
  if (both) {
    v['spouses first four letters of last name'] = four(ret.spouse.lastName)
    v['spouses social security number'] = ssn(ret.spouse.ssn)
  }
  for (const [k, name] of Object.entries(SCH)) if (S[k] || ['A9', 'A26', 'A27'].includes(k)) v[name] = whole(S[k] ?? 0)
  if (S['A27'] < 0) v['line a25 net modification - negative'] = true
  return { id: 'ksschs', file: 'ks-schs.pdf', title: 'Kansas Schedule S', values: v, pages: [0] }
}

const KSA: Record<string, string> = {
  '1': '1. Medical and dental expenses see instructions', '2': '2. Enter your adjusted gross income amount from Form 1040 or 1040SR line 11', '3': '3. Multiply line 2 by 75 0075',
  '4': '4. Total medical and dental expenses allowed - subtract line 3 form line 1. If line 3 is more than line 1, enter zero',
  '5': '5. State and local real estate taxes see instructions', '6': '6. State and local personal property taxes', '7': '7. Total taxes you paid add lines 5 and 6',
  '8a': '8a Home mortgage interest and points reported to you on Form 1098', '8b': '8b Home mortgage interest NOT reported to you on Form 1098', '8c': '8c Points not reported to you on Form 1098',
  '9': '9 Total interest you paid - add lines 8a through 8d', '10': '10 Gifts by cash or check', '11': '11 Gifts made other than by cash or check', '12': '12 Carryover from prior year',
  '13': '13 Total gifts to charity - add lines 10 through 12', '14': '14 Total Kansas itemized deductions - add lines 4, 7, 9, and 13'
}
export function formKsSchA(ret: TaxReturnInput, ks: KsResult): FormFill | null {
  if (!ks.itemize) return null
  const A = ks.schA
  const t = ret.taxpayer
  const s = ret.spouse
  const v: Record<string, FieldValue> = {
    'Your First Name': upper(t.firstName), 'Last Name': upper(t.lastName), 'Enter the first four letters of your last name': four(t.lastName), 'Your Security number': ssn(t.ssn)
  }
  if (ret.filingStatus === 'mfj') {
    v['Spouse First Name'] = upper(s.firstName); v['Spouse Last Name'] = upper(s.lastName)
    v['Enter the first four letters of your spouses'] = four(s.lastName); v['Spouse Security number'] = ssn(s.ssn)
  }
  if (ks.itemizedFederally) v['Check this box if you claimed itemized deductions on your federal return'] = true
  if (ret.ks.schA.mixedUseMortgage) v["Check this box if you didn't use all of your home mortgage loan(s) to buy, buold, or improve your home"] = true
  for (const [k, name] of Object.entries(KSA)) if (A[k] || ['4', '7', '9', '13', '14'].includes(k)) v[name] = whole(A[k])
  if (A['8b'] > 0 && ret.ks.schA.individualInfo.trim()) {
    const info = upper(ret.ks.schA.individualInfo)
    v['identifying number and address'] = info.slice(0, 45)
    if (info.length > 45) v['identifying number and address, contd'] = info.slice(45, 120)
  }
  return { id: 'ksscha', file: 'ks-scha.pdf', title: 'Kansas Schedule A', values: v }
}

export function buildKsPacket(ret: TaxReturnInput, res: TaxReturnResult, ks: KsResult, preparer?: PreparerInfo | null): FormPacket {
  const forms = [formKsK40(ret, res, ks, preparer)]
  if (ks.scheduleS['A9'] + ks.scheduleS['A26'] > 0) forms.push(formKsSchS(ret, ks))
  const sa = formKsSchA(ret, ks)
  if (sa) forms.push(sa)
  const notIncluded = [...ks.attach.filter((x) => !x.startsWith('Schedule S'))]
  notIncluded.push('Dependents’ dates of birth on the K-40 front (MMDDYYYY)')
  forms.push(...dependentsStatement(ret, 6, 'K-40, Dependents (continued)', 'st-ks-deps'))
  return { forms, notIncluded }
}
