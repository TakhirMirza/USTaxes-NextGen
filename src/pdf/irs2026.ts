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
  'f1040.pdf': 'Form 1040', 'f1040s1.pdf': 'Schedule 1', 'f1040s1a.pdf': 'Schedule 1-A', 'f1040s2.pdf': 'Schedule 2', 'f1040s3.pdf': 'Schedule 3',
  'f1040s3a.pdf': 'Schedule 3-A', 'f1040sa.pdf': 'Schedule A', 'f1040sb.pdf': 'Schedule B', 'f1040sc.pdf': 'Schedule C', 'f1040sd.pdf': 'Schedule D',
  'f1040se.pdf': 'Schedule E', 'f1040sei.pdf': 'Schedule EIC', 'f1040sse.pdf': 'Schedule SE', 'f1040s8.pdf': 'Schedule 8812', 'f1040v.pdf': 'Form 1040-V',
  'f2441.pdf': 'Form 2441', 'f4562.pdf': 'Form 4562', 'f4797.pdf': 'Form 4797', 'f5329.pdf': 'Form 5329', 'f6251.pdf': 'Form 6251', 'f8582.pdf': 'Form 8582', 'f8829.pdf': 'Form 8829', 'f8863.pdf': 'Form 8863',
  'f8880.pdf': 'Form 8880', 'f8889.pdf': 'Form 8889', 'f8949.pdf': 'Form 8949', 'f8995.pdf': 'Form 8995', 'f8995a.pdf': 'Form 8995-A', 'statement.pdf': 'Supporting statement'
}

/** Form 8582 (2026): same layout; field numbers lost their leading zero (f1_01 → f1_1). */
const UNPAD_2026 = (fill: FormFill): FormFill => {
  const v: Record<string, FieldValue> = {}
  for (const [k, x] of Object.entries(fill.values)) v[k.replace(/^(f\d_)0(\d\[0\])$/, '$1$2')] = x
  return { ...fill, title: `${fill.title} (2026 draft)`, values: v }
}

/** Form 4562 (2026): new lines 14a–14d push Part II and the line 19 table down three field numbers. Page 2 is unchanged. */
const FORM_4562_2026 = (fill: FormFill): FormFill => {
  const v: Record<string, FieldValue> = {}
  for (const [k, x] of Object.entries(fill.values)) {
    const m = /^f1_(\d+)\[0\]$/.exec(k)
    const n = m ? Number(m[1]) : 0
    if (n === 23) continue // 2025 line 15 (not used)
    v[m && n >= 24 ? `f1_${n + 3}[0]` : k] = x
  }
  return { ...fill, title: `${fill.title} (2026 draft)`, values: v }
}

/** Form 4797 (2026): new line 7 (livestock) and line 18 renumber Parts I–II; Part III fields keep their names. */
const FORM_4797_2026 = (fill: FormFill): FormFill => {
  const v: Record<string, FieldValue> = {}
  for (const [k, x] of Object.entries(fill.values)) {
    const m = /^f1_(\d+)\[0\]$/.exec(k)
    const n = m ? Number(m[1]) : 0
    const to = !m ? n : n >= 38 && n <= 71 ? n + 1 : n === 75 || n === 77 ? n + 2 : n
    v[m ? `f1_${to}[0]` : k] = x
  }
  return { ...fill, title: `${fill.title} (2026 draft)`, values: v }
}

/** Form 8995-A (2026): line 40 minimum deduction and line 41 total added before the carryforward. */
const FORM_8995A_2026 = (fill: FormFill, res: TaxReturnResult): FormFill => {
  const v: Record<string, FieldValue> = { ...fill.values }
  if ('f2_49[0]' in v) {
    const carry = v['f2_49[0]']
    const ded = res.f1040['13a']
    v['f2_49[0]'] = ded > res.qbi.deduction ? amt(ded) : ''
    v['f2_50[0]'] = amt(ded, true)
    v['f2_51[0]'] = carry
  }
  return { ...fill, title: `${fill.title} (2026 draft)`, values: v }
}

/** Form 5329 (2026): the address block gained two fields, so Part I moves up by two; page 2 is unchanged. */
const FORM_5329_2026 = (fill: FormFill): FormFill => {
  const v: Record<string, FieldValue> = {}
  for (const [k, x] of Object.entries(fill.values)) {
    const m = /^f1_(\d+)\[0\]$/.exec(k)
    v[m && Number(m[1]) >= 9 ? `f1_${Number(m[1]) + 2}[0]` : k] = x
  }
  return { ...fill, title: `${fill.title} (2026 draft)`, values: v }
}

/** Schedule C (2026): Part I/II fields renumbered (+3; 16b vehicle loan and the split address added). */
const SCHEDULE_C_2026 = (fill: FormFill): FormFill => {
  const m: Record<string, string> = {
    'f1_6[0]': 'BoxD[0].f1_6[0]', 'f1_8[0]': 'f1_9[0]',
    'f1_10[0]': 'f1_13[0]', 'f1_11[0]': 'f1_14[0]', 'f1_12[0]': 'f1_15[0]', 'f1_13[0]': 'f1_16[0]', 'f1_14[0]': 'f1_17[0]', 'f1_15[0]': 'f1_18[0]', 'f1_16[0]': 'f1_19[0]',
    'f1_17[0]': 'f1_20[0]', 'f1_18[0]': 'f1_21[0]', 'f1_20[0]': 'f1_23[0]', 'f1_22[0]': 'f1_25[0]', 'f1_24[0]': 'f1_27[0]',
    'f1_27[0]': 'f1_32[0]', 'f1_28[0]': 'f1_33[0]', 'f1_31[0]': 'f1_36[0]', 'f1_33[0]': 'f1_38[0]', 'f1_34[0]': 'f1_39[0]',
    'f1_35[0]': 'f1_40[0]', 'f1_36[0]': 'f1_41[0]', 'f1_37[0]': 'f1_42[0]', 'f1_39[0]': 'f1_45[0]', 'f1_41[0]': 'f1_46[0]', 'f1_42[0]': 'f1_47[0]',
    'Line30_ReadOrder[0].f1_43[0]': 'Line30_ReadOrder[0].f1_48[0]', 'Line30_ReadOrder[0].f1_44[0]': 'Line30_ReadOrder[0].f1_49[0]',
    'f1_45[0]': 'f1_50[0]', 'f1_46[0]': 'f1_51[0]'
  }
  // Rename in one pass from the 2025 keys so a renamed key is never renamed again.
  const v: Record<string, FieldValue> = {}
  for (const [k, x] of Object.entries(fill.values)) v[m[k] ?? k] = x
  return { ...fill, title: `${fill.title} (2026 draft)`, values: v }
}

/** Schedule E (2026): split address, lines 13/13a/13b, totals and Part II renumbered, line 41 on page 3. */
const E25: Record<number, number> = { 3: 16, 4: 19, 5: 22, 6: 25, 7: 28, 8: 31, 9: 34, 10: 37, 11: 40, 12: 43, 13: 46, 14: 49, 15: 52, 16: 55, 17: 58, 18: 61, 19: 65, 20: 68, 21: 71, 22: 74 }
const E26: Record<number, number> = { 3: 28, 4: 31, 5: 34, 6: 37, 7: 40, 8: 43, 9: 46, 10: 49, 11: 52, 12: 55, 13: 64, 14: 67, 15: 70, 16: 73, 17: 76, 18: 79, 19: 83, 20: 86, 21: 89, 22: 92 }
const SCHEDULE_E_2026 = (fill: FormFill, ret: TaxReturnInput): FormFill => {
  const m: Record<string, string> = { 'f1_64[0]': 'f1_82[0]' }
  for (let c = 0; c < 3; c++) {
    m[`f1_${3 + c}[0]`] = `f1_${3 + 5 * c}[0]`
    m[`f1_${6 + c}[0]`] = `f1_${18 + c}[0]`
    m[`f1_${9 + 2 * c}[0]`] = `f1_${21 + 2 * c}[0]`
    m[`f1_${10 + 2 * c}[0]`] = `f1_${22 + 2 * c}[0]`
    for (const [line, b] of Object.entries(E25)) m[`f1_${b + c}[0]`] = `f1_${E26[Number(line)] + c}[0]`
  }
  ;['f1_77[0]', 'f1_78[0]', 'f1_79[0]', 'f1_80[0]', 'f1_81[0]'].forEach((k, i) => { m[k] = `f1_${95 + i}[0]` })
  m['f1_82[0]'] = 'f2_3[0]'; m['f1_83[0]'] = 'f2_4[0]'; m['f1_84[0]'] = 'f2_5[0]'
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) m[`f2_${3 + 3 * i + j}[0]`] = `f2_${6 + 3 * i + j}[0]`
    for (let j = 0; j < 5; j++) m[`f2_${15 + 5 * i + j}[0]`] = `f2_${18 + 5 * i + j}[0]`
  }
  Object.assign(m, { 'f2_36[0]': 'f2_39[0]', 'f2_39[0]': 'f2_42[0]', 'f2_40[0]': 'f2_43[0]', 'f2_42[0]': 'f2_45[0]', 'f2_43[0]': 'f2_46[0]', 'f2_45[0]': 'f2_48[0]', 'f2_46[0]': 'f2_49[0]', 'f2_47[0]': 'f2_50[0]', 'f2_78[0]': 'f3_4[0]' })
  // Table keys for Part II rows overlap the totals' 2025 numbers, so map by the 2025 key only once.
  const v: Record<string, FieldValue> = {}
  for (const [k, x] of Object.entries(fill.values)) v[m[k] ?? k] = x
  // Line 13 (interest) total row = 13b "Other" (no vehicle loans on rentals here).
  for (let c = 0; c < 3; c++) if (v[`f1_${64 + c}[0]`]) v[`f1_${58 + c}[0]`] = v[`f1_${64 + c}[0]`]
  let pages = fill.pages
  if ('f3_4[0]' in v && v['f3_4[0]'] !== '') {
    v['f3_1[0]'] = v['f2_1[0]'] ?? ''
    v['f3_2[0]'] = v['f2_2[0]'] ?? ''
    pages = [...(pages ?? [0, 1]), 2]
  }
  void ret
  return { ...fill, title: `${fill.title} (2026 draft)`, values: v, pages }
}

/** Schedule 2 (2026): restructured into Sections A–C; Additional Medicare tax split into SE (line 11) and wages (17b);
 *  Form 5329 early-distribution tax on line 5, excess-contribution tax on line 18. */
function schedule2(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const s = res.schedule2
  const owners = ret.filingStatus === 'mfj' ? ['taxpayer', 'spouse'] : ['taxpayer']
  const wages = ret.w2s.filter((w) => owners.includes(w.owner)).reduce((t, w) => t + (w.medicareWages || w.wages), 0)
  const se = res.scheduleSE.reduce((t, x) => t + x.netEarnings, 0)
  const thr = { single: 200000, mfj: 250000, mfs: 125000, hoh: 200000, qss: 200000 }[ret.filingStatus]
  const seAddl = Math.min(s.additionalMedicareTax, Math.round(Math.max(0, se - Math.max(0, thr - wages)) * 0.009))
  const wageAddl = s.additionalMedicareTax - seAddl
  const line5 = s.earlyDistributionTax
  const line14 = s.hsaAdditionalTax
  const line15 = s.selfEmploymentTax + line5 + s.netInvestmentIncomeTax + seAddl + line14
  return {
    id: 's2', file: 'f1040s2.pdf', title: 'Schedule 2 (2026 draft)',
    values: {
      ...header(ret, 'f1_01[0]', 'f1_02[0]'),
      'f1_12[0]': amt(s.amt), 'f1_13[0]': amt(s.amt),
      'f1_15[0]': amt(s.selfEmploymentTax),
      'f1_16[0]': amt(line5), 'c1_6[0]': line5 > 0 && !res.form5329.some((f) => f.required),
      'f1_17[0]': amt(s.netInvestmentIncomeTax),
      'f1_22[0]': amt(seAddl),
      'f1_27[0]': amt(line14), 'f2_06[0]': amt(line14),
      'f2_07[0]': amt(line15),
      'f2_12[0]': amt(wageAddl), 'f2_14[0]': amt(wageAddl), 'f2_15[0]': amt(s.hsaExcessTax), 'f2_19[0]': amt(wageAddl + s.hsaExcessTax),
      'f2_20[0]': amt(s.total, true)
    }
  }
}

/** Form 8995 (2026): one-digit field names; line 16 minimum deduction and 17 the deduction; carryforwards on 18–19. */
const FORM_8995_2026 = (fill: FormFill, res: TaxReturnResult): FormFill => {
  const v: Record<string, FieldValue> = {}
  for (const [k, x] of Object.entries(fill.values)) {
    const m = /^f1_0(\d)\[0\]$/.exec(k)
    if (m) v[`f1_${m[1]}[0]`] = x
    else if (k === 'f1_32[0]') v['f1_34[0]'] = x
    else if (k === 'f1_33[0]') v['f1_35[0]'] = x
    else v[k] = x
  }
  const ded = res.f1040['13a']
  if (ded > res.qbi.deduction) v['f1_32[0]'] = amt(ded)
  v['f1_33[0]'] = amt(ded, true)
  return { ...fill, title: 'Form 8995 (2026 draft)', values: v }
}

/** Form 2441 (2026): Part I is now a table with one column per provider. */
const FORM_2441_2026 = (fill: FormFill, ret: TaxReturnInput): FormFill => {
  const v: Record<string, FieldValue> = {}
  const drop = new Set(['f1_3[0]', 'f1_4[0]', 'f1_5[0]', 'f1_6[0]', 'f1_7[0]', 'f1_8[0]', 'f1_9[0]', 'f1_10[0]', 'f1_11[0]', 'f1_12[0]', 'f1_13[0]', 'f1_14[0]',
    'ColD[0].c1_4[0]', 'ColD[0].c1_4[1]', 'ColD[0].c1_5[0]', 'ColD[0].c1_5[1]', 'ColD[0].c1_6[0]', 'ColD[0].c1_6[1]'])
  for (const [k, x] of Object.entries(fill.values)) if (!drop.has(k)) v[k] = x
  ret.dependentCare.providers.slice(0, 3).forEach((p, i) => {
    v[`Provider${i + 1}[0].f1_${3 + i}[0]`] = p.name
    v[`Provider${i + 1}[0].f1_${6 + i}[0]`] = p.address
    v[`f1_${9 + i}[0]`] = digits(p.tin).length === 9 && !p.tin.includes('-') ? digits(p.tin) : p.tin
    v[`Provider${i + 1}[0].c1_${4 + i}[0]`] = p.householdEmployee
    v[`Provider${i + 1}[0].c1_${4 + i}[1]`] = !p.householdEmployee
    v[`f1_${12 + i}[0]`] = amt(p.amountPaid)
  })
  return { ...fill, title: 'Form 2441 (2026 draft)', values: v }
}

/** Schedule 1-A (2026): one row per employer/vehicle; the app enters the totals on the first row. */
function schedule1A(ret: TaxReturnInput, res: TaxReturnResult): FormFill {
  const s = res.schedule1A
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const tipStart = { single: 150000, mfj: 300000, mfs: 0, hoh: 150000, qss: 150000 }[fs]
  const carStart = { single: 100000, mfj: 200000, mfs: 100000, hoh: 100000, qss: 100000 }[fs]
  const seniorStart = { single: 75000, mfj: 150000, mfs: 0, hoh: 75000, qss: 75000 }[fs]
  const v: Record<string, FieldValue> = { ...header(ret, 'f1_01[0]', 'f1_02[0]'), 'f1_03[0]': amt(res.f1040['11b'], true), 'f1_09[0]': amt(s.magi, true), 'f3_23[0]': amt(s.total, true) }
  const pages = [0]
  if (s.tipsCapped > 0) {
    const t = ret.schedule1A.qualifiedTips
    Object.assign(v, {
      'f1_12[0]': amt(t), 'f1_14[0]': amt(t), 'f1_35[0]': amt(t), 'f1_102[0]': amt(t), 'f1_103[0]': amt(s.tipsCapped),
      'f1_104[0]': amt(s.magi, true), 'f1_105[0]': amt(tipStart, true), 'f1_106[0]': amt(s.tipOtExcess, true),
      'f1_107[0]': String(Math.floor(s.tipOtExcess / 1000)), 'f1_108[0]': amt(s.tipOtReduction, true), 'f1_109[0]': amt(s.tips, true)
    })
  }
  if (s.overtimeCapped > 0) {
    const o = ret.schedule1A.qualifiedOvertime
    Object.assign(v, {
      'f2_03[0]': amt(o), 'f2_16[0]': amt(o), 'f2_38[0]': amt(o), 'f2_39[0]': amt(s.overtimeCapped),
      'f2_40[0]': amt(s.magi, true), 'f2_41[0]': amt(tipStart, true), 'f2_42[0]': amt(s.tipOtExcess, true),
      'f2_43[0]': String(Math.floor(s.tipOtExcess / 1000)), 'f2_44[0]': amt(s.tipOtReduction, true), 'f2_45[0]': amt(s.overtime, true)
    })
    pages.push(1)
  }
  if (s.carCapped > 0) {
    const c = ret.schedule1A.carLoanInterest
    Object.assign(v, {
      'f3_01[0]': ret.schedule1A.vehicleVin, 'f3_03[0]': amt(c), 'c3_1[0]': true, 'c3_2[0]': true,
      'f3_07[0]': amt(c), 'f3_08[0]': amt(s.carCapped), 'f3_09[0]': amt(s.magi, true), 'f3_10[0]': amt(carStart, true),
      'f3_11[0]': amt(s.carExcess, true), 'f3_12[0]': String(Math.ceil(s.carExcess / 1000)), 'f3_13[0]': amt(s.carReduction, true), 'f3_14[0]': amt(s.carLoanInterest, true)
    })
  }
  if (s.senior > 0) {
    Object.assign(v, {
      'f3_15[0]': amt(s.magi, true), 'f3_16[0]': amt(seniorStart, true), 'f3_17[0]': amt(s.seniorExcess, true),
      'f3_18[0]': amt(s.seniorExcess * 0.06, true), 'f3_19[0]': amt(s.seniorEach, true), 'f3_20[0]': amt(s.seniorTaxpayer),
      'f3_21[0]': joint ? amt(s.seniorSpouse) : '', 'f3_22[0]': amt(s.senior, true)
    })
  }
  pages.push(2)
  return { id: 's1a', file: 'f1040s1a.pdf', title: 'Schedule 1-A (2026 draft)', values: v, pages }
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
    else if (fill.id === 's1a') forms.push(schedule1A(ret, res))
    else if (fill.id === 's2') forms.push(schedule2(ret, res))
    else if (fill.file === 'f1040sc.pdf') forms.push(SCHEDULE_C_2026(fill))
    else if (fill.file === 'f1040se.pdf') forms.push(SCHEDULE_E_2026(fill, ret))
    else if (fill.id === '8995') forms.push(FORM_8995_2026(fill, res))
    else if (fill.id === '2441') forms.push(FORM_2441_2026(fill, ret))
    else if (fill.id === '8582') forms.push(UNPAD_2026(fill))
    else if (fill.file === 'f5329.pdf') forms.push(FORM_5329_2026(fill))
    else if (fill.file === 'f4562.pdf') forms.push(FORM_4562_2026(fill))
    else if (fill.file === 'f4797.pdf') forms.push(FORM_4797_2026(fill))
    else if (fill.file === 'f8995a.pdf') forms.push(FORM_8995A_2026(fill, res))
    else if (FORMS_2026[fill.file]) forms.push({ ...fill, title: fill.id.startsWith('st-') ? fill.title : `${fill.title} (2026 draft)` })
    else missing.add(fill.title.replace(/\s*\(.*$/, ''))
  }
  const notIncluded = [...base.notIncluded]
  if (missing.size) notIncluded.unshift(`Not in this PDF yet — the 2026 IRS draft of ${[...missing].join(', ')} has not been added to the app`)
  notIncluded.unshift('These are IRS DRAFT forms for 2026 ("DO NOT FILE"). Use them to check your numbers; file on the final forms the IRS releases in December–January.')
  return { forms, notIncluded }
}
