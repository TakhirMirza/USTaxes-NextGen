/**
 * Maps a computed Ohio return onto the Ohio Department of Taxation 2025 IT 1040 fillable bundle
 * (public/forms/2025/oh1040.pdf): IT 1040 (file pages 0–1), Schedule of Adjustments (2–3), Schedule of
 * Business Income (4–5), Schedule of Credits (6–7), Schedule of Dependents (8–9) and Schedule of Ohio
 * Withholding (10–11). Amounts are whole dollars; negative amounts use the separate "-" box.
 */
import type { OtherWithholding, Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { OhResult } from '../engine/oh2025.ts'
import { OH_DONATION_LETTERS } from '../engine/oh2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

const FILE = 'oh1040.pdf'
const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.abs(Math.round(n))
  if (v === 0) return keepZero ? '0' : ''
  return String(v)
}
const neg = (n: number | undefined): string => (n !== undefined && Math.round(n) < 0 ? '-' : '')
const upper = (s: string): string => s.trim().toUpperCase()
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const STATUS: Record<TaxReturnInput['filingStatus'], string> = { single: '1', hoh: '1', qss: '1', mfj: '2', mfs: '3' }
const ssnHeader = (ret: TaxReturnInput): Record<string, FieldValue> => ({ TP_SSN1: digits(ret.taxpayer.ssn) })
/** MM/DD/YYYY or YYYY-MM-DD to MM-DD-YYYY. */
const dob = (v: string): string => {
  const t = v.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (iso) return `${iso[2]}-${iso[3]}-${iso[1]}`
  return t.replace(/\//g, '-')
}

export function formOh1040(ret: TaxReturnInput, res: TaxReturnResult, oh: OhResult, preparer?: PreparerInfo | null): FormFill {
  const L = oh.lines
  const d = ret.oh
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const values: Record<string, FieldValue> = {
    ...ssnHeader(ret),
    TP_SSN: digits(ret.taxpayer.ssn), SP_SSN: joint ? digits(ret.spouse.ssn) : '', SD_NUM: digits(d.schoolDistrict).slice(0, 4),
    TP_FN: upper(first).slice(0, 15), TP_MI: mi, TP_LN: upper(ret.taxpayer.lastName).slice(0, 22),
    SP_FN: joint ? upper(sFirst).slice(0, 15) : '', SP_MI: joint ? sMi : '', SP_LN: joint ? upper(ret.spouse.lastName).slice(0, 22) : '',
    ADDRESS1: upper(c.street).slice(0, 35), ADDRESS2: upper(c.apt).slice(0, 35), CITY: upper(c.city).slice(0, 20), STATE: upper(c.state).slice(0, 2), ZIP: digits(c.zip).slice(0, 5),
    COUNTY: upper(d.county).replace(/[^A-Z]/g, '').slice(0, 4),
    CHK_PRIM_RES: '1', CHK_FILING_STATUS: STATUS[fs],
    SP_SSN_SEP: fs === 'mfs' ? digits(ret.spouse.ssn) : '',
    CHK_CLAIM_DEP: ret.canBeClaimedAsDependent,
    L1: amt(L['1'], true), L1_NEG: neg(L['1']), L2A: amt(L['2a']), L2B: amt(L['2b']), L3: amt(L['3'], true), L3_NEG: neg(L['3']),
    L4: amt(L['4'], true), L4_EXEMPT: String(oh.exemptionCount), L5: amt(L['5'], true), L6: amt(L['6']), L7: amt(L['7'], true),
    L7a: amt(L['7'], true), L8A: amt(L['8a'], true), L8B: amt(L['8b']), L8C: amt(L['8c'], true), L9: amt(L['9']), L10: amt(L['10'], true),
    L11: amt(L['11']), L12: amt(L['12']), L13: amt(L['13'], true), L14: amt(L['14']), L15: amt(L['15']), L16: amt(L['16']),
    L17: amt(L['17'], true), L19: amt(L['19'], true), L19_NEG: neg(L['19']),
    L20: amt(L['20']), L22: amt(L['22']), L23: amt(L['23']), L24: amt(L['24']), L25G: amt(L['25g']), L26: amt(L['26'])
  }
  if (joint) values.CHK_SP_RES = '1'
  for (const k of OH_DONATION_LETTERS) values[`L25${k.toUpperCase()}`] = amt(L[`25${k}`])
  const phone = digits(c.phone).slice(-10)
  if (phone) values.PHONE_NUM = phone
  if (ret.usePaidPreparer && preparer) {
    values.PREPARER_PRINTED_NAME = upper(preparer.name)
    values.PREPARER_PHONE_NUM = digits(preparer.phone).slice(-10)
    values.PREPARER_TIN = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8)
  }
  return { id: 'oh1040', file: FILE, title: 'Ohio IT 1040', values, pages: [0, 1] }
}

export function scheduleOhAdjustments(ret: TaxReturnInput, oh: OhResult): FormFill {
  const values: Record<string, FieldValue> = { ...ssnHeader(ret) }
  for (const [k, v] of Object.entries(oh.adjustments)) values[`SchedA_L${k}`] = amt(v, k === '12' || k === '47')
  return { id: 'ohadj', file: FILE, title: 'Ohio Schedule of Adjustments', values, pages: [2, 3] }
}

export function scheduleOhBusiness(ret: TaxReturnInput, res: TaxReturnResult, oh: OhResult): FormFill {
  const B = oh.business
  const values: Record<string, FieldValue> = { ...ssnHeader(ret) }
  for (const [k, v] of Object.entries(B)) {
    values[`SchedITBUS_L${k}`] = amt(v, ['10', '11', '13'].includes(k))
    if (['2', '3', '4', '6', '9', '10'].includes(k)) values[`SchedITBUS_L${k}_NEG`] = neg(v)
  }
  const joint = ret.filingStatus === 'mfj'
  const sources = [
    ...res.scheduleC.filter((x) => joint || x.owner === 'taxpayer').map((x) => ({ name: x.name, id: x.owner === 'spouse' ? ret.spouse.ssn : ret.taxpayer.ssn, owner: x.owner })),
    ...ret.k1s.filter((k) => k.materialParticipation && (joint || k.owner === 'taxpayer')).map((k) => ({ name: k.entityName, id: k.ein, owner: k.owner }))
  ]
  const pages = [4]
  if (sources.length > 0) {
    pages.push(5)
    sources.slice(0, 8).forEach((s, i) => {
      const n = i + 1
      values[`SchedITBUS_L${n}_NAME`] = upper(s.name).slice(0, 40)
      values[`SchedITBUS_L${n}_FEIN_SSN`] = digits(s.id).slice(0, 9)
      values[s.owner === 'spouse' ? `SchedITBUS_L${n}_SP_PCT_INT` : `SchedITBUS_L${n}_PRIM_PCT_INT`] = '100'
    })
  }
  return { id: 'ohbus', file: FILE, title: 'Ohio Schedule of Business Income', values, pages }
}

export function scheduleOhCredits(ret: TaxReturnInput, oh: OhResult): FormFill {
  const C = oh.credits
  const values: Record<string, FieldValue> = { ...ssnHeader(ret) }
  for (const [k, v] of Object.entries(C)) values[`SchedC_L${k}`] = amt(v, ['1', '11', '37', '40'].includes(k))
  if (C['12'] > 0) values.SchedC_L12_JFC = String(Math.round(oh.jointPercent * 100))
  return { id: 'ohcred', file: FILE, title: 'Ohio Schedule of Credits', values, pages: [6, 7] }
}

export function scheduleOhDependents(ret: TaxReturnInput): FormFill {
  const values: Record<string, FieldValue> = { ...ssnHeader(ret) }
  ret.dependents.slice(0, 15).forEach((x, i) => {
    const n = i + 1
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    const midInitial = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? (parts.pop() ?? '').replace('.', '') : ''
    values[`SchedJ_L${n}_DEP_SSN`] = digits(x.ssn)
    values[`SchedJ_L${n}_DEP_DOB`] = dob(ret.oh.dependentBirthDates[x.id] ?? '')
    values[`SchedJ_L${n}_DEP_RS`] = upper(x.relationship).slice(0, 15)
    values[`SchedJ_L${n}_DEP_FN`] = upper(parts.join(' ')).slice(0, 15)
    values[`SchedJ_L${n}_DEP_MI`] = upper(midInitial)
    values[`SchedJ_L${n}_DEP_LN`] = upper(last).slice(0, 20)
  })
  return { id: 'ohdep', file: FILE, title: 'Ohio Schedule of Dependents', values, pages: ret.dependents.length > 7 ? [8, 9] : [8] }
}

export function scheduleOhWithholding(ret: TaxReturnInput, oh: OhResult, copy = 0): FormFill {
  const values: Record<string, FieldValue> = { ...ssnHeader(ret), ...(copy ? {} : { SchedW_A: amt(oh.lines['14'], true) }) }
  const ps = (o: string): string => (o === 'spouse' ? 'S' : 'P')
  oh.withholding.w2.filter((x) => x.tax > 0).slice(copy * 7, copy * 7 + 7).forEach((x, i) => {
    const n = i + 1
    values[`SchedW_B_L${n}_PS`] = ps(x.owner)
    values[`SchedW_B_L${n}_EIN`] = digits(x.ein).slice(0, 9)
    values[`SchedW_B_L${n}_WAGE`] = amt(x.wages, true)
    values[`SchedW_B_L${n}_FITW`] = amt(x.federal, true)
    values[`SchedW_B_L${n}_OHID`] = digits(x.stateId).slice(0, 8)
    values[`SchedW_B_L${n}_OHWAGE`] = amt(x.ohWages, true)
    values[`SchedW_B_L${n}_OHIT`] = amt(x.tax, true)
  })
  const r = oh.withholding.r1099.filter((x) => x.tax > 0).slice(copy * 4)
  r.slice(0, 4).forEach((x, i) => {
    const n = i + 1
    values[`SchedW_C_L${n}_PS`] = ps(x.owner)
    values[`SchedW_C_L${n}_TIN`] = digits(x.ein).slice(0, 9)
    values[`SchedW_C_L${n}_GROSS`] = amt(x.gross, true)
    values[`SchedW_C_L${n}_DIST`] = upper(x.code).slice(0, 2)
    values[`SchedW_C_L${n}_OHID`] = digits(x.stateId).slice(0, 8)
    values[`SchedW_C_L${n}_FITW`] = amt(x.federal, true)
    values[`SchedW_C_L${n}_OHTW`] = amt(x.tax, true)
  })
  const other = ohOtherWithholding(ret)
  const d = other.w2g.slice(copy * 2, copy * 2 + 2)
  d.forEach((x, i) => {
    const n = i + 1
    values[`SchedW_D_L${n}_PS`] = ps(x.owner)
    values[`SchedW_D_L${n}_FEDID`] = digits(x.payerId).slice(0, 9)
    values[`SchedW_D_L${n}_WIN`] = amt(x.fedIncome, true)
    values[`SchedW_D_L${n}_FITW`] = amt(x.federal, true)
    values[`SchedW_D_L${n}_OHID`] = digits(x.stateId).slice(0, 8)
    values[`SchedW_D_L${n}_OHWIN`] = amt(x.income, true)
    values[`SchedW_D_L${n}_OHTW`] = amt(x.tax, true)
  })
  const e = other.nec[copy]
  if (e) Object.assign(values, { SchedW_E_L1_PS: ps(e.owner), SchedW_E_L1_TIN: digits(e.payerId).slice(0, 9), SchedW_E_L1_COMP: amt(e.fedIncome, true), SchedW_E_L1_FITW: amt(e.federal, true), SchedW_E_L1_OHID: digits(e.stateId).slice(0, 8), SchedW_E_L1_OHINC: amt(e.income, true), SchedW_E_L1_OHTW: amt(e.tax, true) })
  const f = other.g[copy]
  if (f) Object.assign(values, { SchedW_F_L1_PS: ps(f.owner), SchedW_F_L1_TIN: digits(f.payerId).slice(0, 9), SchedW_F_L1_COMP: amt(f.fedIncome, true), SchedW_F_L1_FITW: amt(f.federal, true), SchedW_F_L1_OHID: digits(f.stateId).slice(0, 8), SchedW_F_L1_OHTW: amt(f.tax, true) })
  const page2 = r.length > 0 || d.length > 0 || !!e || !!f
  return { id: copy ? `ohwh-${copy + 1}` : 'ohwh', file: FILE, title: copy ? `Schedule of Ohio Withholding (additional page ${copy})` : 'Schedule of Ohio Withholding', values, pages: page2 ? [10, 11] : [10] }
}

/** Listed W-2G, 1099-NEC and 1099-G statements behind the Ohio "other withholding" amount (Parts D, E and F). */
export function ohOtherWithholding(ret: TaxReturnInput): { w2g: OtherWithholding[]; nec: OtherWithholding[]; g: OtherWithholding[] } {
  const rows = (ret.withholdingLists?.['oh.otherWithholding'] ?? []).filter((x) => x.tax > 0)
  return { w2g: rows.filter((x) => x.kind === 'W-2G'), nec: rows.filter((x) => x.kind === '1099-NEC'), g: rows.filter((x) => x.kind !== 'W-2G' && x.kind !== '1099-NEC') }
}

export function buildOhPacket(ret: TaxReturnInput, res: TaxReturnResult, oh: OhResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formOh1040(ret, res, oh, preparer)]
  if (oh.lines['2a'] > 0 || oh.lines['2b'] > 0) forms.push(scheduleOhAdjustments(ret, oh))
  if (oh.business['10'] !== 0) forms.push(scheduleOhBusiness(ret, res, oh))
  if (oh.credits['40'] > 0) forms.push(scheduleOhCredits(ret, oh))
  if (ret.dependents.length > 0) forms.push(scheduleOhDependents(ret))
  if (oh.lines['14'] > 0) {
    const w = oh.withholding.w2.filter((x) => x.tax > 0).length
    const r = oh.withholding.r1099.filter((x) => x.tax > 0).length
    const o = ohOtherWithholding(ret)
    const n = Math.max(1, Math.ceil(w / 7), Math.ceil(r / 4), Math.ceil(o.w2g.length / 2), o.nec.length, o.g.length)
    for (let k = 0; k < n; k++) forms.push(scheduleOhWithholding(ret, oh, k))
  }
  const notIncluded = oh.attach.filter((a) => !/^Ohio Schedule of|^Schedule of Ohio Withholding/.test(a))
  if (oh.lines['14'] > 0) notIncluded.push('State copies of your W-2s and 1099s with Ohio withholding (place them after the last page)')
  if (ret.oh.otherWithholding > 0 && !(ret.withholdingLists?.['oh.otherWithholding'] ?? []).some((x) => x.tax > 0)) notIncluded.push('Schedule of Ohio Withholding Parts D–F: list your W-2G, 1099-NEC and 1099-G statements (their tax is in the Part A total)')
  forms.push(...dependentsStatement(ret, 15, 'Schedule of Dependents (continued)', 'st-oh-deps'))
  return { forms, notIncluded }
}
