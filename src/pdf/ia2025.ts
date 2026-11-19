/**
 * Fills the official 2025 Iowa IA 1040 (public/forms/2025/ia-1040.pdf: the Iowa Department of Revenue’s fillable
 * IA 1040 with Schedule 1, six pages) from a computed return. Schedule 1 (page 5) is kept only when it has entries.
 * Whole dollars with “00” cents.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { IaResult } from '../engine/ia2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const date8 = (s: string): string => {
  const m = s.trim().match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/)
  return m ? `${m[1].padStart(2, '0')}${m[2].padStart(2, '0')}${m[3]}` : digits(s).slice(0, 8)
}

/** Money field names (dollars; the cents field is the same name with “ (cents)”). */
const F: Record<string, string> = {
  IIIa: 'III a Personal Credit', IIIb: 'b Amount for IIIb', IIIc: 'IIIc Dependends - Amount', IIId: 'IIIc Total. Add lines a, b, and c',
  '1a': '1a Federal total income from federal 1040, line 9', '1b': '1b Federal adjustments to income from federal 1040, line 10',
  '1c': '1c Federal adjusted gross income from federal 1040, line 11', '1d': '1d Standard deduction or itemized deductions from federal 1040, line 12',
  '1e': '1e Qualified business income deduction from federal 1040, line 13', '1f': '1f Enhanced Deduction for Seniors from federal Schedule 1-A, line 37',
  '2': '2 Federal taxable income', '3': '3 Net Iowa modifications from IA 1040 Schedule 1, line 22', '4': '4 Iowa taxable income. Add lines 2 and 3',
  '5': '5 Iowa Tax from tables or alternate tax', '6': '6 Iowa lump-sum tax', '7': '7 Total Tax. Add lines 5 and 6', '8': '8 Total exemption credit amount from Step 3',
  '9': '9 Tuition and textbook credit for dependents K-12', '10': '10 Volunteer firefighter/EMS/reserve peace officer credit', '11': '11 Total Credits. Add lines 8, 9, and 10',
  '12': '12 BALANCE. Subtract line 11 from line 7', '13': '13 Nonresident or part-year resident credit', '14': '14 BALANCE. Subtract line 13 from line 12',
  '15': '15 Out-of-State tax credit', '16': '16 BALANCE. Subtract line 15 from line 14', '17': '17 Other nonrefundable Iowa credits', '18': '18 BALANCE. Subtract line 17 from line 16',
  '19': '19 School district surtax or EMS surtax', '20': '20 Total state and local tax. Add lines 18 and 19', '21fish': '21 Contributions - Fish/wildlife',
  '21child': '21 Contributions - Child Abuse', '21': '21 Enter total here', '22': '22 Total contributions. Add lines 20 and 21', '23': '23 Iowa Fuel Tax Credit', '24': '24 Amount',
  '25': '25 Iowa Earned Income Tax Credit', '26': '26 Other refundable credits', '27': '27 Composite tax credit', '28': '28 Iowa income tax withheld',
  '29': '29 Estimated and voucher payments', '30': '30 TOTAL. Add lines 23 through 29', '31a': '31a If line 30 is more than line 22, subtract line 22 from line 30',
  '31b': '31b AMENDED RETURN ONLY. Previous refunds', '32': '32 Amount of line 31 to be REFUNDED', '33': '33 Amount of line 31 to be applied to your estimated tax',
  '34': '34 If line 30 is less than line 22, subtract line 30 from line 22', '35': '35 Penalty for underpayment of estimated tax', '36': '36 Penalty and Interest TOTAL',
  '37': '37 TOTAL AMOUNT DUE. ADD lines 34, 35 and 36'
}
const SCH: Record<string, string> = {
  '1A': '1A Interest', '1B': '1B Interest', '2A': '2A Dividends', '2B': '2B Dividends', '4B': '4B Military retirement income', '5B': '5B Social Security Benefits',
  '6B': '6B Active Duty Military Pay', '7B': '7 IRA/Pension/Railroad Retirement Income', '11A': '11A Other Income', '11B': '11B Other Income',
  '12A': '12A Total modifications to federal total income. Add lines 1 through 11', '12B': '12B Total modifications to federal total income. Add lines 1 through 11',
  '13': '13 Net modifications to federal total income.Subtract line 12 column B from A', '14': '14 Education Savings Plans', '15': '15 Health Insurance Deduction for taxpayers over 65',
  '16': '16 Capital Gains Deduction', '19': '19B Other Adjustments', '20': '20B Total modifications to federal taxable income. Add lines 14 through 19',
  '21': '21 Net modifications to federal taxable income. Subtract line 20 column B from A'
}
/** Lines printed even when zero. */
const ALWAYS = new Set(['IIId', '2', '3', '4', '5', '7', '8', '11', '12', '14', '16', '18', '20', '22', '30'])

export function formIa1040(ret: TaxReturnInput, res: TaxReturnResult, ia: IaResult, preparer?: PreparerInfo | null): FormFill {
  const L = ia.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const d = ret.ia
  const v: Record<string, FieldValue> = {}
  const money = (name: string, n: number, always = false): void => {
    const x = Math.round(n)
    if (x === 0 && !always) return
    v[name] = x < 0 ? `-${-x}` : String(x)
    v[`${name} (cents)`] = '00'
  }
  const sch = Object.values(ia.schedule1.A).some((x) => x) || Object.values(ia.schedule1.B).some((x) => x) || Object.values(ia.schedule1.lines).some((x) => x)
  const pages = sch ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 5]

  // ── Step 1 ──
  v['Last Name'] = upper(ret.taxpayer.lastName)
  v['First Name'] = upper(ret.taxpayer.firstName)
  v['Social Security Number (SSN)'] = digits(ret.taxpayer.ssn)
  if (joint || fs === 'mfs') {
    v["Spouse's Last Name"] = upper(ret.spouse.lastName)
    v["Spouse's First Name"] = upper(ret.spouse.firstName)
    v["Spouse's Social Security Number (SSN)"] = digits(ret.spouse.ssn)
  }
  v['Current mailing address'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['City'] = upper(c.city)
  v['State'] = upper(c.state).slice(0, 2)
  v['ZIP'] = digits(c.zip).slice(0, 5)
  if (d.countyNo.trim()) v['County No'] = digits(d.countyNo).slice(0, 2)
  if (d.schoolDistrictNo.trim()) v['School District Number'] = digits(d.schoolDistrictNo).slice(0, 4)
  if (d.birthDate.taxpayer.trim()) v['Date of Birth MMDDYYYY'] = date8(d.birthDate.taxpayer)
  if (joint && d.birthDate.spouse.trim()) v['Spouse Date of Birth MMDDYYYY'] = date8(d.birthDate.spouse)
  // ── Step 2 ──
  v['Filing Status'] = { single: 'Single', mfj: 'Married Joint', mfs: 'Married Sep', hoh: 'Head', qss: 'Widow' }[fs]
  if (fs === 'single') v["Single - Claimed on another person's return?"] = ret.canBeClaimedAsDependent ? 'Yes' : 'No'
  // ── Step 3 ──
  v['a Personal Credit. Enter 1 (enter 2 if filing status 2 or 4)'] = String(ia.step3.a)
  money(F.IIIa, L.IIIa, true)
  if (ia.step3.b) { v['b Enter 1 for each taxpayer 65 or older and/or 1 for each taxpayer who is blind'] = String(ia.step3.b); money(F.IIIb, L.IIIb) }
  const p = (o: 'taxpayer' | 'spouse') => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  if (p('taxpayer').age >= 65 || p('taxpayer').age65OrOlder) v['Check if - over 65'] = true
  if (p('taxpayer').blind) v['Check if - blind'] = true
  if (joint && (p('spouse').age >= 65 || p('spouse').age65OrOlder)) v['Check if - spouse over 65'] = true
  if (joint && p('spouse').blind) v['Check if - Spouse is blind'] = true
  if (ia.step3.c) { v['IIIc Dependends'] = String(ia.step3.c); money(F.IIIc, L.IIIc) }
  money(F.IIId, L.IIId, true)

  // ── Page 2: dependents, Step 4, Step 5 ──
  v['Taxpayers Name'] = upper(`${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)
  ret.dependents.slice(0, 4).forEach((x, i) => {
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    v[`${i + 1} Dependents first name`] = upper(parts.join(' '))
    v[`${i + 1} Dependents last name`] = upper(last || ret.taxpayer.lastName)
    v[`${i + 1} Dependents SSN`] = digits(x.ssn)
    v[`${i + 1} Relationship`] = upper(x.relationship)
  })
  if (ret.dependents.length > 4) v['If more than four dependents, check the box'] = true
  for (const k of ['1a', '1b', '1c', '1d', '1e', '1f', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']) money(F[k], L[k], ALWAYS.has(k))
  if (ia.alternateTax || ia.taxReduction || ia.lowIncomeExempt) v['Check if using alternate tax (line 5), tax reduction calculation (line 12), or low-income exemption'] = true

  // ── Page 3 ──
  for (const k of ['16', '17', '18', '19', '20', '21fish', '21child', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31a', '32', '33']) money(F[k], L[k], ALWAYS.has(k))
  if (ia.careCredit) v['24 Check one'] = ia.careCredit === 'care' ? 'child and dep' : 'early'
  if (L['32'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      v['32a Routing number'] = digits(dep.routingNumber).slice(0, 9)
      v['32b Accounting number'] = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
      v['32c Savings or Checking'] = dep.accountType === 'savings' ? 'Savings' : 'Checking'
    }
  }
  // ── Page 4 ──
  for (const k of ['34', '35', '36', '37']) money(F[k], L[k], k === '37' && L['34'] > 0)

  // ── Page 5: Schedule 1 ──
  if (sch) {
    const { A, B, lines: S } = ia.schedule1
    for (const [k, n] of Object.entries(A)) if (SCH[`${k}A`]) money(SCH[`${k}A`], n)
    for (const [k, n] of Object.entries(B)) if (SCH[`${k}B`]) money(SCH[`${k}B`], n)
    if (A['11']) v['11 Other Income - Code'] = ret.ia.otherAddition.code.trim()
    else if (B['11']) v['11 Other Income - Code'] = ret.ia.otherSubtraction.code.trim()
    money(SCH['12A'], A['12'], true)
    money(SCH['12B'], B['12'], true)
    money(SCH['13'], S['13'], true)
    for (const k of ['14', '15', '16', '19']) money(SCH[k], S[k])
    if (S['19']) v['19 Other Adjustments - Code'] = ret.ia.otherAdjustment.code.trim()
    money(SCH['20'], S['20'], true)
    money(SCH['21'], S['21'], true)
  }

  // ── Page 6: contact, preparer ──
  v['Taxpayers phone number'] = digits(c.phone).slice(-10)
  if (d.license.taxpayer.trim()) v['Drivers license or ID Number'] = upper(d.license.taxpayer)
  if (joint && d.license.spouse.trim()) v['Spouse Drivers license or ID Number'] = upper(d.license.spouse)
  if (ret.usePaidPreparer && preparer) {
    v["Preparer's ID"] = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9)
    v['Firms Federal Employer Identification Number (FEIN)'] = digits(preparer.firmEin).slice(0, 9)
    v['Preparers phone number'] = digits(preparer.phone).slice(-10)
  }
  void res
  return { id: 'ia1040', file: 'ia-1040.pdf', title: 'Iowa IA 1040', values: v, pages }
}

export function buildIaPacket(ret: TaxReturnInput, res: TaxReturnResult, ia: IaResult, preparer?: PreparerInfo | null): FormPacket {
  const notIncluded = [...ia.attach]
  if (ret.filingStatus === 'mfs') notIncluded.push('Step 2: your spouse’s Iowa taxable income')
  return { forms: [formIa1040(ret, res, ia, preparer)], notIncluded }
}
