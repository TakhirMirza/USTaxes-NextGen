/**
 * Fills the official 2025 Nebraska Form 1040N (public/forms/2025/ne-1040n.pdf; the shared dependent name widgets were
 * split into first / last name fields) and Nebraska Schedule I (ne-1040n-schs.pdf, page 1) from a computed return.
 * Whole dollars.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { careQualifyingPerson } from '../engine/compute.ts'
import type { NeResult } from '../engine/ne2025.ts'
import { neCarePercent, neFederalCareDecimal } from '../engine/ne2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()

const ALWAYS = new Set(['5', '6', '10', '11', '14', '15', '17', '18', '34', '35', '53', '55', '57', '58'])
const LINES = ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '23', '34', '35', '36', '37', '40', '42', '44', '53', '55', '57', '58', '59', '60', '61', '62', '63']

export function formNe1040n(ret: TaxReturnInput, res: TaxReturnResult, ne: NeResult, preparer?: PreparerInfo | null): FormFill {
  const L = ne.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const v: Record<string, FieldValue> = {}
  const money = (name: string, n: number, always = false): void => {
    const x = Math.round(n)
    if (x === 0 && !always) return
    v[name] = x < 0 ? `-${-x}` : String(x)
  }
  v['Your First Name and Middle Initial'] = upper(ret.taxpayer.firstName)
  v['Last Name'] = upper(ret.taxpayer.lastName)
  if (joint) {
    v['If a Joint Return Spouses First Name and Middle Initial'] = upper(ret.spouse.firstName)
    v['Last Name_2'] = upper(ret.spouse.lastName)
  }
  v['Current Mailing Address Number and Street or PO Box'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['City'] = upper(c.city)
  v['State'] = upper(c.state).slice(0, 2)
  v['ZIP Code'] = digits(c.zip).slice(0, 10)
  const ssn = digits(ret.taxpayer.ssn)
  v['Your Social Security Number'] = ssn.slice(0, 3)
  v['Your Social Security Number1'] = ssn.slice(3, 5)
  v['Your Social Security Number2'] = ssn.slice(5, 9)
  if (joint) {
    const s = digits(ret.spouse.ssn)
    v['Spouses Social Security Number'] = s.slice(0, 3)
    v['Spouses Social Security Number1'] = s.slice(3, 5)
    v['Spouses Social Security Number2'] = s.slice(5, 9)
  }
  if (ret.ne.schoolDistrictCode.trim()) v['High School District Code'] = digits(ret.ne.schoolDistrictCode).slice(0, 7)
  v['Is the taxpayer claiming any benefits or tax credits from a business that is, or is owned in whole or part, by a foreign adversarial company? (See instructions)'] = ret.ne.foreignAdversarial ? 'yes' : 'no'
  if (ret.digitalAssets !== null) v['During 2025, did you receive, sell, exchange, gift, or otherwise dispose of a digital asset or a financial interest in a digital asset?'] = ret.digitalAssets ? '#0' : '#1'
  v[{ single: 'Single', mfj: 'Married, filing jointly', mfs: 'Married, filing separately', hoh: 'Head of Household', qss: 'Qualifying surviving spouse (QSS)' }[fs]] = '#0'
  if (fs === 'mfs') {
    v["Spouse's SSN"] = digits(ret.spouse.ssn)
    v['Full Name'] = upper(`${ret.spouse.firstName} ${ret.spouse.lastName}`)
  }
  if (ne.boxes.youOver65) v['2a_65 or older'] = '#0'
  if (ne.boxes.youBlind) v['2a_Blind'] = '#0'
  if (ne.boxes.spouseOver65) v['2a_Spouse_65 or older'] = '#0'
  if (ne.boxes.spouseBlind) v['2a_Spouse_Blind'] = '#0'
  if (ret.canBeClaimedAsDependent) v['2b_You'] = '#0'
  v['3_Resident'] = '#0'
  if (ne.exemptions.a) v['4a'] = '1'
  if (ne.exemptions.b) v['4b'] = '1'
  ret.dependents.slice(0, 3).forEach((x, i) => {
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    v[`Dependent First Name ${i + 1}`] = upper(parts.join(' '))
    v[`Dependent Last Name ${i + 1}`] = upper(last || ret.taxpayer.lastName)
    v[`Dependent SSN ${i + 1}`] = digits(x.ssn)
  })
  if (ne.exemptions.c) v['4c'] = String(ne.exemptions.c)
  v['4'] = String(L['4'])
  if (L['16c']) { v['16b'] = String(L['16b']); v['16c'] = String(L['16c']) }
  for (const k of LINES) money(k, L[k] ?? 0, ALWAYS.has(k))
  if (ne.federalTaxUsed) v['If entereing federal tax, check box'] = true
  if (L['44']) { v['97'] = String(ne.qualifyingChildren); v['98'] = String(L['98']) }
  if (L['63'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      v['64a'] = digits(dep.routingNumber).slice(0, 9)
      v['64b'] = dep.accountType === 'savings' ? '2' : '1'
      v['64c'] = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
    }
  }
  v['Daytime Phone'] = digits(c.phone).slice(-10)
  if (ret.usePaidPreparer && preparer) {
    v["Preparer's PTIN"] = preparer.ptin.toUpperCase()
    v["Print Firm's Name"] = upper([preparer.firmName || preparer.name, preparer.firmAddress].filter(Boolean).join(', '))
    v['EIN'] = digits(preparer.firmEin)
    v['Daytime Phone_2'] = digits(preparer.phone).slice(-10)
  }
  void res
  return { id: 'ne1040n', file: 'ne-1040n.pdf', title: 'Nebraska Form 1040N', values: v, pages: [0, 1, 2] }
}

export function formNeScheduleI(ret: TaxReturnInput, ne: NeResult): FormFill {
  const S = ne.scheduleI
  const v: Record<string, FieldValue> = {}
  const joint = ret.filingStatus === 'mfj'
  v['Name on Form 1040N'] = upper(joint ? `${ret.taxpayer.firstName} & ${ret.spouse.firstName} ${ret.taxpayer.lastName}` : `${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)
  v['SSN1'] = digits(ret.taxpayer.ssn).replace(/^(\d{3})(\d{2})(\d{4})$/, '$1-$2-$3')
  if (S['1']) { v['1 Interest income from all state and local obligations exempt from federal tax'] = 'OTHER STATES’ MUNICIPAL BONDS'; v['b Amount'] = String(S['1']) }
  if (S['15']) { v['a List type_2'] = 'U.S. TREASURY / SAVINGS BONDS'; v['b Amount_2'] = String(S['15']) }
  if (S['18']) { v['a List type_3'] = 'RRB-1099-R'; v['b Amount_3'] = String(S['18']) }
  for (const k of ['1', '3', '13', '14', '15', '17', '18', '20', '22', '31', '32', '38', '44']) {
    const n = S[k] ?? 0
    if (n || k === '13' || k === '44') v[k] = String(n)
  }
  return { id: 'neschi', file: 'ne-1040n-schs.pdf', title: 'Nebraska Schedule I', values: v, pages: [0] }
}

const neName = (ret: TaxReturnInput): string => upper(ret.filingStatus === 'mfj' ? `${ret.taxpayer.firstName} & ${ret.spouse.firstName} ${ret.taxpayer.lastName}` : `${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)
const ssnParts = (v: Record<string, FieldValue>, s: string, names: [string, string, string]): void => {
  const d = digits(s)
  if (d.length !== 9) return
  v[names[0]] = d.slice(0, 3); v[names[1]] = d.slice(3, 5); v[names[2]] = d.slice(5)
}

/** Schedule II (page 2 of the schedules file), full-year residents. */
export function formNeScheduleII(ret: TaxReturnInput, ne: NeResult): FormFill | null {
  const c = ne.sch2
  if (!c) return null
  const L = ne.lines
  const v: Record<string, FieldValue> = { 'Name on Form 1040N_schII': neName(ret), 'Name of state_schII': upper(ret.ne.otherState.state) }
  ssnParts(v, ret.taxpayer.ssn, ['Text1_schII', 'Text2_schII', 'Text3_schII'])
  v['1_2_schII'] = String(c['1'])
  v['2_2_schII'] = String(c['2'])
  v.Text4_schII = String(c['2'])
  v.Text5_schII = String(ne.lines['5'])
  v.Text6_schII = String(L['12'])
  v.Text7_schII = String(L['13'])
  v.Text8_schII = String(c['2'])
  v.Text9_schII = String(c['den'])
  const [whole, frac] = c['3'].toFixed(4).split('.')
  v['3_2a_schII'] = whole
  v['3_2b_schII'] = frac
  v['4_2_schII'] = String(c['4'])
  v['5_2_schII'] = String(c['5'])
  v['6_2_schII'] = String(c['6'])
  return { id: 'neschii', file: 'ne-1040n-schs.pdf', title: 'Nebraska Schedule II', values: v, pages: [1] }
}

/** Form 2441N, built from the federal Form 2441 (Part III line n is federal line n − 2). */
export function formNe2441n(ret: TaxReturnInput, res: TaxReturnResult, ne: NeResult): FormFill | null {
  const care = ne.care
  if (!care) return null
  const f = res.form2441
  const agi = ne.lines['5']
  const v: Record<string, FieldValue> = { 'Name on Form 1040N': neName(ret) }
  ssnParts(v, ret.taxpayer.ssn, ['Social', 'Security', 'Number'])
  ret.dependentCare.providers.slice(0, 3).forEach((p, i) => {
    const n = i + 1
    v[`A Care Providers Name 1Row${n}`] = upper(p.name)
    v[`B Address Number Street Apt No City State and ZIP CodeRow${2 * n - 1}`] = upper(p.address)
    v[`C Identifying Number SSN or EINRow${n}`] = p.tin.trim()
    v[`D Amount Paid See Federal Form 2441 instructionsRow${n}`] = String(Math.round(p.amountPaid))
  })
  const persons = ret.dependents.filter(careQualifyingPerson).slice(0, 3)
  const total = f.partIII ? f.partIII.line30 : Math.round(ret.dependentCare.expenses)
  const per = persons.length ? Math.floor(total / persons.length) : 0
  persons.forEach((x, i) => {
    const n = i + 1
    const parts = x.name.trim().split(/\s+/)
    v[`FirstRow${n}`] = upper(parts.slice(0, -1).join(' ') || parts[0] || '')
    v[`LastRow${n}`] = upper(parts.length > 1 ? parts[parts.length - 1] : '')
    ssnParts(v, x.ssn, [`Social ${n + 1}`, `Security ${n + 1}`, `Number ${n + 1}`])
    v[`C Qualified Expenses You Incurred and Paid in 2025 for the Person Listed in Column ARow${n}`] = String(i === 0 ? total - per * (persons.length - 1) : per)
  })
  v['3'] = String(f.line3); v['4'] = String(f.line4); v['5'] = String(f.line5); v['6'] = String(f.expensesUsed); v['7'] = String(agi)
  v['Qualified expense 8'] = neFederalCareDecimal(agi).toFixed(2).replace(/^0\./, '')
  v['Qualified expense 9'] = neCarePercent(agi) >= 1 ? '1.00' : neCarePercent(agi).toFixed(2).replace(/^0\./, '')
  v['10'] = String(care['10']); v['11'] = String(care['11'])
  const p = f.partIII
  if (p) {
    v['Name as Shown on Form 1040N'] = neName(ret)
    ssnParts(v, ret.taxpayer.ssn, ['Social 5', 'Security 5', 'Number 5'])
    const P3: [string, number][] = [
      ['14', p.line12], ['15', 0], ['16', 0], ['17', p.line12], ['18', p.line16], ['19', p.line17], ['20', p.line18], ['21', p.line19], ['22', p.line20],
      ['23', p.line21], ['24', 0], ['25', p.line12], ['Deductible benefits', 0], ['Excluded benefits', p.line25], ['28', p.line26], ['29', p.line27],
      ['30', p.line28], ['31', p.line29], ['32', p.line30], ['33', p.line31]
    ]
    for (const [k, n] of P3) v[k] = String(Math.round(n))
  }
  return { id: 'ne2441n', file: 'ne-2441n.pdf', title: 'Nebraska Form 2441N', values: v, pages: p ? [0, 1] : [0] }
}

export function buildNePacket(ret: TaxReturnInput, res: TaxReturnResult, ne: NeResult, preparer?: PreparerInfo | null): FormPacket {
  const forms = [formNe1040n(ret, res, ne, preparer)]
  if (ne.lines['12'] + ne.lines['13'] > 0) forms.push(formNeScheduleI(ret, ne))
  for (const x of [formNeScheduleII(ret, ne), formNe2441n(ret, res, ne)]) if (x) forms.push(x)
  forms.push(...dependentsStatement(ret, 3, 'Form 1040N, Dependents (continued)', 'st-ne-deps'))
  return { forms, notIncluded: ne.attach.filter((x) => x !== 'Nebraska Schedule I') }
}
