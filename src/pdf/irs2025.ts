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
import { gainOf, groups8949, lineFor, scheduleDLines, withDefaults } from '../engine/capital.ts'
import type { ScheduleDLine } from '../engine/capital.ts'

export type FieldValue = string | boolean
export interface FormFill {
  id: string
  file: string
  title: string
  values: Record<string, FieldValue>
  /** Zero-based pages to include; all pages when omitted. */
  pages?: number[]
}
/** Paid preparer details printed on Form 1040 page 2. Matches the app's preparer profile. */
export interface PreparerInfo {
  name: string
  ptin: string
  selfEmployed: boolean
  firmName: string
  firmEin: string
  firmAddress: string
  phone: string
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
function form1040(ret: TaxReturnInput, res: TaxReturnResult, attachScheduleD: boolean, preparer?: PreparerInfo | null): FormFill {
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
    'f2_36[0]': amt(f['38']),
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

  // Identity Protection PINs
  if (digits(ret.taxpayer.ipPin).length === 6) v['f2_41[0]'] = digits(ret.taxpayer.ipPin)
  if (joint && digits(ret.spouse.ipPin).length === 6) v['f2_43[0]'] = digits(ret.spouse.ipPin)

  // Third party designee
  const d = ret.designee
  if (d.enabled && d.name.trim()) {
    Object.assign(v, { 'c2_17[0]': true, 'c2_17[1]': false, 'f2_37[0]': d.name, 'f2_38[0]': d.phone, 'f2_39[0]': digits(d.pin).slice(0, 5) })
  } else {
    Object.assign(v, { 'c2_17[0]': false, 'c2_17[1]': true })
  }

  // Paid preparer
  if (ret.usePaidPreparer && preparer && preparer.name.trim()) {
    const ein = digits(preparer.firmEin)
    Object.assign(v, {
      'f2_46[0]': preparer.name, 'f2_47[0]': preparer.ptin.toUpperCase(), 'c2_18[0]': preparer.selfEmployed,
      'f2_48[0]': preparer.firmName || (preparer.selfEmployed ? 'Self-employed' : ''), 'f2_49[0]': preparer.phone,
      'f2_50[0]': preparer.firmAddress, 'f2_51[0]': ein.length === 9 ? `${ein.slice(0, 2)}-${ein.slice(2)}` : ''
    })
  }
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
      'f1_08[0]': amt(s.otherGains), 'Page1[0].c1_1[0]': s.otherGains !== 0,
      'f1_09[0]': amt(s.rentalIncome),
      'f1_12[0]': amt(s.unemployment),
      'f1_18[0]': amt(s.hsaTaxable),
      'f1_35[0]': s.otherIncome ? 'Other income' : '',
      'f1_36[0]': amt(s.otherIncome),
      'f1_37[0]': amt(s.otherIncome + s.hsaTaxable),
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
      'f1_12[0]': amt(s.amt),
      'f1_13[0]': amt(s.amt),
      'f1_15[0]': amt(s.selfEmploymentTax),
      'f1_19[0]': amt(s.earlyDistributionTax + s.hsaExcessTax),
      'Line8_ReadOrder[0].c1_6[0]': s.earlyDistributionTax + s.hsaExcessTax > 0 && !res.form5329.some((f) => f.required),
      'f1_22[0]': amt(s.additionalMedicareTax),
      'f1_23[0]': amt(s.netInvestmentIncomeTax),
      'f2_04[0]': amt(s.hsaAdditionalTax),
      'f2_21[0]': amt(s.hsaAdditionalTax),
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
      'f1_06[0]': amt(s.saversCredit),
      'f1_25[0]': amt(s.dependentCare + s.education + s.saversCredit),
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
  const k1Payers = ret.k1s.filter((k) => ret.filingStatus === 'mfj' || k.owner === 'taxpayer')
  rows([...ret.interest.map((x) => ({ payer: x.payer, n: x.interest })), ...k1Payers.map((k) => ({ payer: `${k.entityName || 'Schedule K-1'} (K-1)`, n: k.interest }))], 14, (x) => x.payer, (x) => x.n).forEach(([name, n], i) => {
    v[`f1_${String(3 + 2 * i).padStart(2, '0')}[0]`] = name
    v[`f1_${String(4 + 2 * i).padStart(2, '0')}[0]`] = amt(n)
  })
  v['f1_31[0]'] = amt(res.f1040['2b'])
  v['f1_33[0]'] = amt(res.f1040['2b'])
  rows([...ret.dividends.map((x) => ({ payer: x.payer, n: x.ordinaryDividends })), ...k1Payers.map((k) => ({ payer: `${k.entityName || 'Schedule K-1'} (K-1)`, n: k.ordinaryDividends }))], 15, (x) => x.payer, (x) => x.n).forEach(([name, n], i) => {
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
  const L = scheduleDLines(ret.capitalTransactions)
  const capDist = ret.dividends.reduce((s, x) => s + x.capitalGainDistributions, 0)
  const line16 = d.net
  const v: Record<string, FieldValue> = {
    ...header(ret, 'f1_1[0]', 'f1_2[0]'),
    'Page1[0].c1_1[1]': true,
    'f1_21[0]': paren(ret.capitalLossCarryover.shortTerm),
    'f1_22[0]': amt(d.shortTerm, true),
    'f1_20[0]': amt(res.k1.shortTermGain),
    'f1_39[0]': amt(res.form4797.scheduleDGain),
    'f1_40[0]': amt(res.k1.longTermGain),
    'f1_41[0]': amt(capDist),
    'f1_42[0]': paren(ret.capitalLossCarryover.longTerm),
    'f1_43[0]': amt(d.longTerm, true),
    'f2_1[0]': amt(line16, true)
  }
  // Columns (d) proceeds, (e) basis, (g) adjustments, (h) gain for lines 1a–3 and 8a–10.
  const rows: [ScheduleDLine, number][] = [['1a', 3], ['1b', 7], ['2', 11], ['3', 15], ['8a', 23], ['8b', 27], ['9', 31], ['10', 35]]
  const any = (l: ScheduleDLine): boolean => ret.capitalTransactions.some((t) => lineFor(withDefaults(t)) === l)
  for (const [line, first] of rows) {
    if (!any(line)) continue
    const t = L[line]
    v[`f1_${first}[0]`] = amt(t.proceeds, true)
    v[`f1_${first + 1}[0]`] = amt(t.basis, true)
    if (line !== '1a' && line !== '8a') v[`f1_${first + 2}[0]`] = amt(t.adjustment)
    v[`f1_${first + 3}[0]`] = amt(t.gain, true)
  }
  if (line16 > 0) {
    const bothGains = d.longTerm > 0
    v['Page2[0].c2_1[0]'] = bothGains
    v['Page2[0].c2_1[1]'] = !bothGains
    if (bothGains) {
      v['f2_3[0]'] = amt(res.scheduleD19)
      v['Page2[0].c2_2[0]'] = res.scheduleD19 === 0
      v['Page2[0].c2_2[1]'] = res.scheduleD19 > 0
    }
  }
  if (line16 < 0) v['f2_4[0]'] = paren(res.f1040['7a'])
  if (line16 <= 0 || d.longTerm <= 0) {
    v['Page2[0].c2_3[0]'] = res.f1040['3a'] > 0
    v['Page2[0].c2_3[1]'] = res.f1040['3a'] <= 0
  }
  return { id: 'sd', file: 'f1040sd.pdf', title: 'Schedule D', values: v }
}


// ── Form 8949 (one page per box, 11 sales per page) ──────────────────────────
function form8949(ret: TaxReturnInput): FormFill[] {
  const out: FormFill[] = []
  const two = (n: number): string => String(n).padStart(2, '0')
  const date = (v: string): string => v.trim().toUpperCase()
  for (const g of groups8949(ret.capitalTransactions)) {
    const page = g.part === 'short' ? 1 : 2
    const boxIndex = 'ABCGHI'.includes(g.box) ? 'ABCGHI'.indexOf(g.box) : 'DEFJKL'.indexOf(g.box)
    for (let start = 0; start < g.rows.length; start += 11) {
      const chunk = g.rows.slice(start, start + 11)
      const p = `f${page}_`
      const v: Record<string, FieldValue> = { ...header(ret, `${p}01[0]`, `${p}02[0]`) }
      v[`Page${page}[0].c${page}_1[${boxIndex}]`] = true
      chunk.forEach((t, i) => {
        const f = (k: number): string => `${p}${two(3 + 8 * i + k)}[0]`
        v[f(0)] = t.description; v[f(1)] = date(t.dateAcquired); v[f(2)] = date(t.dateSold)
        v[f(3)] = amt(t.proceeds, true); v[f(4)] = amt(t.costBasis, true)
        v[f(5)] = t.adjustmentCode.trim().toUpperCase(); v[f(6)] = amt(t.adjustment)
        v[f(7)] = amt(gainOf(t), true)
      })
      const tot = { proceeds: chunk.reduce((s, t) => s + t.proceeds, 0), basis: chunk.reduce((s, t) => s + t.costBasis, 0), adj: chunk.reduce((s, t) => s + (t.adjustment || 0), 0), gain: chunk.reduce((s, t) => s + gainOf(t), 0) }
      Object.assign(v, { [`${p}91[0]`]: amt(tot.proceeds, true), [`${p}92[0]`]: amt(tot.basis, true), [`${p}94[0]`]: amt(tot.adj), [`${p}95[0]`]: amt(tot.gain, true) })
      const n = out.length + 1
      out.push({ id: n === 1 ? '8949' : `8949-${n}`, file: 'f8949.pdf', title: `Form 8949 (Box ${g.box}${g.rows.length > 11 ? `, page ${start / 11 + 1}` : ''})`, values: v, pages: [page - 1] })
    }
  }
  return out
}

// ── Form 4797 ────────────────────────────────────────────────────────────────
function form4797Forms(ret: TaxReturnInput, res: TaxReturnResult): FormFill[] {
  const f = res.form4797
  if (!f.sales.length && !f.k1Section1231.length) return []
  const date = (x: string): string => x.trim()
  const v: Record<string, FieldValue> = { ...header(ret, 'f1_1[0]', 'f1_2[0]'), 'f1_3[0]': amt(f.line1a) }
  // Part I line 2 and Part II line 10: up to four rows each; columns (a)–(g).
  const row = (first: number, x: TaxReturnResult['form4797']['sales'][number]): void => {
    const k = (n: number): string => `f1_${first + n}[0]`
    v[k(0)] = x.description; v[k(1)] = date(x.dateAcquired); v[k(2)] = date(x.dateSold); v[k(3)] = amt(x.salesPrice, true)
    v[k(4)] = amt(x.depreciation); v[k(5)] = amt(x.costBasis, true); v[k(6)] = amt(x.gain, true)
  }
  const partI = f.sales.filter((x) => x.part === 'I')
  partI.slice(0, 4).forEach((x, i) => row(6 + 7 * i, x))
  f.k1Section1231.slice(0, Math.max(0, 4 - partI.length)).forEach((x, j) => {
    const i = partI.length + j
    v[`f1_${6 + 7 * i}[0]`] = `Schedule K-1: ${x.name}`
    v[`f1_${12 + 7 * i}[0]`] = amt(x.amount, true)
  })
  f.sales.filter((x) => x.part === 'II').slice(0, 4).forEach((x, i) => row(41 + 7 * i, x))
  Object.assign(v, {
    'f1_37[0]': amt(f.line6), 'f1_38[0]': amt(f.line7, true), 'f1_39[0]': amt(f.line8), 'f1_40[0]': amt(f.line9),
    'f1_69[0]': paren(f.line11), 'f1_70[0]': amt(f.line12), 'f1_71[0]': amt(f.line13), 'f1_75[0]': amt(f.line17, true), 'f1_77[0]': amt(f.line18b, true)
  })
  const partIII = f.sales.filter((x) => x.part === 'III')
  const sheets: FormFill[] = []
  for (let start = 0; start < Math.max(1, partIII.length); start += 4) {
    const chunk = partIII.slice(start, start + 4)
    const p2: Record<string, FieldValue> = start === 0 ? v : {}
    chunk.forEach((x, col) => {
      p2[`f2_${1 + 3 * col}[0]`] = x.description; p2[`f2_${2 + 3 * col}[0]`] = date(x.dateAcquired); p2[`f2_${3 + 3 * col}[0]`] = date(x.dateSold)
      const line = (first: number, value: string): void => { p2[`f2_${first + col}[0]`] = value }
      line(13, amt(x.salesPrice, true)); line(17, amt(x.costBasis, true)); line(21, amt(x.depreciation, true)); line(25, amt(x.adjustedBasis, true)); line(29, amt(x.gain, true))
      if (x.kind === '1245') { line(33, amt(x.depreciation, true)); line(37, amt(x.recapture, true)) }
      if (x.kind === '1250') { line(41, '0'); line(65, '0') }
    })
    if (start === 0) Object.assign(p2, { 'f2_97[0]': amt(f.line30), 'f2_98[0]': amt(f.line31), 'f2_99[0]': amt(f.line32) })
    if (start > 0) sheets.push({ id: `4797-${start / 4 + 1}`, file: 'f4797.pdf', title: `Form 4797 (Part III, sheet ${start / 4 + 1})`, values: { ...header(ret, 'f1_1[0]', 'f1_2[0]'), ...p2 }, pages: [1] })
  }
  const pages = partIII.length ? [0, 1] : [0]
  return [{ id: '4797', file: 'f4797.pdf', title: 'Form 4797', values: v, pages }, ...sheets]
}

// ── Form 8582 ────────────────────────────────────────────────────────────────
function form8582Fill(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const f = res.form8582
  const v: Record<string, FieldValue> = { 'f1_01[0]': namesOnReturn(ret), 'f1_02[0]': ssnDashed(ret.taxpayer.ssn) }
  Object.assign(v, {
    'f1_03[0]': amt(f.line1a), 'f1_04[0]': amt(f.line1b), 'f1_05[0]': amt(f.line1c), 'f1_06[0]': amt(f.line1d),
    'f1_07[0]': amt(f.line2a), 'f1_08[0]': amt(f.line2b), 'f1_09[0]': amt(f.line2c), 'f1_10[0]': amt(f.line2d),
    'f1_11[0]': amt(f.line3, true)
  })
  if (f.line3 < 0) {
    if (f.line4 > 0) Object.assign(v, { 'f1_12[0]': amt(f.line4), 'f1_13[0]': amt(f.line5), 'f1_14[0]': amt(f.line6), 'f1_15[0]': amt(f.line7), 'f1_16[0]': amt(f.line8), 'f1_17[0]': amt(f.line9, true) })
    Object.assign(v, { 'f1_18[0]': amt(f.line10, true), 'f1_19[0]': amt(f.line11, true) })
  }
  const two = (n: number): string => String(n).padStart(2, '0')
  const table = (rows: typeof f.activities, first: number, page: 1 | 2, total: number): void => {
    rows.slice(0, 5).forEach((x, i) => {
      const k = (n: number): string => `f${page}_${two(first + 6 * i + n)}[0]`
      Object.assign(v, { [k(0)]: x.name, [k(1)]: amt(x.a), [k(2)]: amt(x.b), [k(3)]: amt(x.c), [k(4)]: amt(x.d), [k(5)]: amt(x.e) })
    })
    const sumOf = (key: 'a' | 'b' | 'c' | 'd' | 'e'): number => rows.reduce((t, x) => t + x[key], 0)
    ;(['a', 'b', 'c', 'd', 'e'] as const).forEach((key, n) => { v[`f${page}_${two(total + n)}[0]`] = amt(sumOf(key)) })
  }
  const rent = f.activities.filter((x) => x.group === 'rental')
  const other = f.activities.filter((x) => x.group === 'other')
  if (rent.length) table(rent, 20, 1, 50)
  if (other.length) table(other, 1, 2, 31)
  const ratio = (n: number): string => n.toFixed(2)
  f.partVI.slice(0, 5).forEach((x, i) => {
    const k = (n: number): string => `f2_${36 + 6 * i + n}[0]`
    Object.assign(v, { [k(0)]: x.name, [k(1)]: x.reportedOn, [k(2)]: amt(x.loss, true), [k(3)]: ratio(x.ratio), [k(4)]: amt(x.allowance, true), [k(5)]: amt(x.net, true) })
  })
  if (f.partVI.length) Object.assign(v, { 'f2_66[0]': amt(f.partVI.reduce((t, x) => t + x.loss, 0), true), 'f2_68[0]': amt(f.line9, true), 'f2_69[0]': amt(f.partVI.reduce((t, x) => t + x.net, 0), true) })
  f.partVII.slice(0, 5).forEach((x, i) => {
    const k = (n: number): string => `f2_${70 + 5 * i + n}[0]`
    Object.assign(v, { [k(0)]: x.name, [k(1)]: x.reportedOn, [k(2)]: amt(x.loss, true), [k(3)]: ratio(x.ratio), [k(4)]: amt(x.unallowed, true) })
  })
  if (f.partVII.length) Object.assign(v, { 'f2_95[0]': amt(f.partVII.reduce((t, x) => t + x.loss, 0), true), 'f2_97[0]': amt(f.unallowed, true) })
  const losers = f.activities.filter((x) => x.e > 0 && f.line3 < 0)
  losers.slice(0, 5).forEach((x, i) => {
    const k = (n: number): number => 98 + 5 * i + n
    Object.assign(v, { [`f2_${k(0)}[0]`]: x.name, [`f2_${k(1)}[0]`]: x.reportedOn, [`f2_${k(2)}[0]`]: amt(x.e, true), [`f2_${k(3)}[0]`]: amt(x.unallowed, true), [`f2_${k(4)}[0]`]: amt(x.e - x.unallowed, true) })
  })
  if (losers.length) Object.assign(v, { 'f2_123[0]': amt(losers.reduce((t, x) => t + x.e, 0), true), 'f2_124[0]': amt(f.unallowed, true), 'f2_125[0]': amt(losers.reduce((t, x) => t + x.e - x.unallowed, 0), true) })
  return { id: '8582', file: 'f8582.pdf', title: 'Form 8582', values: v, pages: [0, 1] }
}

// ── Form 8829 (one per business using the regular method) ──────────────────
function form8829(ret: TaxReturnInput, res: TaxReturnResult, b: TaxReturnInput['businesses'][number]): FormFill | null {
  const c = res.scheduleC.find((x) => x.id === b.id)
  if (!c || c.homeOffice.method !== 'regular' || !c.homeOffice.lines['2']) return null
  const L = c.homeOffice.lines
  const person = b.owner === 'spouse' ? ret.spouse : ret.taxpayer
  const pct = (n: number): string => (Math.round(n * 10000) / 100).toFixed(2)
  const v: Record<string, FieldValue> = {
    'f1_01[0]': fullName(person), 'f1_02[0]': ssnDashed(person.ssn),
    'f1_03[0]': amt(L['1'], true), 'f1_04[0]': amt(L['2'], true), 'f1_05[0]': pct(L['3']), 'f1_09[0]': pct(L['7']),
    'f1_10[0]': amt(L['8'], true),
    'f1_14[0]': amt(L['10b']), 'f1_16[0]': amt(L['11b']), 'f1_18[0]': amt(L['12b']), 'f1_19[0]': amt(L['13']),
    'f1_20[0]': amt(L['14'], true), 'f1_21[0]': amt(L['15'], true),
    'f1_23[0]': amt(L['16b']), 'f1_25[0]': amt(L['17b']), 'f1_27[0]': amt(L['18b']), 'f1_29[0]': amt(L['19b']),
    'f1_31[0]': amt(L['20b']), 'f1_33[0]': amt(L['21b']), 'f1_35[0]': amt(L['22b']), 'f1_37[0]': amt(L['23b']),
    'f1_38[0]': amt(L['24'], true), 'f1_39[0]': amt(L['25']), 'f1_40[0]': amt(L['26'], true), 'f1_41[0]': amt(L['27'], true),
    'f1_42[0]': amt(L['28'], true), 'f1_44[0]': amt(L['30']), 'f1_45[0]': amt(L['31']), 'f1_46[0]': amt(L['32'], true),
    'f1_47[0]': amt(L['33'], true), 'f1_48[0]': amt(L['34'], true), 'f1_50[0]': amt(L['36'], true),
    'f1_57[0]': amt(L['43'], true), 'f1_58[0]': amt(L['44'], true)
  }
  if ((L['37'] ?? 0) > 0) {
    Object.assign(v, {
      'f1_51[0]': amt(L['37'], true), 'f1_52[0]': amt(L['38'], true), 'f1_53[0]': amt(L['39'], true), 'f1_54[0]': amt(L['40'], true),
      'f1_55[0]': L['41'].toFixed(3), 'f1_56[0]': amt(L['42'], true)
    })
  }
  return { id: `8829-${b.id}`, file: 'f8829.pdf', title: `Form 8829 (${c.name})`, values: v }
}

// ── Form 4562 (one per business or rental that needs it, plus a Summary for section 179) ──
const ROW_19: Record<string, number> = { '3': 26, '5': 32, '7': 38, '10': 44, '15': 50, '20': 56 }
function form4562(ret: TaxReturnInput, res: TaxReturnResult, f: TaxReturnResult['form4562'][number], part1: 'full' | 'line12' | 'none'): FormFill {
  const owner = f.kind === 'business' ? ret.businesses.find((b) => b.id === f.id)?.owner : ret.rentals.find((p) => p.id === f.id)?.owner
  const v: Record<string, FieldValue> = {
    'f1_1[0]': namesOnReturn(ret), 'f1_2[0]': f.kind === 'business' ? `Schedule C: ${f.name}` : `Schedule E: ${f.name}`,
    'f1_3[0]': ssnDashed((owner === 'spouse' ? ret.spouse : ret.taxpayer).ssn)
  }
  if (part1 === 'full') Object.assign(v, part1Values(res, f.elected, f.line29))
  if (part1 === 'line12') v['f1_20[0]'] = amt(f.section179, true)
  Object.assign(v, { 'f1_22[0]': amt(f.line14), 'f1_24[0]': amt(f.line16), 'f1_25[0]': amt(f.line17) })
  let resi = 0
  let nonres = 0
  for (const row of f.rows) {
    if (row.propertyClass === '27.5' || row.propertyClass === '39') {
      const slots = row.propertyClass === '27.5' ? [[74, 75, 79], [80, 81, 85]] : [[86, 87, 91], [92, 93, 97]]
      const k = row.propertyClass === '27.5' ? resi++ : nonres++
      const slot = slots[k]
      if (!slot) continue
      v[`f1_${slot[0]}[0]`] = row.placed; v[`f1_${slot[1]}[0]`] = amt(row.basis, true); v[`f1_${slot[2]}[0]`] = amt(row.deduction, true)
      continue
    }
    const first = ROW_19[row.propertyClass]
    v[`f1_${first + 1}[0]`] = amt(row.basis, true)
    v[`f1_${first + 2}[0]`] = row.period
    v[`f1_${first + 3}[0]`] = row.convention
    v[`f1_${first + 4}[0]`] = row.method
    v[`f1_${first + 5}[0]`] = amt(row.deduction, true)
  }
  if (f.home) {
    const slot = [[86, 87, 91], [92, 93, 97]][nonres]
    if (slot) { v[`f1_${slot[0]}[0]`] = f.home.placed; v[`f1_${slot[1]}[0]`] = amt(f.home.basis, true); v[`f1_${slot[2]}[0]`] = amt(f.home.deduction, true) }
  }
  // Part V — listed property
  if (f.listed.length) {
    v['f2_1[0]'] = amt(f.line28)
    const vehicles = f.listed.filter((x) => x.vehicle)
    const ev = vehicles[0]?.vehicle
    if (ev) { v['c2_1[0]'] = ev.evidence; v['c2_1[1]'] = !ev.evidence; if (ev.evidence) { v['c2_2[0]'] = ev.evidenceWritten; v['c2_2[1]'] = !ev.evidenceWritten } }
    v['f2_5[0]'] = amt(f.line25)
    f.listed.filter((x) => x.qualified).slice(0, 3).forEach((x, i) => {
      const k = (n: number): string => `f2_${6 + 9 * i + n}[0]`
      Object.assign(v, { [k(0)]: x.description, [k(1)]: x.placed, [k(2)]: String(x.businessPct), [k(3)]: amt(x.cost, true), [k(4)]: amt(x.basis, true), [k(5)]: x.period, [k(6)]: x.method, [k(7)]: amt(x.deduction, true), [k(8)]: amt(x.section179) })
    })
    f.listed.filter((x) => !x.qualified).slice(0, 3).forEach((x, i) => {
      const k = (n: number): string => `f2_${33 + 8 * i + n}[0]`
      Object.assign(v, { [k(0)]: x.description, [k(1)]: x.placed, [k(2)]: String(x.businessPct), [k(3)]: amt(x.cost, true), [k(4)]: amt(x.basis, true), [k(5)]: x.period, [k(6)]: x.method.replace(/^S\/L\//, ''), [k(7)]: amt(x.deduction, true) })
    })
    v['f2_57[0]'] = amt(f.line28, true)
    v['f2_58[0]'] = amt(f.line29)
    vehicles.slice(0, 6).forEach((x, i) => {
      const m = x.vehicle!
      const total = m.businessMiles + m.commutingMiles + m.otherMiles
      Object.assign(v, {
        [`f2_${59 + i}[0]`]: amt(m.businessMiles, true), [`f2_${65 + i}[0]`]: amt(m.commutingMiles, true), [`f2_${71 + i}[0]`]: amt(m.otherMiles, true), [`f2_${77 + i}[0]`]: amt(total, true),
        [`c2_${4 + i}[0]`]: m.availableOffDuty, [`c2_${4 + i}[1]`]: !m.availableOffDuty,
        [`c2_${10 + i}[0]`]: m.ownerUse, [`c2_${10 + i}[1]`]: !m.ownerUse,
        [`c2_${16 + i}[0]`]: m.anotherVehicle, [`c2_${16 + i}[1]`]: !m.anotherVehicle
      })
    })
  }
  v['f2_2[0]'] = amt(f.line22, true)
  return { id: `4562-${f.id}`, file: 'f4562.pdf', title: `Form 4562 (${f.name})`, values: v, pages: [0, 1] }
}

function part1Values(res: TaxReturnResult, elected: { description: string; cost: number; elected: number }[], listed179 = 0): Record<string, FieldValue> {
  const s = res.section179
  const v: Record<string, FieldValue> = {
    'f1_15[0]': amt(listed179),
    'f1_4[0]': amt(s.line1, true), 'f1_5[0]': amt(s.line2, true), 'f1_6[0]': amt(s.line3, true), 'f1_7[0]': amt(s.line4, true),
    'f1_8[0]': amt(s.line5, true), 'f1_16[0]': amt(s.line8, true), 'f1_17[0]': amt(s.line9, true), 'f1_18[0]': amt(s.line10),
    'f1_19[0]': amt(s.line11, true), 'f1_20[0]': amt(s.line12, true), 'f1_21[0]': amt(s.line13)
  }
  elected.slice(0, 2).forEach((e, i) => {
    v[`f1_${9 + 3 * i}[0]`] = elected.length > 2 && i === 1 ? `${e.description} and ${elected.length - 2} more (see statement)` : e.description
    v[`f1_${10 + 3 * i}[0]`] = amt(i === 1 && elected.length > 2 ? elected.slice(1).reduce((t, x) => t + x.cost, 0) : e.cost, true)
    v[`f1_${11 + 3 * i}[0]`] = amt(i === 1 && elected.length > 2 ? elected.slice(1).reduce((t, x) => t + x.elected, 0) : e.elected, true)
  })
  return v
}

function forms4562(ret: TaxReturnInput, res: TaxReturnResult): FormFill[] {
  const needed = res.form4562.filter((f) => f.required)
  const with179 = needed.filter((f) => f.elected.length > 0 || f.section179 > 0 || f.line29 > 0)
  const out: FormFill[] = []
  if (with179.length > 1) {
    const all = with179.flatMap((f) => f.elected)
    out.push({
      id: '4562-summary', file: 'f4562.pdf', title: 'Form 4562 (Summary, Part I)', pages: [0],
      values: { 'f1_1[0]': namesOnReturn(ret), 'f1_2[0]': 'Summary', 'f1_3[0]': ssnDashed(ret.taxpayer.ssn), ...part1Values(res, all, with179.reduce((t, x) => t + x.line29, 0)) }
    })
  }
  for (const f of needed) {
    const part1 = with179.includes(f) ? (with179.length > 1 ? 'line12' : 'full') : 'none'
    out.push(form4562(ret, res, f, part1))
  }
  return out
}

// ── Schedule C (one per business) ────────────────────────────────────────────
function scheduleC(ret: TaxReturnInput, res: TaxReturnResult, b: TaxReturnInput['businesses'][number]): FormFill {
  const person = b.owner === 'spouse' ? ret.spouse : ret.taxpayer
  const c = res.scheduleC.find((x) => x.id === b.id)
  const e = b.expenses
  const line3 = b.grossReceipts - b.returnsAndAllowances
  const line5 = line3 - b.costOfGoodsSold
  const line7 = line5 + b.otherIncome
  const line28 = c ? c.totalExpenses : Object.entries(e).filter(([k]) => k !== 'homeOffice').reduce((t, [, n]) => t + n, 0)
  const line29 = c ? c.tentativeProfit : line7 - line28
  const line30 = c ? c.homeOffice.deduction : 0
  const line31 = c ? c.netProfit : line29 - line30
  const v: Record<string, FieldValue> = {
    'f1_1[0]': fullName(person), 'f1_2[0]': ssnDashed(person.ssn),
    'f1_3[0]': b.activity, 'f1_4[0]': digits(b.businessCode), 'f1_5[0]': b.name,
    'f1_6[0]': digits(b.ein), 'f1_7[0]': b.address, 'f1_8[0]': b.cityStateZip,
    'Page1[0].c1_1[0]': b.accountingMethod === 'cash', 'Page1[0].c1_1[1]': b.accountingMethod === 'accrual',
    'Page1[0].c1_2[0]': b.materiallyParticipated, 'Page1[0].c1_2[1]': !b.materiallyParticipated,
    'Page1[0].c1_3[0]': b.startedThisYear,
    'Page1[0].c1_4[0]': b.required1099s === true, 'Page1[0].c1_4[1]': b.required1099s === false,
    // Part I
    'f1_10[0]': amt(b.grossReceipts, true), 'f1_11[0]': amt(b.returnsAndAllowances), 'f1_12[0]': amt(line3, true),
    'f1_13[0]': amt(b.costOfGoodsSold), 'f1_14[0]': amt(line5, true), 'f1_15[0]': amt(b.otherIncome), 'f1_16[0]': amt(line7, true),
    // Part II
    'f1_17[0]': amt(e.advertising), 'f1_18[0]': amt(e.carAndTruck), 'f1_20[0]': amt(e.contractLabor),
    'f1_22[0]': amt(c?.depreciation ?? 0), 'f1_24[0]': amt(e.insurance), 'f1_27[0]': amt(e.legalAndProfessional), 'f1_28[0]': amt(e.office),
    'f1_31[0]': amt(e.rentOrLease), 'f1_33[0]': amt(e.supplies), 'f1_34[0]': amt(e.taxesAndLicenses),
    'f1_35[0]': amt(e.travel), 'f1_36[0]': amt(e.meals), 'f1_37[0]': amt(e.utilities), 'f1_39[0]': amt(e.other),
    'f1_41[0]': amt(line28, true), 'f1_42[0]': amt(line29, true), 'f1_45[0]': amt(line30), 'f1_46[0]': amt(line31, true)
  }
  if (b.required1099s) { v['Page1[0].c1_5[0]'] = b.filed1099s; v['Page1[0].c1_5[1]'] = !b.filed1099s }
  if (b.homeOffice.method === 'simplified' && line30 > 0) {
    v['Line30_ReadOrder[0].f1_43[0]'] = amt(b.homeOffice.homeSqFt)
    v['Line30_ReadOrder[0].f1_44[0]'] = amt(Math.min(b.homeOffice.officeSqFt, R.HOME_OFFICE_SIMPLIFIED_MAX_SQFT))
  }
  if (line31 < 0) { v['Page1[0].c1_7[0]'] = b.allAtRisk; v['Page1[0].c1_7[1]'] = !b.allAtRisk }
  if (b.costOfGoodsSold > 0) v['f2_8[0]'] = amt(b.costOfGoodsSold)
  // Part IV only when no Form 4562 is filed for the vehicle.
  if (e.carAndTruck > 0 && !(b.assets ?? []).some((a) => a.listed === 'auto' || a.listed === 'heavy')) {
    const [mm, dd, yy] = b.vehicle.placedInService.split('/').map((x) => x.trim())
    Object.assign(v, {
      'f2_9[0]': mm ?? '', 'f2_10[0]': dd ?? '', 'f2_11[0]': yy ?? '',
      'f2_12[0]': amt(b.vehicle.businessMiles, true), 'f2_13[0]': amt(b.vehicle.commutingMiles, true), 'f2_14[0]': amt(b.vehicle.otherMiles, true),
      'Page2[0].c2_5[0]': b.vehicle.availableOffDuty, 'Page2[0].c2_5[1]': !b.vehicle.availableOffDuty,
      'Page2[0].c2_6[0]': b.vehicle.anotherVehicle, 'Page2[0].c2_6[1]': !b.vehicle.anotherVehicle,
      'Page2[0].c2_7[0]': b.vehicle.hasEvidence, 'Page2[0].c2_7[1]': !b.vehicle.hasEvidence
    })
    if (b.vehicle.hasEvidence) { v['Page2[0].c2_8[0]'] = b.vehicle.evidenceWritten; v['Page2[0].c2_8[1]'] = !b.vehicle.evidenceWritten }
  }
  if (e.other > 0) Object.assign(v, { 'f2_15[0]': 'Other business expenses', 'f2_16[0]': amt(e.other), 'f2_33[0]': amt(e.other) })
  return { id: `sc-${b.id}`, file: 'f1040sc.pdf', title: `Schedule C (${b.name || 'business'})`, values: v }
}

// ── Schedule SE (one per person) ─────────────────────────────────────────────
function scheduleSE(ret: TaxReturnInput, res: TaxReturnResult, owner: Owner): FormFill | null {
  const se = res.scheduleSE.find((x) => x.owner === owner)
  if (!se) return null
  const person = owner === 'spouse' ? ret.spouse : ret.taxpayer
  const profit = res.scheduleC.filter((b) => b.owner === owner).reduce((s, b) => s + b.netProfit, 0) + res.k1.seEarnings[owner]
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
  const line13 = Math.max(0, res.f1040['18'] - res.schedule3.dependentCare - res.schedule3.education - res.schedule3.saversCredit)
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

// ── Form 8995 / 8995-A ───────────────────────────────────────────────────────
const businessTin = (ret: TaxReturnInput, id: string): string => {
  const b = ret.businesses.find((x) => x.id === id)
  if (!b) return ''
  const ein = digits(b.ein)
  if (ein.length === 9) return `${ein.slice(0, 2)}-${ein.slice(2)}`
  return ssnDashed((b.owner === 'spouse' ? ret.spouse : ret.taxpayer).ssn)
}

function form8995(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const q = res.qbi
  const two = (n: number): string => String(n).padStart(2, '0')
  const v: Record<string, FieldValue> = { ...header(ret, 'f1_01[0]', 'f1_02[0]') }
  q.businesses.slice(0, 5).forEach((b, i) => {
    v[`f1_${two(3 + 3 * i)}[0]`] = b.name
    v[`f1_${two(4 + 3 * i)}[0]`] = businessTin(ret, b.id)
    v[`f1_${two(5 + 3 * i)}[0]`] = amt(b.line2, true)
  })
  const line2 = q.totalQbi
  const line4 = Math.max(0, line2 - q.priorLoss)
  const line8 = Math.max(0, q.reitPtp - q.priorReitLoss)
  const line13 = Math.max(0, q.taxableIncomeBeforeQbi - q.netCapitalGain)
  Object.assign(v, {
    'f1_18[0]': amt(line2, true), 'f1_19[0]': paren(q.priorLoss), 'f1_20[0]': amt(line4, true), 'f1_21[0]': amt(q.qbiComponent, true),
    'f1_22[0]': amt(q.reitPtp), 'f1_23[0]': paren(q.priorReitLoss), 'f1_24[0]': amt(line8), 'f1_25[0]': amt(q.reitComponent),
    'f1_26[0]': amt(q.beforeIncomeLimit, true), 'f1_27[0]': amt(q.taxableIncomeBeforeQbi, true), 'f1_28[0]': amt(q.netCapitalGain, true),
    'f1_29[0]': amt(line13, true), 'f1_30[0]': amt(q.incomeLimit, true), 'f1_31[0]': amt(q.deduction, true),
    'f1_32[0]': paren(q.lossCarryforward), 'f1_33[0]': paren(q.reitLossCarryforward)
  })
  return { id: '8995', file: 'f8995.pdf', title: 'Form 8995', values: v }
}

/** Form 8995-A: three businesses per form; Part IV only on the first. */
function form8995a(ret: TaxReturnInput, res: TaxReturnResult): FormFill[] {
  const q = res.qbi
  const two = (n: number): string => String(n).padStart(2, '0')
  const groups: typeof q.businesses[] = []
  for (let i = 0; i < Math.max(1, q.businesses.length); i += 3) groups.push(q.businesses.slice(i, i + 3))
  return groups.map((group, gi) => {
    const v: Record<string, FieldValue> = { ...header(ret, 'f1_01[0]', 'f1_02[0]') }
    group.forEach((b, col) => {
      const row = ['RowA', 'RowB', 'RowC'][col]
      v[`Table_PartI[0].${row}[0].f1_${two(3 + 2 * col)}[0]`] = b.name
      v[`Table_PartI[0].${row}[0].f1_${two(4 + 2 * col)}[0]`] = businessTin(ret, b.id)
      v[`Table_PartI[0].${row}[0].c1_${1 + 3 * col}[0]`] = b.sstb
      // Part II: line N in column col is field 9 + 3 × (N − 2) + col.
      const line = (n: number, value: string): void => { v[`f1_${two(9 + 3 * (n - 2) + col)}[0]`] = value }
      line(2, amt(b.line2, true)); line(3, amt(b.line3, true))
      if (q.taxableIncomeBeforeQbi > q.threshold) {
        line(4, amt(b.line4, true)); line(5, amt(b.line5, true)); line(6, amt(b.line6, true)); line(7, amt(b.line7, true))
        line(8, amt(b.line8, true)); line(9, amt(b.line9, true)); line(10, amt(b.line10, true)); line(11, amt(b.line11, true))
        line(12, amt(b.line12))
      }
      line(13, amt(b.line13, true)); line(15, amt(b.line15, true))
      if (b.phase) {
        v[`f2_${two(1 + col)}[0]`] = amt(b.phase.line17, true)
        v[`f2_${two(4 + col)}[0]`] = amt(b.phase.line18, true)
        v[`f2_${two(7 + col)}[0]`] = amt(b.phase.line19, true)
        v[`f2_${two(30 + col)}[0]`] = amt(b.phase.line25, true)
        v[`f2_${two(33 + col)}[0]`] = amt(b.phase.line26, true)
      }
    })
    if (gi === 0) v['f1_51[0]'] = amt(q.qbiComponent, true)
    const p = q.phaseIn
    if (p && group.some((b) => b.phase)) {
      Object.assign(v, {
        'f2_10[0]': amt(p.line20, true), 'f2_14[0]': amt(p.line21, true), 'f2_18[0]': amt(p.line22, true),
        'f2_22[0]': amt(p.line23, true), 'f2_26[0]': (Math.round(p.pct * 10000) / 100).toFixed(2)
      })
    }
    if (gi === 0) {
      const line30 = Math.max(0, q.reitPtp - q.priorReitLoss)
      const line35 = Math.max(0, q.taxableIncomeBeforeQbi - q.netCapitalGain)
      Object.assign(v, {
        'f2_36[0]': amt(q.qbiComponent, true), 'f2_37[0]': amt(q.reitPtp), 'f2_38[0]': paren(q.priorReitLoss), 'f2_39[0]': amt(line30),
        'f2_40[0]': amt(q.reitComponent), 'f2_41[0]': amt(q.beforeIncomeLimit, true), 'f2_42[0]': amt(q.taxableIncomeBeforeQbi, true),
        'f2_43[0]': amt(q.netCapitalGain, true), 'f2_44[0]': amt(line35, true), 'f2_45[0]': amt(q.incomeLimit, true),
        'f2_46[0]': amt(q.deduction, true), 'f2_48[0]': amt(q.deduction, true), 'f2_49[0]': paren(q.reitLossCarryforward)
      })
    }
    return { id: gi === 0 ? '8995a' : `8995a-${gi + 1}`, file: 'f8995a.pdf', title: gi === 0 ? 'Form 8995-A' : `Form 8995-A (sheet ${gi + 1})`, values: v }
  })
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


// ── Form 8880 ────────────────────────────────────────────────────────────────
function form8880(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const f = res.form8880
  const v: Record<string, FieldValue> = { ...header(ret, 'f1_1[0]', 'f1_2[0]') }
  const cols: Record<string, [string, string, string, string, string, string]> = {
    taxpayer: ['f1_3[0]', 'f1_5[0]', 'f1_7[0]', 'f1_9[0]', 'f1_11[0]', 'f1_13[0]'],
    spouse: ['f1_4[0]', 'f1_6[0]', 'f1_8[0]', 'f1_10[0]', 'f1_12[0]', 'f1_14[0]']
  }
  for (const p of f.people) {
    const [l1, l2, l3, l4, l5, l6] = cols[p.owner]
    Object.assign(v, { [l1]: amt(p.ira), [l2]: amt(p.deferrals), [l3]: amt(p.line3, true), [l4]: amt(p.distributions), [l5]: amt(p.line5, true), [l6]: amt(p.line6, true) })
  }
  Object.assign(v, {
    'f1_15[0]': amt(f.line7, true), 'f1_16[0]': amt(res.f1040['11a'], true),
    'f1_17[0]': String(Math.round(f.rate * 10)), 'f1_18[0]': amt(f.tentative, true),
    'f1_19[0]': amt(f.limit, true), 'f1_20[0]': amt(f.credit, true)
  })
  return { id: '8880', file: 'f8880.pdf', title: 'Form 8880', values: v }
}


// ── Schedule E (Part I, three properties per page) ───────────────────────────
const RENTAL_TYPE_CODE: Record<string, string> = { single: '1', multi: '2', vacation: '3', commercial: '4', land: '5', royalties: '6', selfrental: '7', other: '8' }
/** Field for a Schedule E line (3–22) in column A, B or C. */
const eField = (line: number, col: number): string => {
  if (line === 21) return `f1_${71 + col}[0]`
  if (line === 22) return `f1_${74 + col}[0]`
  // Line 19 has its own description field (f1_64), so amounts from line 19 on shift by one.
  const base = line === 3 ? 16 : line === 4 ? 19 : 22 + (line - 5) * 3 + (line >= 19 ? 1 : 0)
  return `f1_${base + col}[0]`
}
function scheduleEPart2(ret: TaxReturnInput, res: TaxReturnResult): Record<string, FieldValue> {
  const k = res.k1
  const v: Record<string, FieldValue> = { 'f2_1[0]': namesOnReturn(ret), 'f2_2[0]': ssnDashed(ret.taxpayer.ssn) }
  const anyCarry = ret.k1s.some((x) => x.priorPassiveCarryover > 0)
  v['c2_1[0]'] = anyCarry; v['c2_1[1]'] = !anyCarry
  k.rows.slice(0, 4).forEach((x, i) => {
    const src = ret.k1s.find((y) => y.id === x.id)
    v[`f2_${3 + 3 * i}[0]`] = x.name
    v[`f2_${4 + 3 * i}[0]`] = x.kind === 'scorp' ? 'S' : 'P'
    v[`f2_${5 + 3 * i}[0]`] = digits(x.ein).length === 9 ? `${digits(x.ein).slice(0, 2)}-${digits(x.ein).slice(2)}` : x.ein
    v[`c2_${3 + 3 * i}[0]`] = !!src && x.kind === 'scorp' && x.net < 0
    v[`c2_${4 + 3 * i}[0]`] = !!src?.basisLimited
    v[`f2_${15 + 5 * i}[0]`] = amt(x.g)
    v[`f2_${16 + 5 * i}[0]`] = amt(x.h)
    v[`f2_${17 + 5 * i}[0]`] = amt(x.i)
    v[`f2_${18 + 5 * i}[0]`] = amt(x.j)
    v[`f2_${19 + 5 * i}[0]`] = amt(x.k)
  })
  Object.assign(v, {
    'f2_36[0]': amt(k.line29aH), 'f2_39[0]': amt(k.line29aK), 'f2_40[0]': amt(k.line29bG), 'f2_42[0]': amt(k.line29bI), 'f2_43[0]': amt(k.line29bJ),
    'f2_45[0]': amt(k.line30, true), 'f2_46[0]': paren(k.line31), 'f2_47[0]': amt(k.line32, true),
    'f2_78[0]': amt(res.schedule1.rentalIncome, true)
  })
  return v
}

function scheduleE(ret: TaxReturnInput, res: TaxReturnResult): FormFill[] {
  const e = res.scheduleE
  const props = ret.rentals.filter((p) => ret.filingStatus === 'mfj' || p.owner === 'taxpayer')
  const results = e.properties
  const positive = e.line24
  const line25 = e.line25
  const line22 = new Map(results.filter((x) => x.line22 > 0).map((x) => [x.id, x.line22]))
  const sheets: FormFill[] = []
  for (let start = 0; start < Math.max(1, props.length); start += 3) {
    const chunk = props.slice(start, start + 3)
    const v: Record<string, FieldValue> = { ...header(ret, 'f1_1[0]', 'f1_2[0]') }
    if (ret.rentalForms1099.required !== null) {
      v['c1_1[0]'] = ret.rentalForms1099.required
      v['c1_1[1]'] = !ret.rentalForms1099.required
      if (ret.rentalForms1099.required) { v['c1_2[0]'] = ret.rentalForms1099.filed; v['c1_2[1]'] = !ret.rentalForms1099.filed }
    }
    chunk.forEach((p, col) => {
      const x = results.find((rr) => rr.id === p.id)
      v[`f1_${3 + col}[0]`] = p.address
      v[`f1_${6 + col}[0]`] = RENTAL_TYPE_CODE[p.type]
      v[`f1_${9 + col * 2}[0]`] = String(p.fairRentalDays)
      v[`f1_${10 + col * 2}[0]`] = String(p.personalUseDays)
      const ex = p.expenses
      const lines: [number, number][] = [
        [3, p.rents], [4, p.royalties], [5, ex.advertising], [6, ex.auto], [7, ex.cleaning], [8, ex.commissions], [9, ex.insurance],
        [10, ex.legal], [11, ex.management], [12, ex.mortgageInterest], [13, ex.otherInterest], [14, ex.repairs], [15, ex.supplies],
        [16, ex.taxes], [17, ex.utilities], [18, ex.depreciation + (x?.assetDepreciation ?? 0)], [19, ex.other]
      ]
      for (const [line, n] of lines) v[eField(line, col)] = amt(n)
      if (x) {
        v[eField(20, col)] = amt(x.expenses, true)
        v[eField(21, col)] = amt(x.net, true)
        if (line22.has(p.id)) v[eField(22, col)] = paren(line22.get(p.id) ?? 0)
      }
    })
    if (chunk.some((p) => p.expenses.other > 0)) v['f1_64[0]'] = 'See attached'
    if (start === 0) {
      Object.assign(v, {
        'f1_77[0]': amt(props.reduce((t, p) => t + p.rents, 0)), 'f1_78[0]': amt(props.reduce((t, p) => t + p.royalties, 0)),
        'f1_79[0]': amt(props.reduce((t, p) => t + p.expenses.mortgageInterest, 0)), 'f1_80[0]': amt(props.reduce((t, p) => t + p.expenses.depreciation + (results.find((rr) => rr.id === p.id)?.assetDepreciation ?? 0), 0)),
        'f1_81[0]': amt(results.reduce((t, x) => t + x.expenses, 0)), 'f1_82[0]': amt(positive, true),
        'f1_83[0]': paren(line25), 'f1_84[0]': amt(e.net, true)
      })
    }
    const k1Rows = res.k1.rows
    if (start === 0 && k1Rows.length) {
      Object.assign(v, scheduleEPart2(ret, res))
    }
    const pages = start === 0 && k1Rows.length ? (props.length ? [0, 1] : [1]) : [0]
    sheets.push({ id: start === 0 ? 'se' : `se-${start / 3 + 1}`, file: 'f1040se.pdf', title: start === 0 ? 'Schedule E' : `Schedule E, page 1 (properties ${start + 1}–${start + chunk.length})`, values: v, pages })
  }
  return sheets
}

// ── Form 8889 (one per spouse with an HSA) ───────────────────────────────────
// ── Form 5329, Parts I and VII (one per person) ─────────────────────────────
function form5329(ret: TaxReturnInput, f: TaxReturnResult['form5329'][number]): FormFill {
  const person = f.owner === 'spouse' ? ret.spouse : ret.taxpayer
  const v: Record<string, FieldValue> = {
    'f1_1[0]': [person.firstName, person.lastName].filter(Boolean).join(' '), 'f1_2[0]': ssnDashed(person.ssn)
  }
  if (f.line1 > 0 && f.required) {
    Object.assign(v, { 'f1_9[0]': amt(f.line1, true), 'f1_10[0]': f.line2 > 0 ? f.exceptionCode : '', 'f1_11[0]': amt(f.line2), 'f1_12[0]': amt(f.line3, true), 'f1_13[0]': amt(f.line4, true) })
  }
  const pages = [0]
  if (f.line48 > 0) {
    pages.push(1)
    Object.assign(v, {
      'f2_17[0]': amt(f.line42, true), 'f2_18[0]': amt(f.line43), 'f2_19[0]': amt(f.line44), 'f2_20[0]': amt(f.line45),
      'f2_21[0]': amt(f.line46, true), 'f2_22[0]': amt(f.line47, true), 'f2_23[0]': amt(f.line48, true), 'f2_24[0]': amt(f.line49, true)
    })
  }
  return { id: `5329-${f.owner}`, file: 'f5329.pdf', title: `Form 5329 (${person.firstName || f.owner})`, values: v, pages }
}

function form8889(ret: TaxReturnInput, res: TaxReturnResult, h: TaxReturnResult['form8889'][number]): FormFill {
  const person = h.owner === 'spouse' ? ret.spouse : ret.taxpayer
  return {
    id: `8889-${h.owner}`, file: 'f8889.pdf', title: `Form 8889 (${person.firstName || h.owner})`,
    values: {
      'f1_1[0]': namesOnReturn(ret), 'f1_2[0]': ssnDashed(person.ssn),
      'c1_1[0]': h.coverage === 'self', 'c1_1[1]': h.coverage === 'family',
      'f1_3[0]': amt(h.line2, true), 'f1_4[0]': amt(h.line3, true), 'f1_6[0]': amt(h.line3, true), 'f1_7[0]': amt(h.line3, true),
      'f1_8[0]': amt(h.line7), 'f1_9[0]': amt(h.line8, true), 'f1_10[0]': amt(h.line9), 'f1_12[0]': amt(h.line9, true),
      'f1_13[0]': amt(h.line12, true), 'f1_14[0]': amt(h.line13, true),
      'f1_15[0]': amt(h.line14), 'f1_17[0]': amt(h.line14), 'f1_18[0]': amt(h.line15),
      'f1_19[0]': h.line14 ? amt(h.line16, true) : '', 'c1_2[0]': h.line16 > 0 && h.line17b === 0,
      'f1_20[0]': h.line16 > 0 ? amt(h.line17b, true) : ''
    }
  }
}

// ── Form 6251 ────────────────────────────────────────────────────────────────
function form6251(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const a = res.form6251
  const v: Record<string, FieldValue> = {
    ...header(ret, 'f1_1[0]', 'f1_2[0]'),
    'f1_3[0]': amt(a.line1a, true), 'f1_4[0]': amt(a.line1b, true), 'f1_5[0]': amt(a.line2a, true),
    'f1_11[0]': amt(a.line2g), 'f1_13[0]': amt(a.line2i), 'f1_25[0]': amt(a.line3),
    'f1_26[0]': amt(a.line4, true), 'f1_27[0]': amt(a.line5, true), 'f1_28[0]': amt(a.line6, true),
    'f1_29[0]': amt(a.line7, true), 'f1_31[0]': amt(a.line9, true), 'f1_32[0]': amt(a.line10, true), 'f1_33[0]': amt(a.amt, true)
  }
  const p = a.part3
  if (p) {
    const map: [string, number][] = [
      ['f2_1', p.l12], ['f2_2', p.l13], ['f2_4', p.l15], ['f2_5', p.l16], ['f2_6', p.l17], ['f2_7', p.l18], ['f2_8', p.l19],
      ['f2_9', p.l20], ['f2_10', p.l21], ['f2_11', p.l22], ['f2_12', p.l23], ['f2_13', p.l24], ['f2_14', p.l25], ['f2_15', p.l26],
      ['f2_16', p.l27], ['f2_17', p.l28], ['f2_18', p.l29], ['f2_19', p.l30], ['f2_20', p.l31], ['f2_21', p.l32],
      ['f2_22', p.l33], ['f2_23', p.l34], ['f2_27', p.l38], ['f2_28', p.l39], ['f2_29', p.l40]
    ]
    for (const [k, n] of map) v[`${k}[0]`] = amt(n, true)
  }
  return { id: '6251', file: 'f6251.pdf', title: 'Form 6251', values: v, pages: p ? undefined : [0] }
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
export function buildPacket2025(ret: TaxReturnInput, res: TaxReturnResult, preparer?: PreparerInfo | null): FormPacket {
  const f = res.f1040
  const onlyDistributions = ret.capitalTransactions.length === 0 && res.form4797.scheduleDGain === 0 && res.k1.shortTermGain === 0 && res.k1.longTermGain === 0 &&
    ret.capitalLossCarryover.shortTerm === 0 && ret.capitalLossCarryover.longTerm === 0
  const needD = !onlyDistributions || f['7a'] < 0
  const forms: FormFill[] = [form1040(ret, res, needD, preparer)]
  if (res.schedule1.additionalIncome !== 0 || res.schedule1.totalAdjustments > 0) forms.push(schedule1(ret, res))
  if (res.schedule1A.total > 0) forms.push(schedule1A(ret, res))
  if (res.schedule2.total > 0 || res.schedule2.amt > 0) forms.push(schedule2(ret, res))
  if (res.schedule3.dependentCare + res.schedule3.education + res.schedule3.saversCredit + res.schedule3.excessSocialSecurity > 0) forms.push(schedule3(ret, res))
  if (res.deduction.used === 'itemized') forms.push(scheduleA(ret, res))
  if (res.scheduleB.required) forms.push(scheduleB(ret, res))
  const owners = ret.filingStatus === 'mfj' ? ['taxpayer', 'spouse'] : ['taxpayer']
  ret.businesses.filter((b) => owners.includes(b.owner)).forEach((b) => forms.push(scheduleC(ret, res, b)))
  if (needD && (ret.capitalTransactions.length || f['7a'] !== 0 || res.form4797.scheduleDGain !== 0 || res.k1.shortTermGain !== 0 || res.k1.longTermGain !== 0)) forms.push(scheduleD(ret, res))
  forms.push(...form4797Forms(ret, res))
  forms.push(...form8949(ret))
  if (res.scheduleE.properties.length || res.k1.rows.length) forms.push(...scheduleE(ret, res))
  for (const owner of ['taxpayer', 'spouse'] as Owner[]) {
    const se = scheduleSE(ret, res, owner)
    if (se) forms.push(se)
  }
  if (res.form2441.credit > 0 || res.form2441.partIII) forms.push(form2441(ret, res))
  res.form5329.filter((x) => x.required).forEach((x) => forms.push(form5329(ret, x)))
  if (res.form6251.amt > 0) forms.push(form6251(ret, res))
  if (res.eic.credit > 0 && res.eic.qualifyingChildren > 0) forms.push(scheduleEIC(ret))
  if (res.schedule8812.creditBeforePhaseout > 0) forms.push(schedule8812(ret, res))
  if (res.form8863.aotc + res.form8863.llc > 0) forms.push(...form8863(ret, res))
  res.form8889.forEach((h) => forms.push(form8889(ret, res, h)))
  if (res.schedule3.saversCredit > 0) forms.push(form8880(ret, res))
  if (res.qbi.form === '8995' && (res.qbi.deduction > 0 || res.qbi.lossCarryforward > 0 || res.qbi.reitLossCarryforward > 0)) forms.push(form8995(ret, res))
  if (res.qbi.form === '8995a') forms.push(...form8995a(ret, res))
  if (res.schedule2.additionalMedicareTax > 0 || f['25c'] > 0) forms.push(form8959(ret, res))
  if (res.schedule2.netInvestmentIncomeTax > 0) forms.push(form8960(ret, res))
  forms.push(...forms4562(ret, res))
  if (res.form8582.required) forms.push(form8582Fill(ret, res))
  ret.businesses.filter((b) => owners.includes(b.owner)).forEach((b) => { const x = form8829(ret, res, b); if (x) forms.push(x) })
  if (f['37'] > 0) forms.push(form1040V(ret, res))

  const notIncluded: string[] = []
  if (res.qbi.form === '8995a' && res.qbi.businesses.some((b) => b.sstb)) notIncluded.push('Schedule A (Form 8995-A), Specified Service Trades or Businesses — the reduced amounts are already on Form 8995-A')
  if (res.qbi.form === '8995a' && (res.qbi.priorLoss > 0 || res.qbi.businesses.some((b) => b.qbiBeforeNetting < 0))) notIncluded.push('Schedule C (Form 8995-A), Loss Netting and Carryforward — the netted amounts are on Form 8995-A line 2')
  if (ret.dependents.length > 4) notIncluded.push('A statement listing dependents after the fourth')
  if (ret.businesses.some((b) => b.homeOffice.method === 'amount' && b.homeOffice.amount > 0)) notIncluded.push('Your own Form 8829 or simplified-method worksheet for the home office amount you entered')
  if (res.form4562.some((f) => f.rows.filter((x) => x.propertyClass === '27.5').length > 2 || f.rows.filter((x) => x.propertyClass === '39').length + (f.home ? 1 : 0) > 2)) notIncluded.push('A statement listing buildings placed in service in 2025 beyond the two lines on Form 4562 lines 19i/19j')
  if (res.form4562.some((f) => f.elected.length > 2)) notIncluded.push('A statement listing section 179 property beyond the two lines on Form 4562 line 6')
  if (res.form4797.sales.filter((x) => x.part === 'I').length > 4 || res.form4797.sales.filter((x) => x.part === 'II').length > 4) notIncluded.push('A statement listing Form 4797 line 2 or line 10 sales beyond the first four')
  if (res.scheduleD19 > 0) notIncluded.push('Unrecaptured Section 1250 Gain Worksheet and Schedule D Tax Worksheet (keep with your records; the tax on line 16 uses them)')
  if (res.k1.rows.length > 4) notIncluded.push('Schedule E page 2 continuation for K-1s beyond the first four (the totals include them)')
  if (res.form8582.required && res.form8582.activities.filter((x) => x.group === 'rental').length > 5) notIncluded.push('Form 8582 Part IV continuation for more than five activities')
  if (res.form8582.required && res.form8582.activities.filter((x) => x.group === 'other').length > 5) notIncluded.push('Form 8582 Part V continuation for more than five activities')
  return { forms, notIncluded }
}
