/**
 * 2026 federal forms (public/forms/2026): the IRS early-release DRAFTS, marked "DRAFT — DO NOT FILE".
 *
 * The 2026 packet starts from the 2025 mapping and changes what moved on the 2026 forms:
 *  - Form 1040: new page 1 work-authorization question; line 12f (charity for non-itemizers); 13a and 13b swapped
 *    (13a Schedule 1-A, 13b QBI); 24a–24c (Form 1062 on 24b); 32a–32c (Schedule 3-A on 32b); fields renumbered.
 *  - Schedule A: charity lines 11–15 with the 0.5%-of-AGI floor (line 13); other deductions on line 17; line 18 question.
 *  - Schedule 3: line 15 field moved; Schedule 1: line 24a field renamed.
 *  - Schedule 3-A (flat PDF, drawn).
 * Forms with no 2026 draft in the app yet are left out and listed in `notIncluded`.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { ctcChild } from '../engine/compute.ts'
import { amt, buildPacket2025, digits, fullName, header, splitName, zip } from './irs2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

/** 2026 drafts in public/forms/2026 (file → form name). */
export const FORMS_2026: Record<string, string> = {
  'f1040.pdf': 'Form 1040', 'f1040s1.pdf': 'Schedule 1', 'f1040s3.pdf': 'Schedule 3', 'f1040s3a.pdf': 'Schedule 3-A',
  'f1040sa.pdf': 'Schedule A', 'f1040sb.pdf': 'Schedule B', 'f1040sd.pdf': 'Schedule D', 'f1040s8.pdf': 'Schedule 8812',
  'f8949.pdf': 'Form 8949', 'f8863.pdf': 'Form 8863', 'statement.pdf': 'Supporting statement'
}

const P1 = 'topmostSubform[0].Page1[0].'
const P2 = 'topmostSubform[0].Page2[0].'

function form1040(ret: TaxReturnInput, res: TaxReturnResult, attachScheduleD: boolean, preparer?: PreparerInfo | null): FormFill {
  const f = res.f1040
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const c = ret.contact
  const s1a = res.schedule1A
  const v: Record<string, FieldValue> = {
    [`${P1}f1_14[0]`]: ret.taxpayer.firstName,
    [`${P1}f1_15[0]`]: ret.taxpayer.lastName,
    [`${P1}f1_16[0]`]: digits(ret.taxpayer.ssn),
    [`${P1}Address_ReadOrder[0].f1_20[0]`]: c.street,
    [`${P1}Address_ReadOrder[0].f1_21[0]`]: c.apt,
    [`${P1}Address_ReadOrder[0].f1_22[0]`]: c.city,
    [`${P1}Address_ReadOrder[0].f1_23[0]`]: c.state,
    [`${P1}Address_ReadOrder[0].f1_24[0]`]: zip(c.zip),
    [`${P1}c1_5[0]`]: c.livedInUsHalfYear,
    [`${P1}c1_6[0]`]: ret.taxpayer.presidentialFund,
    [`${P1}c1_8[0]`]: fs === 'single',
    [`${P1}c1_8[1]`]: fs === 'mfj',
    [`${P1}c1_8[2]`]: fs === 'mfs',
    [`${P1}HOH-QSS_ReadOrder[0].c1_8[0]`]: fs === 'hoh',
    [`${P1}HOH-QSS_ReadOrder[0].c1_8[1]`]: fs === 'qss',
    [`${P1}c1_10[0]`]: ret.digitalAssets === true,
    [`${P1}c1_10[1]`]: ret.digitalAssets === false,
    // New for 2026: U.S. citizen, U.S. national or alien lawfully authorized to work
    [`${P1}c1_11[0]`]: ret.workAuthorized.taxpayer === true,
    [`${P1}c1_11[1]`]: ret.workAuthorized.taxpayer === false,
    // Income
    [`${P1}f1_47[0]`]: amt(f['1a']),
    [`${P1}f1_51[0]`]: amt(f['1e']),
    [`${P1}f1_57[0]`]: amt(f['1z'], true),
    [`${P1}f1_58[0]`]: amt(f['2a']),
    [`${P1}f1_59[0]`]: amt(f['2b']),
    [`${P1}f1_60[0]`]: amt(f['3a']),
    [`${P1}f1_61[0]`]: amt(f['3b']),
    [`${P1}f1_62[0]`]: amt(f['4a']),
    [`${P1}f1_63[0]`]: amt(f['4b']),
    [`${P1}f1_65[0]`]: amt(f['5a']),
    [`${P1}f1_66[0]`]: amt(f['5b']),
    [`${P1}f1_68[0]`]: amt(f['6a']),
    [`${P1}f1_69[0]`]: amt(f['6b']),
    [`${P1}f1_70[0]`]: amt(f['7a']),
    [`${P1}c1_45[0]`]: f['7a'] !== 0 && !attachScheduleD,
    [`${P1}f1_72[0]`]: amt(f['8']),
    [`${P1}f1_73[0]`]: amt(f['9'], true),
    [`${P1}f1_74[0]`]: amt(f['10']),
    [`${P1}f1_75[0]`]: amt(f['11a'], true),
    // Page 2
    [`${P2}f2_01[0]`]: amt(f['11b'], true),
    [`${P2}c2_1[0]`]: ret.canBeClaimedAsDependent,
    [`${P2}c2_5[0]`]: ret.taxpayer.age >= 65 || ret.taxpayer.age65OrOlder,
    [`${P2}c2_6[0]`]: ret.taxpayer.blind,
    [`${P2}f2_02[0]`]: amt(f['12e'], true),
    // 2026: 12f charity for non-itemizers; 13a Schedule 1-A; 13b QBI
    [`${P2}f2_03[0]`]: amt(s1a.charityNonItemizer),
    [`${P2}f2_04[0]`]: amt(s1a.total),
    [`${P2}f2_05[0]`]: amt(f['13a']),
    [`${P2}f2_06[0]`]: amt(f['14'], true),
    [`${P2}f2_07[0]`]: amt(f['15'], true),
    [`${P2}f2_09[0]`]: amt(f['16'], true),
    [`${P2}f2_10[0]`]: amt(f['17']),
    [`${P2}f2_11[0]`]: amt(f['18'], true),
    [`${P2}f2_12[0]`]: amt(f['19']),
    [`${P2}f2_13[0]`]: amt(f['20']),
    [`${P2}f2_14[0]`]: amt(f['21']),
    [`${P2}f2_15[0]`]: amt(f['22'], true),
    [`${P2}f2_16[0]`]: amt(f['23']),
    [`${P2}f2_17[0]`]: amt(f['24'], true),
    [`${P2}f2_19[0]`]: amt(f['24'], true),
    [`${P2}Line25_ReadOrder[0].f2_20[0]`]: amt(f['25a']),
    [`${P2}f2_21[0]`]: amt(f['25b']),
    [`${P2}f2_22[0]`]: amt(f['25c']),
    [`${P2}f2_23[0]`]: amt(f['25d']),
    [`${P2}f2_24[0]`]: amt(f['26']),
    [`${P2}f2_26[0]`]: amt(f['27a']),
    [`${P2}f2_27[0]`]: amt(f['28']),
    [`${P2}f2_28[0]`]: amt(f['29']),
    [`${P2}Line31-32_ReadOrder[0].f2_30[0]`]: amt(f['31']),
    [`${P2}Line31-32_ReadOrder[0].f2_31[0]`]: amt(f['32a']),
    [`${P2}f2_32[0]`]: res.schedule3A ? amt(f['32b'], true) : '',
    [`${P2}f2_33[0]`]: amt(f['32']),
    [`${P2}f2_34[0]`]: amt(f['33'], true),
    [`${P2}f2_35[0]`]: amt(f['34']),
    [`${P2}f2_36[0]`]: amt(f['34']),
    [`${P2}f2_40[0]`]: amt(f['37']),
    [`${P2}f2_41[0]`]: amt(f['38']),
    [`${P2}f2_45[0]`]: ret.taxpayer.occupation,
    [`${P2}f2_49[0]`]: ret.contact.phone,
    [`${P2}f2_50[0]`]: ret.contact.email
  }
  if (joint || fs === 'mfs') {
    v[`${P1}f1_17[0]`] = ret.spouse.firstName
    v[`${P1}f1_18[0]`] = ret.spouse.lastName
    v[`${P1}f1_19[0]`] = digits(ret.spouse.ssn)
  }
  if (joint) {
    v[`${P1}c1_7[0]`] = ret.spouse.presidentialFund
    v[`${P1}c1_12[0]`] = ret.workAuthorized.spouse === true
    v[`${P1}c1_12[1]`] = ret.workAuthorized.spouse === false
    v[`${P2}c2_7[0]`] = ret.spouse.age >= 65 || ret.spouse.age65OrOlder
    v[`${P2}c2_8[0]`] = ret.spouse.blind
    v[`${P2}f2_47[0]`] = ret.spouse.occupation
  }
  if (fs === 'mfs') v[`${P1}f1_28[0]`] = fullName(ret.spouse)
  if (digits(ret.taxpayer.ipPin).length === 6) v[`${P2}f2_46[0]`] = digits(ret.taxpayer.ipPin)
  if (joint && digits(ret.spouse.ipPin).length === 6) v[`${P2}f2_48[0]`] = digits(ret.spouse.ipPin)

  const d = ret.designee
  if (d.enabled && d.name.trim()) Object.assign(v, { [`${P2}c2_16[0]`]: true, [`${P2}c2_16[1]`]: false, [`${P2}f2_42[0]`]: d.name, [`${P2}f2_43[0]`]: d.phone, [`${P2}f2_44[0]`]: digits(d.pin).slice(0, 5) })
  else Object.assign(v, { [`${P2}c2_16[0]`]: false, [`${P2}c2_16[1]`]: true })

  if (ret.usePaidPreparer && preparer && preparer.name.trim()) {
    const ein = digits(preparer.firmEin)
    Object.assign(v, {
      [`${P2}f2_51[0]`]: preparer.name, [`${P2}f2_52[0]`]: preparer.ptin.toUpperCase(), [`${P2}c2_17[0]`]: preparer.selfEmployed,
      [`${P2}f2_53[0]`]: preparer.firmName || (preparer.selfEmployed ? 'Self-employed' : ''), [`${P2}f2_54[0]`]: preparer.phone,
      [`${P2}f2_55[0]`]: preparer.firmAddress, [`${P2}f2_56[0]`]: ein.length === 9 ? `${ein.slice(0, 2)}-${ein.slice(2)}` : ''
    })
  }
  if (fs === 'mfs' && ret.deductionChoice === 'itemized') v[`${P2}c2_3[0]`] = true

  if (f['34'] > 0 && digits(ret.refundDeposit.routingNumber).length === 9 && digits(ret.refundDeposit.accountNumber).length >= 4) {
    v[`${P2}RoutingNo[0].f2_37[0]`] = digits(ret.refundDeposit.routingNumber)
    v[`${P2}AccountNo[0].f2_38[0]`] = digits(ret.refundDeposit.accountNumber)
    v[`${P2}c2_15[0]`] = ret.refundDeposit.accountType === 'checking'
    v[`${P2}c2_15[1]`] = ret.refundDeposit.accountType === 'savings'
  }

  const T = `${P1}Table_Dependents[0].`
  ret.dependents.slice(0, 4).forEach((dep, i) => {
    const n = i + 1
    const [first, last] = splitName(dep.name)
    v[`${T}Row1[0].f1_${31 + i}[0]`] = first
    v[`${T}Row2[0].f1_${35 + i}[0]`] = last
    v[`${T}Row3[0].f1_${39 + i}[0]`] = digits(dep.ssn)
    v[`${T}Row4[0].f1_${43 + i}[0]`] = dep.relationship
    v[`${T}Row5[0].Dependent${n}[0].c1_${14 + 2 * i}[0]`] = dep.monthsLivedWithYou > 6
    v[`${T}Row5[0].Dependent${n}[0].c1_${15 + 2 * i}[0]`] = dep.monthsLivedWithYou > 6 && c.livedInUsHalfYear
    v[`${T}Row6[0].Dependent${n}[0].c1_${22 + 2 * i}[0]`] = dep.student
    v[`${T}Row6[0].Dependent${n}[0].c1_${23 + 2 * i}[0]`] = dep.disabled
    v[`${T}Row7[0].Dependent${n}[0].c1_${30 + i}[0]`] = ctcChild(dep)
    v[`${T}Row7[0].Dependent${n}[0].c1_${30 + i}[1]`] = !ctcChild(dep)
  })
  if (ret.dependents.length > 4) v[`${P1}Dependents_ReadOrder[0].c1_13[0]`] = true
  return { id: '1040', file: 'f1040.pdf', title: 'Form 1040 (2026 draft)', values: v }
}

/** Schedule A (2026): charity lines 11–15, other itemized deductions on 17z, total on 18. */
function scheduleA(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const it = ret.itemized
  const a = res.scheduleA
  const agi = res.f1040['11b']
  const A = 'form1[0].Page1[0].'
  const B = 'form1[0].Page2[0].'
  const limited = a.total < Math.round(a.medical + a.taxes + a.interest + a.charity + a.other)
  return {
    id: 'sa', file: 'f1040sa.pdf', title: 'Schedule A (2026 draft)',
    values: {
      ...header(ret, `${A}f1_01[0]`, `${A}f1_02[0]`),
      ...(it.medical > 0 ? { [`${A}f1_03[0]`]: amt(it.medical), [`${A}f1_04[0]`]: amt(agi, true), [`${A}f1_05[0]`]: amt(agi * 0.075), [`${A}f1_06[0]`]: amt(a.medical, true) } : {}),
      [`${A}f1_07[0]`]: amt(it.stateLocalIncomeOrSalesTax), [`${A}f1_08[0]`]: amt(it.realEstateTax), [`${A}f1_09[0]`]: amt(it.personalPropertyTax),
      [`${A}f1_10[0]`]: amt(a.saltBeforeCap), [`${A}f1_11[0]`]: amt(a.taxes), [`${A}f1_14[0]`]: amt(a.taxes),
      [`${A}f1_15[0]`]: amt(it.mortgageInterest), [`${A}f1_20[0]`]: amt(it.mortgageInterest), [`${A}f1_22[0]`]: amt(a.interest),
      [`${B}Line11_ReadOrder[0].f2_01[0]`]: amt(it.charityCash), [`${B}f2_02[0]`]: amt(it.charityNonCash),
      [`${B}f2_03[0]`]: amt(a.charity), [`${B}f2_05[0]`]: amt(a.charity),
      [`${B}f2_18[0]`]: amt(it.other),
      [`${B}c2_1[0]`]: !limited, [`${B}c2_1[1]`]: limited,
      [`${B}f2_19[0]`]: amt(a.total, true),
      [`${B}Line19_ReadOrder[0].c2_2[0]`]: ret.deductionChoice === 'itemized' && a.total < res.deduction.standard
    }
  }
}

/** Schedule 3-A (flat draft, drawn): Part I lines 1a–6, the line 6/7/8 answers, and line 8 (Form 1040 line 32b). */
function schedule3A(ret: TaxReturnInput, res: TaxReturnResult): FormFill | null {
  const s = res.schedule3A
  if (!s) return null
  const n = (x: number): string => x.toLocaleString('en-US')
  const top = (t: number): number => 792 - t
  const inner = (t: number, x: number) => ({ page: 0, x: 466, y: top(t), text: n(x), right: true, size: 9 })
  const outer = (t: number, x: number) => ({ page: 0, x: 572, y: top(t), text: n(x), right: true, size: 9 })
  const box = (t: number) => ({ page: 0, x: 67.5, y: top(t), text: 'X', size: 9 })
  const names = `${ret.taxpayer.firstName} ${ret.taxpayer.lastName}${ret.filingStatus === 'mfj' ? ` & ${ret.spouse.firstName} ${ret.spouse.lastName}` : ''}`.trim()
  const ssn = digits(ret.taxpayer.ssn).replace(/^(\d{3})(\d{2})(\d{4})$/, '$1-$2-$3')
  const draw = [
    { page: 0, x: 40, y: top(104), text: names, size: 9 },
    { page: 0, x: 445, y: top(104), text: ssn, size: 9 },
    inner(185, s.line1a), inner(215, s.line1b), outer(244, s.line2), inner(275, s.line3), inner(305, s.line4), outer(322, s.line5)
  ]
  if (s.line6 > 0) {
    draw.push(box(352), outer(388, s.line6))
    const want = ret.publicBenefit.want
    draw.push(box(want ? 417 : 429))
    if (want) {
      const q = ret.publicBenefit.qualified
      if (q !== null) draw.push(box(q ? 481 : 507), outer(520, q ? 0 : s.line6))
    }
  } else draw.push(box(373), outer(388, 0))
  return { id: 's3a', file: 'f1040s3a.pdf', title: 'Schedule 3-A (2026 draft)', values: {}, draw }
}

const SCHEDULE_3_2026 = (fill: FormFill): FormFill => {
  const v = { ...fill.values }
  if ('f1_37[0]' in v) { v['f1_38[0]'] = v['f1_37[0]']; delete v['f1_37[0]'] }
  return { ...fill, title: 'Schedule 3 (2026 draft)', values: v }
}

const SCHEDULE_1_2026 = (fill: FormFill): FormFill => {
  const v: Record<string, FieldValue> = {}
  for (const [k, x] of Object.entries(fill.values)) v[k.replace('Line24a_ReadOrder[0].', 'Line24_ReadOrder[0].')] = x
  return { ...fill, title: 'Schedule 1 (2026 draft)', values: v }
}

export function buildPacket2026(ret: TaxReturnInput, res: TaxReturnResult, preparer?: PreparerInfo | null): FormPacket {
  const base = buildPacket2025(ret, res, preparer)
  const forms: FormFill[] = []
  const missing = new Set<string>()
  for (const fill of base.forms) {
    if (fill.id === '1040') {
      const needD = base.forms.some((x) => x.id === 'sd')
      forms.push(form1040(ret, res, needD, preparer))
      const s3a = schedule3A(ret, res)
      if (s3a) forms.push(s3a)
    } else if (fill.id === 'sa') forms.push(scheduleA(ret, res))
    else if (fill.id === 's3') forms.push(SCHEDULE_3_2026(fill))
    else if (fill.id === 's1') forms.push(SCHEDULE_1_2026(fill))
    else if (FORMS_2026[fill.file]) forms.push({ ...fill, title: fill.id.startsWith('st-') ? fill.title : `${fill.title} (2026 draft)` })
    else missing.add(fill.title.replace(/\s*\(.*$/, ''))
  }
  const notIncluded = [...base.notIncluded]
  if (missing.size) notIncluded.unshift(`Not in this PDF yet — the 2026 IRS draft of ${[...missing].join(', ')} has not been added to the app`)
  notIncluded.unshift('These are IRS DRAFT forms for 2026 ("DO NOT FILE"). Use them to check your numbers; file on the final forms the IRS releases in December–January.')
  return { forms, notIncluded }
}
