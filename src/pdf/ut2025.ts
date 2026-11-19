/**
 * Fills the official 2025 Utah TC-40 (public/forms/2025/ut-tc40.pdf: TC-40 pages 1–3, TC-40A, TC-40B, TC-40S and
 * TC-40W from the Utah State Tax Commission’s TC-40 file) from a computed return. Only the pages that are used are
 * kept. Whole dollars.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { UtResult } from '../engine/ut2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const money = (n: number | undefined): string => {
  const v = Math.round(n ?? 0)
  return v === 0 ? '' : String(v)
}
const keep0 = (n: number | undefined): string => String(Math.round(n ?? 0))
const WORDS = ['One', 'Two', 'Three', 'Four']

export function formUtTc40(ret: TaxReturnInput, res: TaxReturnResult, ut: UtResult, preparer?: PreparerInfo | null): FormFill {
  const L = ut.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const v: Record<string, FieldValue> = {}
  const pages = [0, 1]

  // ── Page 1 ──
  v['40 Your SSN'] = digits(ret.taxpayer.ssn)
  v['40 Your first name'] = upper(ret.taxpayer.firstName)
  v['40 Your last name'] = upper(ret.taxpayer.lastName)
  v['40 Residency 1'] = 'Y'
  if (joint || fs === 'mfs') {
    v['40 Spouse SSN'] = digits(ret.spouse.ssn)
    v['40 Spouse first name'] = upper(ret.spouse.firstName)
    v['40 Spouse last name'] = upper(ret.spouse.lastName)
    if (joint) v['40 Residency 2'] = 'Y'
  }
  v['40 Address 1'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['40 Telephone number'] = digits(c.phone).slice(-10)
  v['40 City'] = upper(c.city)
  v['40 State'] = upper(c.state).slice(0, 2)
  v['40 Zip code'] = digits(c.zip).slice(0, 9)
  v['40 Filing status'] = { single: '1', mfj: '2', mfs: '3', hoh: '4', qss: '5' }[fs]
  v['40 Exemption a'] = String(ut.dependents.a)
  v['40 Exemption b'] = String(ut.dependents.b)
  v['40 Exemption total c'] = String(ut.dependents.c)
  v['40 Exemption total d'] = String(ut.dependents.d)
  v['40 election you'] = 'N'
  if (joint) v['40 election spouse'] = 'N'
  for (const k of ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '22']) {
    v[`40 Line ${k}`] = ['4', '6', '9', '10', '13', '15', '16', '17', '22'].includes(k) ? keep0(L[k]) : money(L[k])
  }
  if (ut.exempt) v['40 Line 21 Check box'] = true
  // ── Page 2 ──
  for (const k of ['23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43']) {
    v[`40 Line ${k}`] = ['23', '25', '27', '32', '38'].includes(k) ? keep0(L[k]) : money(L[k])
  }
  if (L['44'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      v['40 Line 45 routing'] = digits(dep.routingNumber).slice(0, 9)
      v['40 Line 45 Account number'] = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
      v[dep.accountType === 'savings' ? '40 Line 45 Savings' : '40 Line 45 Checking'] = true
    }
  }
  if (ret.usePaidPreparer && preparer) {
    v['40 Preparer phone'] = digits(preparer.phone).slice(-10)
    v['40 Preparer SSN PTIN'] = preparer.ptin.toUpperCase()
    v['40 Preparer EIN'] = digits(preparer.firmEin)
    v['40 Firm name and address'] = upper([preparer.firmName || preparer.name, preparer.firmAddress].filter(Boolean).join(', '))
  }

  // ── TC-40A ──
  if (L['5'] + L['8'] + L['24'] + L['26'] > 0) {
    pages.push(3)
    v['40A Your SSN'] = digits(ret.taxpayer.ssn)
    v['40A Your last name'] = upper(ret.taxpayer.lastName)
    ut.additions.slice(0, 5).forEach((x, i) => {
      if (i === 0) v['40A Part 1 Line 1 amount'] = String(x.amount)
      else { v[`40A Part 1 Line ${i + 1} Code`] = x.code; v[`40A Part 1 Line ${i + 1} amount`] = String(x.amount) }
    })
    if (ut.additions.length) v['40A Part 1 Line 6 amount'] = keep0(L['5'])
    ut.subtractions.slice(0, 5).forEach((x, i) => { v[`40A Part 2 Line ${i + 1} code`] = x.code; v[`40A Part 2 Line ${i + 1} amount`] = String(x.amount) })
    if (ut.subtractions.length) v['40A Part 2 Line 6 amount'] = keep0(L['8'])
    ut.apportionable.slice(0, 5).forEach((x, i) => { v[`40A Part 3 Line ${i + 1} code`] = x.code; v[`40A Part 3 Line ${i + 1} amount`] = String(x.amount) })
    if (ut.apportionable.length) v['40A Part 3 Line 6 amount'] = keep0(L['24'])
    ut.nonapportionable.slice(0, 5).forEach((x, i) => { v[`40A Part 4 Line ${i + 1} code`] = x.code; v[`40A Part 4 Line ${i + 1} amount`] = String(x.amount) })
    if (ut.nonapportionable.length) v['40A Part 4 Line 6 amount'] = keep0(L['26'])
  }

  // ── TC-40W ──
  if (L['33'] > 0) {
    pages.push(7)
    v['40W Your SSN'] = digits(ret.taxpayer.ssn)
    v['40W Your last name'] = upper(ret.taxpayer.lastName)
    ut.statements.slice(0, 4).forEach((x, i) => {
      const w = WORDS[i]
      v[`40W ${w} Employer ID Line 1`] = digits(x.ein)
      v[`40W ${w} UT withhold ID Line 2`] = upper(x.stateId)
      v[`40W ${w} Employer name and address Line 3-1`] = upper(x.employer)
      v[`40W ${w} Employee SSN line 5`] = digits(x.ssn)
      v[`40W ${w} line 6`] = String(x.wages)
      v[`40W ${w} line 7`] = String(x.tax)
    })
    v['40W Total UT withheld'] = keep0(L['33'])
  }
  void res
  return { id: 'uttc40', file: 'ut-tc40.pdf', title: 'Utah TC-40', values: v, pages }
}

export function buildUtPacket(ret: TaxReturnInput, res: TaxReturnResult, ut: UtResult, preparer?: PreparerInfo | null): FormPacket {
  const notIncluded = [...ut.attach]
  if (ut.apportionable.some((x) => x.code === '18')) notIncluded.push('TC-40A Part 3: write your (and your spouse’s) birthdate next to the retirement credit (code 18)')
  if (ut.lines['33'] > 0 && ret.ut.withholding1099 > 0) notIncluded.push('TC-40W: add the 1099s with Utah withholding (W-2 rows are filled in)')
  return { forms: [formUtTc40(ret, res, ut, preparer)], notIncluded }
}
