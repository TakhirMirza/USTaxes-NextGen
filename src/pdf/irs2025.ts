/**
 * Maps a computed 2025 return onto the official IRS fillable PDFs (public/forms/2025).
 *
 * Field keys are suffixes of the fully-qualified AcroForm names (for example "f1_47[0]" or
 * "Row7[0].Dependent1[0].c1_28[0]"). Each key must match exactly one field; the tests in
 * irs2025.test.ts load the real PDFs and enforce that.
 */
import type { Owner, Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { careQualifyingPerson, ctcChild, eicChild } from '../engine/compute.ts'
import * as R from '../engine/rules2025.ts'

export type FieldValue = string | boolean
export interface FormFill {
  id: string
  file: string
  title: string
  values: Record<string, FieldValue>
  /** Zero-based pages to include; all pages when omitted. */
  pages?: number[]
}
export interface FormPacket {
  forms: FormFill[]
  /** Forms the return needs that this app cannot print yet. */
  notIncluded: string[]
}

const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0 && !keepZero) return ''
  return v < 0 ? `-${Math.abs(v).toLocaleString('en-US')}` : v.toLocaleString('en-US')
}
/** For lines printed inside parentheses: the form expects a positive number. */
const paren = (n: number): string => amt(Math.abs(n))
const digits = (v: string): string => v.replace(/\D/g, '')
const ssnDashed = (v: string): string => {
  const d = digits(v)
  return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d
}
const zip = (v: string): string => {
  const d = digits(v)
  return d.length === 9 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}
const fullName = (p: Person): string => `${p.firstName} ${p.lastName}`.trim()

export function namesOnReturn(ret: TaxReturnInput): string {
  if (ret.filingStatus !== 'mfj') return fullName(ret.taxpayer)
  const t = ret.taxpayer
  const s = ret.spouse
  if (t.lastName.trim() && t.lastName.trim() === s.lastName.trim()) return `${t.firstName} & ${s.firstName} ${t.lastName}`.trim()
  return `${fullName(t)} & ${fullName(s)}`
}

function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return [parts[0] ?? '', '']
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]]
}

/** Header fields (name + SSN) that most schedules share. */
const header = (ret: TaxReturnInput, nameKey: string, ssnKey: string): Record<string, FieldValue> => ({
  [nameKey]: namesOnReturn(ret),
  [ssnKey]: ssnDashed(ret.taxpayer.ssn)
})

// ── Form 1040 ────────────────────────────────────────────────────────────────
function form1040(ret: TaxReturnInput, res: TaxReturnResult, attachScheduleD: boolean): FormFill {
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const c = ret.contact
  const v: Record<string, FieldValue> = {
    'f1_14[0]': ret.taxpayer.firstName,
    'f1_15[0]': ret.taxpayer.lastName,
    'f1_16[0]': digits(ret.taxpayer.ssn),
    'Address_ReadOrder[0].f1_20[0]': c.street,
    'Address_ReadOrder[0].f1_21[0]': c.apt,
    'Address_ReadOrder[0].f1_22[0]': c.city,
    'Address_ReadOrder[0].f1_23[0]': c.state,
    'Address_ReadOrder[0].f1_24[0]': zip(c.zip),
    'c1_5[0]': c.livedInUsHalfYear,
    'c1_6[0]': ret.taxpayer.presidentialFund,
    'Checkbox_ReadOrder[0].c1_8[0]': fs === 'single',
    'Checkbox_ReadOrder[0].c1_8[1]': fs === 'mfj',
    'Checkbox_ReadOrder[0].c1_8[2]': fs === 'mfs',
    'Page1[0].c1_8[0]': fs === 'hoh',
    'Page1[0].c1_8[1]': fs === 'qss',
    'c1_10[0]': ret.digitalAssets === true,
    'c1_10[1]': ret.digitalAssets === false,
    // Income
    'f1_47[0]': amt(f['1a']),
    'f1_51[0]': amt(f['1e']),
    'f1_57[0]': amt(f['1z'], true),
    'f1_58[0]': amt(f['2a']),
    'f1_59[0]': amt(f['2b']),
    'f1_60[0]': amt(f['3a']),
    'f1_61[0]': amt(f['3b']),
    'f1_62[0]': amt(f['4a']),
    'f1_63[0]': amt(f['4b']),
    'f1_65[0]': amt(f['5a']),
    'f1_66[0]': amt(f['5b']),
    'f1_68[0]': amt(f['6a']),
    'f1_69[0]': amt(f['6b']),
    'f1_70[0]': amt(f['7a']),
    'c1_43[0]': f['7a'] !== 0 && !attachScheduleD,
    'f1_72[0]': amt(f['8']),
    'f1_73[0]': amt(f['9'], true),
    'f1_74[0]': amt(f['10']),
    'f1_75[0]': amt(f['11a'], true),
    // Page 2
    'f2_01[0]': amt(f['11b'], true),
    'c2_1[0]': ret.canBeClaimedAsDependent,
    'c2_5[0]': ret.taxpayer.age >= 65 || ret.taxpayer.age65OrOlder,
    'c2_6[0]': ret.taxpayer.blind,
    'f2_02[0]': amt(f['12e'], true),
    'f2_03[0]': amt(f['13a']),
    'f2_04[0]': amt(f['13b']),
    'f2_05[0]': amt(f['14'], true),
    'f2_06[0]': amt(f['15'], true),
    'f2_08[0]': amt(f['16'], true),
    'f2_09[0]': amt(f['17']),
    'f2_10[0]': amt(f['18'], true),
    'f2_11[0]': amt(f['19']),
    'f2_12[0]': amt(f['20']),
    'f2_13[0]': amt(f['21']),
    'f2_14[0]': amt(f['22'], true),
    'f2_15[0]': amt(f['23']),
    'f2_16[0]': amt(f['24'], true),
    'f2_17[0]': amt(f['25a']),
    'f2_18[0]': amt(f['25b']),
    'f2_19[0]': amt(f['25c']),
    'f2_20[0]': amt(f['25d']),
    'f2_21[0]': amt(f['26']),
    'f2_23[0]': amt(f['27a']),
    'f2_24[0]': amt(f['28']),
    'f2_25[0]': amt(f['29']),
    'f2_27[0]': amt(f['31']),
    'f2_28[0]': amt(f['32']),
    'f2_29[0]': amt(f['33'], true),
    'f2_30[0]': amt(f['34']),
    'f2_31[0]': amt(f['34']),
    'f2_35[0]': amt(f['37']),
    'f2_40[0]': ret.taxpayer.occupation,
    'f2_44[0]': ret.contact.phone,
    'f2_45[0]': ret.contact.email
  }
  if (joint || fs === 'mfs') {
    v['f1_17[0]'] = ret.spouse.firstName
    v['f1_18[0]'] = ret.spouse.lastName
    v['f1_19[0]'] = digits(ret.spouse.ssn)
  }
  if (joint) {
    v['c1_7[0]'] = ret.spouse.presidentialFund
    v['c2_7[0]'] = ret.spouse.age >= 65 || ret.spouse.age65OrOlder
    v['c2_8[0]'] = ret.spouse.blind
    v['f2_42[0]'] = ret.spouse.occupation
  }
  if (fs === 'mfs') v['Checkbox_ReadOrder[0].f1_28[0]'] = fullName(ret.spouse)
  if (fs === 'mfs' && ret.deductionChoice === 'itemized') v['c2_3[0]'] = true

  // Direct deposit (line 35)
  if (f['34'] > 0 && digits(ret.refundDeposit.routingNumber).length === 9 && digits(ret.refundDeposit.accountNumber).length >= 4) {
    v['RoutingNo[0].f2_32[0]'] = digits(ret.refundDeposit.routingNumber)
    v['AccountNo[0].f2_33[0]'] = digits(ret.refundDeposit.accountNumber)
    v['c2_16[0]'] = ret.refundDeposit.accountType === 'checking'
    v['c2_16[1]'] = ret.refundDeposit.accountType === 'savings'
  }

  // Dependents table (four columns)
  ret.dependents.slice(0, 4).forEach((d, i) => {
    const n = i + 1
    const [first, last] = splitName(d.name)
    v[`f1_${31 + i}[0]`] = first
    v[`f1_${35 + i}[0]`] = last
    v[`f1_${39 + i}[0]`] = digits(d.ssn)
    v[`f1_${43 + i}[0]`] = d.relationship
    v[`Row5[0].Dependent${n}[0].c1_${12 + 2 * i}[0]`] = d.monthsLivedWithYou > 6
    v[`Row5[0].Dependent${n}[0].c1_${13 + 2 * i}[0]`] = d.monthsLivedWithYou > 6 && c.livedInUsHalfYear
    v[`Row6[0].Dependent${n}[0].c1_${20 + 2 * i}[0]`] = d.student
    v[`Row6[0].Dependent${n}[0].c1_${21 + 2 * i}[0]`] = d.disabled
    v[`Row7[0].Dependent${n}[0].c1_${28 + i}[0]`] = ctcChild(d)
    v[`Row7[0].Dependent${n}[0].c1_${28 + i}[1]`] = !ctcChild(d)
  })
  if (ret.dependents.length > 4) v['Dependents_ReadOrder[0].c1_11[0]'] = true
  return { id: '1040', file: 'f1040.pdf', title: 'Form 1040', values: v }
}

// ── Schedule 1 ───────────────────────────────────────────────────────────────
function schedule1(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const s = res.schedule1
  const a = s.adjustments
  return {
    id: 's1', file: 'f1040s1.pdf', title: 'Schedule 1',
    values: {
      ...header(ret, 'f1_01[0]', 'f1_02[0]'),
      'f1_07[0]': amt(s.businessIncome),
      'f1_12[0]': amt(s.unemployment),
      'f1_35[0]': s.otherIncome ? 'Other income' : '',
      'f1_36[0]': amt(s.otherIncome),
      'f1_37[0]': amt(s.otherIncome),
      'f1_38[0]': amt(s.additionalIncome, true),
      'f2_01[0]': amt(a.educatorExpenses),
      'f2_03[0]': amt(a.hsaDeduction),
      'f2_05[0]': amt(a.deductibleHalfOfSeTax),
      'f2_07[0]': amt(a.selfEmployedHealthInsurance),
      'f2_12[0]': amt(a.iraDeduction),
      'f2_13[0]': amt(a.studentLoanInterest),
      'f2_30[0]': amt(s.totalAdjustments, true)
    }
  }
}

// ── Schedule 1-A ─────────────────────────────────────────────────────────────
function schedule1A(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const s = res.schedule1A
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const v: Record<string, FieldValue> = {
    ...header(ret, 'f1_01[0]', 'f1_02[0]'),
    'f1_03[0]': amt(s.magi, true),
    'f1_09[0]': amt(s.magi, true),
    'f2_23[0]': amt(s.total, true)
  }
  if (s.tipsCapped > 0) {
    Object.assign(v, {
      'f1_10[0]': amt(ret.schedule1A.qualifiedTips), 'f1_12[0]': amt(ret.schedule1A.qualifiedTips),
      'f1_14[0]': amt(ret.schedule1A.qualifiedTips), 'f1_15[0]': amt(s.tipsCapped),
      'f1_16[0]': amt(s.magi, true), 'f1_17[0]': amt(R.TIPS_OVERTIME_PHASEOUT_START[fs], true),
      'f1_18[0]': amt(s.tipOtExcess, true), 'f1_19[0]': String(Math.floor(s.tipOtExcess / 1000)),
      'f1_20[0]': amt(s.tipOtReduction, true), 'f1_21[0]': amt(s.tips, true)
    })
  }
  if (s.overtimeCapped > 0) {
    Object.assign(v, {
      'f1_22[0]': amt(ret.schedule1A.qualifiedOvertime), 'f1_24[0]': amt(ret.schedule1A.qualifiedOvertime),
      'f1_25[0]': amt(s.overtimeCapped), 'f1_26[0]': amt(s.magi, true),
      'f1_27[0]': amt(R.TIPS_OVERTIME_PHASEOUT_START[fs], true), 'f1_28[0]': amt(s.tipOtExcess, true),
      'f1_29[0]': String(Math.floor(s.tipOtExcess / 1000)), 'f1_30[0]': amt(s.tipOtReduction, true),
      'f1_31[0]': amt(s.overtime, true)
    })
  }
  if (s.carCapped > 0) {
    Object.assign(v, {
      'f2_01[0]': ret.schedule1A.vehicleVin, 'f2_03[0]': amt(ret.schedule1A.carLoanInterest),
      'f2_07[0]': amt(ret.schedule1A.carLoanInterest), 'f2_08[0]': amt(s.carCapped),
      'f2_09[0]': amt(s.magi, true), 'f2_10[0]': amt(R.CAR_LOAN_PHASEOUT_START[fs], true),
      'f2_11[0]': amt(s.carExcess, true), 'f2_12[0]': String(Math.ceil(s.carExcess / 1000)),
      'f2_13[0]': amt(s.carReduction, true), 'f2_14[0]': amt(s.carLoanInterest, true)
    })
  }
  if (s.senior > 0) {
    Object.assign(v, {
      'f2_15[0]': amt(s.magi, true), 'f2_16[0]': amt(R.SENIOR_PHASEOUT_START[fs], true),
      'f2_17[0]': amt(s.seniorExcess, true), 'f2_18[0]': amt(s.seniorExcess * R.SENIOR_PHASEOUT_RATE, true),
      'f2_19[0]': amt(s.seniorEach, true), 'f2_20[0]': amt(s.seniorTaxpayer),
      'f2_21[0]': joint ? amt(s.seniorSpouse) : '', 'f2_22[0]': amt(s.senior, true)
    })
  }
  return { id: 's1a', file: 'f1040s1a.pdf', title: 'Schedule 1-A', values: v }
}

// ── Schedule 2 ───────────────────────────────────────────────────────────────
function schedule2(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const s = res.schedule2
  return {
    id: 's2', file: 'f1040s2.pdf', title: 'Schedule 2',
    values: {
      ...header(ret, 'f1_01[0]', 'f1_02[0]'),
      'f1_15[0]': amt(s.selfEmploymentTax),
      'f1_19[0]': amt(s.earlyDistributionTax),
      'Line8_ReadOrder[0].c1_6[0]': s.earlyDistributionTax > 0,
      'f1_22[0]': amt(s.additionalMedicareTax),
      'f1_23[0]': amt(s.netInvestmentIncomeTax),
      'f2_24[0]': amt(s.total, true)
    }
  }
}

// ── Schedule 3 ───────────────────────────────────────────────────────────────
function schedule3(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const s = res.schedule3
  return {
    id: 's3', file: 'f1040s3.pdf', title: 'Schedule 3',
    values: {
      ...header(ret, 'f1_01[0]', 'f1_02[0]'),
      'f1_04[0]': amt(s.dependentCare),
      'f1_05[0]': amt(s.education),
      'f1_25[0]': amt(s.dependentCare + s.education),
      'f1_28[0]': amt(s.excessSocialSecurity),
      'f1_37[0]': amt(s.excessSocialSecurity)
    }
  }
}

// ── Schedule A ───────────────────────────────────────────────────────────────
function scheduleA(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const it = ret.itemized
  const a = res.scheduleA
  const agi = res.f1040['11b']
  return {
    id: 'sa', file: 'f1040sa.pdf', title: 'Schedule A',
    values: {
      ...header(ret, 'f1_1[0]', 'f1_2[0]'),
      'f1_3[0]': amt(it.medical), 'f1_4[0]': amt(agi, true), 'f1_5[0]': amt(agi * R.MEDICAL_AGI_FLOOR), 'f1_6[0]': amt(a.medical),
      'f1_7[0]': amt(it.stateLocalIncomeOrSalesTax), 'f1_8[0]': amt(it.realEstateTax), 'f1_9[0]': amt(it.personalPropertyTax),
      'f1_10[0]': amt(a.saltBeforeCap), 'f1_11[0]': amt(a.taxes), 'f1_14[0]': amt(a.taxes),
      'f1_15[0]': amt(it.mortgageInterest), 'f1_20[0]': amt(it.mortgageInterest), 'f1_22[0]': amt(a.interest),
      'f1_23[0]': amt(it.charityCash), 'f1_24[0]': amt(it.charityNonCash), 'f1_26[0]': amt(a.charity),
      'f1_28[0]': it.other ? 'Other itemized deductions' : '', 'f1_29[0]': amt(it.other),
      'f1_30[0]': amt(a.total, true),
      'Line18_ReadOrder[0].c1_3[0]': ret.deductionChoice === 'itemized' && a.total < res.deduction.standard
    }
  }
}

// ── Schedule B ───────────────────────────────────────────────────────────────
function scheduleB(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const v: Record<string, FieldValue> = { ...header(ret, 'f1_01[0]', 'f1_02[0]') }
  const rows = <T>(items: T[], max: number, label: (x: T) => string, value: (x: T) => number): [string, number][] => {
    const list = items.map((x) => [label(x) || 'Payer', value(x)] as [string, number]).filter(([, n]) => n !== 0)
    if (list.length <= max) return list
    const head = list.slice(0, max - 1)
    const rest = list.slice(max - 1).reduce((t, [, n]) => t + n, 0)
    return [...head, ['Other payers (see attached list)', rest]]
  }
  rows(ret.interest, 14, (x) => x.payer, (x) => x.interest).forEach(([name, n], i) => {
    v[`f1_${String(3 + 2 * i).padStart(2, '0')}[0]`] = name
    v[`f1_${String(4 + 2 * i).padStart(2, '0')}[0]`] = amt(n)
  })
  v['f1_31[0]'] = amt(res.f1040['2b'])
  v['f1_33[0]'] = amt(res.f1040['2b'])
  rows(ret.dividends, 15, (x) => x.payer, (x) => x.ordinaryDividends).forEach(([name, n], i) => {
    v[`f1_${34 + 2 * i}[0]`] = name
    v[`f1_${35 + 2 * i}[0]`] = amt(n)
  })
  v['f1_64[0]'] = amt(res.f1040['3b'])
  // Part III
  v['TagcorrectingSubform[0].c1_1[0]'] = ret.foreignAccounts
  v['TagcorrectingSubform[0].c1_1[1]'] = !ret.foreignAccounts
  v['Page1[0].c1_3[0]'] = false
  v['Page1[0].c1_3[1]'] = !ret.foreignAccounts
  return { id: 'sb', file: 'f1040sb.pdf', title: 'Schedule B', values: v }
}

// ── Schedule D ───────────────────────────────────────────────────────────────
function scheduleD(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const d = res.scheduleD
  const st = ret.capitalTransactions.filter((t) => t.term === 'short')
  const lt = ret.capitalTransactions.filter((t) => t.term === 'long')
  const tot = (xs: typeof st, k: 'proceeds' | 'costBasis'): number => xs.reduce((s, x) => s + x[k], 0)
  const capDist = ret.dividends.reduce((s, x) => s + x.capitalGainDistributions, 0)
  const line16 = d.net
  const v: Record<string, FieldValue> = {
    ...header(ret, 'f1_1[0]', 'f1_2[0]'),
    'Page1[0].c1_1[1]': true,
    'f1_21[0]': paren(ret.capitalLossCarryover.shortTerm),
    'f1_22[0]': amt(d.shortTerm, true),
    'f1_41[0]': amt(capDist),
    'f1_42[0]': paren(ret.capitalLossCarryover.longTerm),
    'f1_43[0]': amt(d.longTerm, true),
    'f2_1[0]': amt(line16, true)
  }
  if (st.length) Object.assign(v, { 'f1_3[0]': amt(tot(st, 'proceeds'), true), 'f1_4[0]': amt(tot(st, 'costBasis'), true), 'f1_6[0]': amt(tot(st, 'proceeds') - tot(st, 'costBasis'), true) })
  if (lt.length) Object.assign(v, { 'f1_23[0]': amt(tot(lt, 'proceeds'), true), 'f1_24[0]': amt(tot(lt, 'costBasis'), true), 'f1_26[0]': amt(tot(lt, 'proceeds') - tot(lt, 'costBasis'), true) })
  if (line16 > 0) {
    const bothGains = d.longTerm > 0
    v['Page2[0].c2_1[0]'] = bothGains
    v['Page2[0].c2_1[1]'] = !bothGains
    if (bothGains) v['Page2[0].c2_2[0]'] = true
  }
  if (line16 < 0) v['f2_4[0]'] = paren(res.f1040['7a'])
  if (line16 <= 0 || d.longTerm <= 0) {
    v['Page2[0].c2_3[0]'] = res.f1040['3a'] > 0
    v['Page2[0].c2_3[1]'] = res.f1040['3a'] <= 0
  }
  return { id: 'sd', file: 'f1040sd.pdf', title: 'Schedule D', values: v }
}

// ── Schedule SE (one per person) ─────────────────────────────────────────────
function scheduleSE(ret: TaxReturnInput, res: TaxReturnResult, owner: Owner): FormFill | null {
  const se = res.scheduleSE.find((x) => x.owner === owner)
  if (!se) return null
  const person = owner === 'spouse' ? ret.spouse : ret.taxpayer
  const profit = res.scheduleC.filter((b) => b.owner === owner).reduce((s, b) => s + b.netProfit, 0)
  const ssWages = ret.w2s.filter((w) => w.owner === owner).reduce((s, w) => s + (w.socialSecurityWages || w.wages), 0)
  const line9 = Math.max(0, R.SOCIAL_SECURITY_WAGE_BASE - ssWages)
  return {
    id: `sse-${owner}`, file: 'f1040sse.pdf', title: `Schedule SE (${person.firstName || owner})`,
    values: {
      'f1_1[0]': fullName(person), 'f1_2[0]': ssnDashed(person.ssn),
      'f1_5[0]': amt(profit, true), 'f1_6[0]': amt(profit, true), 'f1_7[0]': amt(se.netEarnings, true),
      'f1_9[0]': amt(se.netEarnings, true), 'f1_12[0]': amt(se.netEarnings, true),
      'f1_14[0]': amt(ssWages), 'f1_17[0]': amt(ssWages),
      'f1_18[0]': amt(line9, true), 'f1_19[0]': amt(se.socialSecurityTax, true), 'f1_20[0]': amt(se.medicareTax, true),
      'f1_21[0]': amt(se.total, true), 'f1_22[0]': amt(se.total / 2, true)
    }
  }
}

// ── Schedule EIC ─────────────────────────────────────────────────────────────
const EIC_4A: [string, string][] = [
  ['Line4a_Child1_ReadOrder[0].Yes_ReadOrder[0].c1_1[0]', 'Line4a_Child1_ReadOrder[0].c1_1[0]'],
  ['Line4a_Child2_ReadOrder[0].Yes_ReadOrder[0].c1_2[0]', 'Line4a_Child2_ReadOrder[0].c1_2[0]'],
  ['Line4a_Child3_Yes_ReadOrder[0].c1_3[0]', 'Page1[0].c1_3[0]']
]
const EIC_4B: [string, string][] = [
  ['Line4b_Child1_ReadOrder[0].Yes_ReadOrder[0].c1_4[0]', 'Line4b_Child1_ReadOrder[0].c1_4[0]'],
  ['Line4b_Child2_ReadOrder[0].Yes_ReadOrder[0].c1_5[0]', 'Line4b_Child2_ReadOrder[0].c1_5[0]'],
  ['Line4b_Child3_Yes_ReadOrder[0].c1_6[0]', 'Page1[0].c1_6[0]']
]
function scheduleEIC(ret: TaxReturnInput): FormFill {
  const v: Record<string, FieldValue> = { ...header(ret, 'f1_01[0]', 'f1_02[0]') }
  ret.dependents.filter(eicChild).slice(0, 3).forEach((d, i) => {
    const two = (n: number): string => String(n).padStart(2, '0')
    v[`f1_${two(3 + i)}[0]`] = d.name
    v[`f1_${two(6 + i)}[0]`] = ssnDashed(d.ssn)
    const year = String(R.TAX_YEAR - d.age)
    year.split('').forEach((ch, k) => { v[`f1_${two(9 + 4 * i + k)}[0]`] = ch })
    if (d.age >= 19) {
      const studentYes = d.student && d.age < 24
      v[EIC_4A[i][0]] = studentYes
      v[EIC_4A[i][1]] = !studentYes
      if (!studentYes) {
        v[EIC_4B[i][0]] = d.disabled
        v[EIC_4B[i][1]] = !d.disabled
      }
    }
    v[`f1_${21 + i}[0]`] = d.relationship
    v[`f1_${24 + i}[0]`] = String(Math.min(12, Math.max(7, d.monthsLivedWithYou)))
  })
  return { id: 'seic', file: 'f1040sei.pdf', title: 'Schedule EIC', values: v }
}

// ── Schedule 8812 ────────────────────────────────────────────────────────────
function schedule8812(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const c = res.schedule8812
  const magi = res.f1040['11a']
  const threshold = R.CTC_PHASEOUT_START[ret.filingStatus]
  const over = Math.max(0, magi - threshold)
  const line10 = Math.ceil(over / 1000) * 1000
  const line12 = Math.max(0, c.creditBeforePhaseout - c.phaseoutReduction)
  const line13 = Math.max(0, res.f1040['18'] - res.schedule3.dependentCare - res.schedule3.education)
  const v: Record<string, FieldValue> = {
    ...header(ret, 'f1_1[0]', 'f1_2[0]'),
    'f1_3[0]': amt(magi, true), 'f1_8[0]': amt(magi, true),
    'f1_9[0]': String(c.qualifyingChildren), 'f1_10[0]': amt(c.qualifyingChildren * R.CTC_PER_CHILD, true),
    'f1_11[0]': String(c.otherDependents), 'f1_12[0]': amt(c.otherDependents * R.ODC_PER_DEPENDENT, true),
    'f1_13[0]': amt(c.creditBeforePhaseout, true), 'f1_14[0]': amt(threshold, true),
    'f1_15[0]': amt(line10, true), 'f1_16[0]': amt(line10 * 0.05, true),
    'Page1[0].c1_1[0]': line12 <= 0, 'Page1[0].c1_1[1]': line12 > 0,
    'f1_17[0]': line12 > 0 ? amt(line12, true) : '',
    'f1_18[0]': line12 > 0 ? amt(line13, true) : '',
    'f1_19[0]': amt(c.nonrefundable, true)
  }
  const unused = line12 - c.nonrefundable
  if (c.qualifyingChildren > 0 && unused > 0) {
    const earned = res.eic.earnedIncome
    const line16b = c.qualifyingChildren * R.ACTC_REFUNDABLE_MAX_PER_CHILD
    const line17 = Math.min(unused, line16b)
    const line19 = Math.max(0, earned - R.ACTC_EARNED_INCOME_FLOOR)
    Object.assign(v, {
      'f2_2[0]': amt(unused, true), 'f2_3[0]': String(c.qualifyingChildren), 'f2_4[0]': amt(line16b, true),
      'f2_5[0]': amt(line17, true), 'f2_6[0]': amt(earned, true),
      'Page2[0].c2_1[0]': earned <= R.ACTC_EARNED_INCOME_FLOOR, 'Page2[0].c2_1[1]': earned > R.ACTC_EARNED_INCOME_FLOOR,
      'f2_8[0]': earned > R.ACTC_EARNED_INCOME_FLOOR ? amt(line19, true) : '',
      'f2_9[0]': amt(line19 * R.ACTC_EARNED_INCOME_RATE, true),
      'Page2[0].c2_2[0]': line16b < 5100, 'Page2[0].c2_2[1]': line16b >= 5100,
      'f2_16[0]': amt(c.refundable, true)
    })
  }
  return { id: 's8812', file: 'f1040s8.pdf', title: 'Schedule 8812', values: v }
}

// ── Form 8959 ────────────────────────────────────────────────────────────────
function form8959(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const fs = ret.filingStatus
  const owners: Owner[] = fs === 'mfj' ? ['taxpayer', 'spouse'] : ['taxpayer']
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const wages = w2s.reduce((s, w) => s + (w.medicareWages || w.wages), 0)
  const withheld = w2s.reduce((s, w) => s + w.medicareWithheld, 0)
  const thr = R.HIGH_INCOME_THRESHOLD[fs]
  const line6 = Math.max(0, wages - thr)
  const line7 = line6 * R.ADDITIONAL_MEDICARE_RATE
  const se = res.scheduleSE.reduce((s, x) => s + x.netEarnings, 0)
  const line11 = Math.max(0, thr - wages)
  const line12 = Math.max(0, se - line11)
  const line13 = line12 * R.ADDITIONAL_MEDICARE_RATE
  const line21 = wages * R.MEDICARE_EMPLOYEE_RATE
  return {
    id: '8959', file: 'f8959.pdf', title: 'Form 8959',
    values: {
      ...header(ret, 'f1_1[0]', 'f1_2[0]'),
      'f1_3[0]': amt(wages), 'f1_6[0]': amt(wages), 'f1_7[0]': amt(thr, true), 'f1_8[0]': amt(line6, true), 'f1_9[0]': amt(line7, true),
      'f1_10[0]': se ? amt(se) : '', 'f1_11[0]': se ? amt(thr, true) : '', 'f1_12[0]': se ? amt(wages, true) : '',
      'f1_13[0]': se ? amt(line11, true) : '', 'f1_14[0]': se ? amt(line12, true) : '', 'f1_15[0]': se ? amt(line13, true) : '',
      'f1_20[0]': amt(res.schedule2.additionalMedicareTax, true),
      'f1_21[0]': amt(withheld), 'f1_22[0]': amt(wages), 'f1_23[0]': amt(line21),
      'f1_24[0]': amt(res.f1040['25c'], true), 'f1_26[0]': amt(res.f1040['25c'], true)
    }
  }
}

// ── Form 8960 ────────────────────────────────────────────────────────────────
function form8960(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const f = res.f1040
  const nii = Math.max(0, f['2b'] + f['3b'] + f['7a'])
  const thr = R.HIGH_INCOME_THRESHOLD[ret.filingStatus]
  const line15 = Math.max(0, f['11a'] - thr)
  return {
    id: '8960', file: 'f8960.pdf', title: 'Form 8960',
    values: {
      ...header(ret, 'f1_1[0]', 'f1_2[0]'),
      'f1_3[0]': amt(f['2b']), 'f1_4[0]': amt(f['3b']), 'f1_9[0]': amt(f['7a']), 'f1_12[0]': amt(f['7a']),
      'f1_15[0]': amt(nii, true), 'f1_22[0]': amt(nii, true), 'f1_23[0]': amt(f['11a'], true),
      'f1_24[0]': amt(thr, true), 'f1_25[0]': amt(line15, true), 'f1_26[0]': amt(Math.min(nii, line15), true),
      'f1_27[0]': amt(res.schedule2.netInvestmentIncomeTax, true)
    }
  }
}

// ── Form 8995 ────────────────────────────────────────────────────────────────
function form8995(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const q = res.qbi
  const businesses = res.scheduleC.filter((b) => b.netProfit !== 0)
  const totalProfit = businesses.reduce((s, b) => s + b.netProfit, 0)
  const v: Record<string, FieldValue> = { ...header(ret, 'f1_01[0]', 'f1_02[0]') }
  businesses.slice(0, 5).forEach((b, i) => {
    const two = (n: number): string => String(n).padStart(2, '0')
    const share = totalProfit ? (b.netProfit / totalProfit) * q.qualifiedBusinessIncome : 0
    v[`f1_${two(3 + 3 * i)}[0]`] = b.name
    v[`f1_${two(5 + 3 * i)}[0]`] = amt(share, true)
  })
  const line13 = Math.max(0, q.taxableIncomeBeforeQbi - q.netCapitalGain)
  Object.assign(v, {
    'f1_18[0]': amt(q.qualifiedBusinessIncome, true), 'f1_20[0]': amt(q.qualifiedBusinessIncome, true),
    'f1_21[0]': amt(q.qualifiedBusinessIncome * R.QBI_RATE, true), 'f1_26[0]': amt(q.qualifiedBusinessIncome * R.QBI_RATE, true),
    'f1_27[0]': amt(q.taxableIncomeBeforeQbi, true), 'f1_28[0]': amt(q.netCapitalGain, true),
    'f1_29[0]': amt(line13, true), 'f1_30[0]': amt(line13 * R.QBI_RATE, true), 'f1_31[0]': amt(q.deduction, true)
  })
  return { id: '8995', file: 'f8995.pdf', title: 'Form 8995', values: v }
}


// ── Form 2441 ────────────────────────────────────────────────────────────────
function form2441(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const f = res.form2441
  const care = ret.dependentCare
  const v: Record<string, FieldValue> = { ...header(ret, 'f1_1[0]', 'f1_2[0]') }
  const providerRows: [string, string, string, string, string, string][] = [
    ['f1_3[0]', 'f1_4[0]', 'f1_5[0]', 'ColD[0].c1_4[1]', 'ColD[0].c1_4[0]', 'f1_6[0]'],
    ['f1_7[0]', 'f1_8[0]', 'f1_9[0]', 'ColD[0].c1_5[1]', 'ColD[0].c1_5[0]', 'f1_10[0]'],
    ['f1_11[0]', 'f1_12[0]', 'f1_13[0]', 'ColD[0].c1_6[1]', 'ColD[0].c1_6[0]', 'f1_14[0]']
  ]
  care.providers.slice(0, 3).forEach((p, i) => {
    const [name, address, tin, yes, no, amount] = providerRows[i]
    v[name] = p.name
    v[address] = p.address
    v[tin] = digits(p.tin).length === 9 ? (p.tin.includes('-') ? p.tin : digits(p.tin)) : p.tin
    v[yes] = p.householdEmployee
    v[no] = !p.householdEmployee
    v[amount] = amt(p.amountPaid)
  })
  if (care.providers.length > 3) v['PartI[0].c1_3[0]'] = true
  // Part II line 2: qualifying persons, expenses split evenly
  const persons = ret.dependents.filter(careQualifyingPerson)
  const personRows: [string, string, string, string, string][] = [
    ['f1_15[0]', 'f1_16[0]', 'f1_17[0]', 'Row1[0].c1_8[0]', 'f1_18[0]'],
    ['f1_19[0]', 'f1_20[0]', 'f1_21[0]', 'Row2[0].c1_9[0]', 'f1_22[0]'],
    ['f1_23[0]', 'f1_24[0]', 'f1_25[0]', 'Row3[0].c1_10[0]', 'f1_26[0]']
  ]
  const shown = persons.slice(0, 3)
  // Column (d) excludes expenses paid with benefits already counted on line 28.
  const columnTotal = f.partIII ? f.partIII.line30 : Math.round(care.expenses)
  const perPerson = shown.length ? Math.floor(columnTotal / shown.length) : 0
  shown.forEach((d, i) => {
    const [first, last, ssn, disabled, expenses] = personRows[i]
    const [fn, ln] = splitName(d.name)
    v[first] = fn
    v[last] = ln
    v[ssn] = ssnDashed(d.ssn)
    v[disabled] = d.disabled && d.age > 12
    v[expenses] = amt(i === 0 ? columnTotal - perPerson * (shown.length - 1) : perPerson)
  })
  if (persons.length > 3) v['Page1[0].c1_7[0]'] = true
  Object.assign(v, {
    'f1_27[0]': amt(f.line3, true), 'f1_28[0]': amt(f.line4, true), 'f1_29[0]': amt(f.line5, true),
    'f1_30[0]': amt(f.expensesUsed, true), 'f1_31[0]': amt(res.f1040['11a'], true),
    'f1_32[0]': f.rate ? String(Math.round(f.rate * 100)).padStart(2, '0') : '',
    'f1_33[0]': amt(f.credit, true), 'f1_35[0]': amt(f.credit, true),
    'f1_36[0]': amt(res.f1040['18'], true), 'f1_37[0]': amt(res.schedule3.dependentCare, true)
  })
  const p3 = f.partIII
  if (p3) {
    Object.assign(v, {
      'f2_1[0]': amt(p3.line12, true), 'f2_4[0]': amt(p3.line12, true), 'f2_5[0]': amt(p3.line16, true),
      'f2_6[0]': amt(p3.line17, true), 'f2_7[0]': amt(p3.line18, true), 'f2_8[0]': amt(p3.line19, true),
      'f2_9[0]': amt(p3.line20, true), 'f2_10[0]': amt(p3.line21, true), 'Page2[0].c2_1[0]': true,
      'f2_12[0]': amt(p3.line12, true), 'f2_14[0]': amt(p3.line25, true), 'f2_15[0]': amt(p3.line26, true),
      'f2_16[0]': amt(p3.line27, true), 'f2_17[0]': amt(p3.line28, true), 'f2_18[0]': amt(p3.line29, true),
      'f2_19[0]': amt(p3.line30, true), 'f2_20[0]': amt(p3.line31, true)
    })
  }
  return { id: '2441', file: 'f2441.pdf', title: 'Form 2441', values: v, pages: p3 ? undefined : [0] }
}

// ── Form 8863 ────────────────────────────────────────────────────────────────
const ssnParts = (v: string): [string, string, string] => {
  const d = digits(v)
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5, 9)]
}
function form8863Student(ret: TaxReturnInput, st: TaxReturnInput['students'][number]): Record<string, FieldValue> {
  const v: Record<string, FieldValue> = { 'f2_1[0]': namesOnReturn(ret) }
  const [a, b, c] = ssnParts(ret.taxpayer.ssn)
  Object.assign(v, { 'f2_2[0]': a, 'f2_3[0]': b, 'f2_4[0]': c })
  const [s1, s2, s3] = ssnParts(st.ssn)
  // The IRS form names this field with a hyphen.
  Object.assign(v, { 'f2-5[0]': st.name, 'f2_6[0]': s1, 'f2_7[0]': s2, 'f2_8[0]': s3, 'f2_9[0]': st.institution, 'f2_10[0]': st.institutionAddress })
  v['Line22a[0].c2_1[0]'] = st.received1098T
  v['Line22a[0].c2_1[1]'] = !st.received1098T
  const ein = digits(st.institutionEin)
  if (st.aotcEligible && ein.length === 9) ein.split('').forEach((ch, i) => { v[`f2_${11 + i}[0]`] = ch })
  const x = Math.max(0, st.qualifiedExpenses)
  if (st.aotcEligible) {
    const l27 = Math.min(x, 4000)
    const l28 = Math.max(0, l27 - R.AOTC_FULL_EXPENSES)
    const l29 = l28 * R.AOTC_PARTIAL_RATE
    Object.assign(v, {
      'Page2[0].c2_5[1]': true, 'Page2[0].c2_6[0]': true, 'Page2[0].c2_7[1]': true, 'Page2[0].c2_8[1]': true,
      'f2_31[0]': amt(l27, true), 'f2_32[0]': amt(l28, true), 'f2_33[0]': amt(l29, true),
      'f2_34[0]': amt(l28 === 0 ? l27 : R.AOTC_FULL_EXPENSES + l29, true)
    })
  } else {
    v['f2_35[0]'] = amt(x, true)
  }
  return v
}
function form8863(ret: TaxReturnInput, res: TaxReturnResult): FormFill[] {
  const f = res.form8863
  const d = res.form8863Detail
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const top = joint ? 180000 : 90000
  const span = joint ? 20000 : 10000
  const agi = res.f1040['11b']
  const room = Math.max(0, top - agi)
  const [a, b, c] = ssnParts(ret.taxpayer.ssn)
  const dec = (n: number): [string, string] => {
    const fixed = n.toFixed(3)
    const [whole, frac] = fixed.split('.')
    return [whole, frac]
  }
  const [w6, f6] = dec(room >= span ? 1 : room / span)
  const p1: Record<string, FieldValue> = { 'f1_1[0]': namesOnReturn(ret), 'f1_2[0]': a, 'f1_3[0]': b, 'f1_4[0]': c }
  if (d.aotcTentative > 0) {
    const line7 = Math.round(d.aotcTentative * d.phaseoutFraction)
    Object.assign(p1, {
      'f1_5[0]': amt(d.aotcTentative, true), 'f1_6[0]': amt(top, true), 'f1_7[0]': amt(agi, true), 'f1_8[0]': amt(room, true),
      'f1_9[0]': amt(span, true), 'f1_10[0]': w6, 'f1_11[0]': f6, 'f1_12[0]': amt(line7, true),
      'f1_13[0]': amt(f.aotcRefundable, true), 'f1_14[0]': amt(line7 - f.aotcRefundable, true)
    })
  }
  if (d.llcTentative > 0) {
    Object.assign(p1, {
      'f1_15[0]': amt(d.llcExpenses, true), 'f1_16[0]': amt(d.llcExpenses, true), 'f1_17[0]': amt(d.llcTentative, true),
      'f1_18[0]': amt(top, true), 'f1_19[0]': amt(agi, true), 'f1_20[0]': amt(room, true), 'f1_21[0]': amt(span, true),
      'f1_22[0]': w6, 'f1_23[0]': f6, 'f1_24[0]': amt(f.llc, true)
    })
  }
  p1['f1_25[0]'] = amt(f.nonrefundableAllowed, true)
  const students = ret.students.filter((s) => s.qualifiedExpenses > 0)
  const forms: FormFill[] = [{
    id: '8863', file: 'f8863.pdf', title: 'Form 8863',
    values: { ...p1, ...(students[0] ? form8863Student(ret, students[0]) : {}) }
  }]
  students.slice(1).forEach((st, i) => forms.push({
    id: `8863-p3-${i + 2}`, file: 'f8863.pdf', title: `Form 8863, Part III (${st.name || `student ${i + 2}`})`,
    values: form8863Student(ret, st), pages: [1]
  }))
  return forms
}

// ── Form 1040-V ──────────────────────────────────────────────────────────────
function form1040V(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const c = ret.contact
  const joint = ret.filingStatus === 'mfj'
  return {
    id: '1040v', file: 'f1040v.pdf', title: 'Form 1040-V (payment voucher)',
    values: {
      'f1_1[0]': digits(ret.taxpayer.ssn), 'f1_2[0]': joint ? digits(ret.spouse.ssn) : '',
      'f1_3[0]': res.f1040['37'].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'f1_5[0]': ret.taxpayer.firstName, 'f1_6[0]': ret.taxpayer.lastName,
      'f1_7[0]': joint ? ret.spouse.firstName : '', 'f1_8[0]': joint ? ret.spouse.lastName : '',
      'f1_9[0]': c.street, 'f1_10[0]': c.apt, 'f1_11[0]': c.city, 'f1_12[0]': c.state, 'f1_13[0]': zip(c.zip)
    }
  }
}

/** Every form this return needs, in IRS attachment-sequence order. */
export function buildPacket2025(ret: TaxReturnInput, res: TaxReturnResult): FormPacket {
  const f = res.f1040
  const onlyDistributions = ret.capitalTransactions.length === 0 &&
    ret.capitalLossCarryover.shortTerm === 0 && ret.capitalLossCarryover.longTerm === 0
  const needD = !onlyDistributions || f['7a'] < 0
  const forms: FormFill[] = [form1040(ret, res, needD)]
  if (res.schedule1.additionalIncome !== 0 || res.schedule1.totalAdjustments > 0) forms.push(schedule1(ret, res))
  if (res.schedule1A.total > 0) forms.push(schedule1A(ret, res))
  if (res.schedule2.total > 0) forms.push(schedule2(ret, res))
  if (res.schedule3.dependentCare + res.schedule3.education + res.schedule3.excessSocialSecurity > 0) forms.push(schedule3(ret, res))
  if (res.deduction.used === 'itemized') forms.push(scheduleA(ret, res))
  if (res.scheduleB.required) forms.push(scheduleB(ret, res))
  if (needD && (ret.capitalTransactions.length || f['7a'] !== 0)) forms.push(scheduleD(ret, res))
  for (const owner of ['taxpayer', 'spouse'] as Owner[]) {
    const se = scheduleSE(ret, res, owner)
    if (se) forms.push(se)
  }
  if (res.form2441.credit > 0 || res.form2441.partIII) forms.push(form2441(ret, res))
  if (res.eic.credit > 0 && res.eic.qualifyingChildren > 0) forms.push(scheduleEIC(ret))
  if (res.schedule8812.creditBeforePhaseout > 0) forms.push(schedule8812(ret, res))
  if (res.form8863.aotc + res.form8863.llc > 0) forms.push(...form8863(ret, res))
  if (res.qbi.deduction > 0) forms.push(form8995(ret, res))
  if (res.schedule2.additionalMedicareTax > 0 || f['25c'] > 0) forms.push(form8959(ret, res))
  if (res.schedule2.netInvestmentIncomeTax > 0) forms.push(form8960(ret, res))
  if (f['37'] > 0) forms.push(form1040V(ret, res))

  const notIncluded: string[] = []
  if (res.scheduleC.length) notIncluded.push('Schedule C (Profit or Loss From Business) for each business')
  if (ret.dependents.length > 4) notIncluded.push('A statement listing dependents after the fourth')
  return { forms, notIncluded }
}
