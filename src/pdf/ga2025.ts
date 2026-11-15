/**
 * Maps a computed Georgia return onto the Georgia DOR approved web version of Form 500 (2025):
 * public/forms/2025/ga500.pdf holds Form 500 pages 1–5 (file pages 0–4), Schedule 1 pages 1–3 (5–7),
 * IND-CR 202 (8) and the IND-CR Summary Worksheet (9). Amounts are whole dollars; the cents are printed.
 */
import type { Owner, Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { GaResult } from '../engine/ga2025.ts'
import { GA_DONATION_LINES } from '../engine/ga2025.ts'
import { STATES } from '../engine/states.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const FILE = 'ga500.pdf'
const digits = (v: string): string => v.replace(/\D/g, '')
const ssn = (v: string): string => { const d = digits(v); return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d }
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return String(v)
}
const upper = (s: string): string => s.trim().toUpperCase()
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const RELATIONSHIPS = ['SON', 'DAUGHTER', 'FOSTER CHILD', 'GRANDCHILD', 'GRANDPARENT', 'BROTHER', 'SISTER', 'AUNT', 'UNCLE', 'NEPHEW', 'NIECE', 'NONE', 'PARENT']
const stateName = (code: string): string => {
  const c = code.trim().toUpperCase()
  const name = STATES.find((x) => x.code === c)?.name.toUpperCase() ?? ''
  return name === 'DISTRICT OF COLUMBIA' || name ? name : ''
}
const STATUS: Record<TaxReturnInput['filingStatus'], string> = { single: 'A', mfj: 'B', mfs: 'C', hoh: 'D', qss: 'D' }

export function formGa500(ret: TaxReturnInput, res: TaxReturnResult, ga: GaResult, preparer?: PreparerInfo | null): FormFill {
  const L = ga.lines
  const d = ret.ga
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const showSpouse = joint || fs === 'mfs'
  const values: Record<string, FieldValue> = {
    TP_FIRSTNAME: upper(first), TP_MIDINIT: mi, TP_LASTNAME: upper(ret.taxpayer.lastName), TP_SSN: ssn(ret.taxpayer.ssn), TP_BIRTH_DATE: d.birthDate.taxpayer,
    SP_FIRSTNAME: showSpouse ? upper(sFirst) : '', SP_MIDINIT: showSpouse ? sMi : '', SP_LASTNAME: showSpouse ? upper(ret.spouse.lastName) : '',
    SP_SSN: showSpouse ? ssn(ret.spouse.ssn) : '', SPOUSE_BIRTH_DATE: joint ? d.birthDate.spouse : '',
    ADDRESS_L1: upper(c.street), ADDRESS_L2: upper(c.apt), CITY: upper(c.city), STATE: upper(c.state).slice(0, 2), ZIP5: digits(c.zip).slice(0, 9),
    'DL/STATE_ID': upper(d.driversLicense).slice(0, 9), STATELIST: d.driversLicense.trim() ? stateName(d.driversLicenseState) : '',
    L4_RESIDENCY_STATUS: '1', L5_FILING_STATUS: STATUS[fs],
    L7A: L['7a'] ? String(L['7a']) : '', L7B: L['7b'] ? String(L['7b']) : '', L7C: L['7c'] ? String(L['7c']) : '',
    L8: amt(L['8'], true), L9: amt(L['9']), L10: amt(L['10'], true),
    L11: amt(L['11']), L12A: amt(L['12a']), L12B: amt(L['12b']), L12C: amt(L['12c']), L13: amt(L['13'], true),
    L14_7C: L['7c'] ? String(L['7c']) : '', L14: amt(L['14']), L15A: amt(L['15a'], true), L15B: amt(L['15b']), L15C: amt(L['15c'], true), L16: amt(L['16'], true),
    L17A: L['17'] ? String(L['17a']) : '', L17B: L['17'] ? String(L['17b']) : '', L17: amt(L['17']),
    L18: amt(L['18']), L19: amt(L['19']), L20: amt(L['20']), L21: amt(L['21']), L22: amt(L['22']), L23: amt(L['23'], true),
    SSN_COPY: ssn(ret.taxpayer.ssn),
    L24: amt(L['24']), L25: amt(L['25']), L26: amt(L['26']), L27: amt(L['27']), L28: amt(L['28'], true),
    L29: amt(L['29']), L30: amt(L['30']), L31: amt(L['31']),
    L45: amt(L['45']), L46: amt(L['46']),
    TP_EMAIL: (d.email || c.email).trim().slice(0, 30)
  }
  for (const k of GA_DONATION_LINES) values[`L${k}`] = amt(L[k])
  ret.dependents.slice(0, 4).forEach((x, i) => {
    const n = i + 1
    const parts = x.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop() ?? '' : ''
    values[`L7_DEP${n}_NAME_INIT`] = upper(parts.join(' ')).slice(0, 15)
    values[`L7_DEP${n}_LASTNAME`] = upper(last).slice(0, 17)
    values[`L7_DEP${n}_SSN`] = ssn(x.ssn)
    const rel = upper(x.relationship)
    const listed = RELATIONSHIPS.find((o) => o === rel || (o === 'GRANDCHILD' && /GRAND(SON|DAUGHTER)/.test(rel)) || (o === 'PARENT' && /^(MOTHER|FATHER)$/.test(rel)))
    values[`L7_DEP${n}_REL_LST`] = listed ?? 'OTHER'
    values[`L7_DEP${n}_REL`] = listed ? '' : rel.slice(0, 17)
  })
  for (let n = ret.dependents.length + 1; n <= 4; n++) { values[`L7_DEP${n}_REL_LST`] = ''; values[`L7_DEP${n}_REL`] = '' }
  // Income statements A–F: W-2s with Georgia withholding.
  const statements = ga.statements.filter((x) => x.tax > 0)
  statements.slice(0, 6).forEach((x, i) => {
    const s = 'ABCDEF'[i]
    values[`CB_WH_TYPE_${s}.0.0`] = 'W-2s'
    values[`CB_ID_TYPE_${s}`] = 'FEIN'
    values[`ID_${s}`] = digits(x.ein).slice(0, 9)
    values[`WH_ID_${s}`] = upper(x.stateId).replace(/[^0-9A-Z]/g, '').slice(0, 10)
    values[`WAGES_INCOME_${s}`] = amt(x.wages, true)
    values[`TAX_WH_${s}`] = amt(x.tax, true)
  })
  const phone = digits(c.phone).slice(-10)
  if (phone) values.TP_PHONE = `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`
  if (L['46'] > 0 && ret.refundDeposit.routingNumber && ret.refundDeposit.accountNumber) {
    values.CB_DD_TYPE = ret.refundDeposit.accountType === 'savings' ? 'S' : 'C'
    values.RTNUMBER = digits(ret.refundDeposit.routingNumber)
    values.ACCNUMBER = ret.refundDeposit.accountNumber.replace(/[^0-9A-Za-z-]/g, '').slice(0, 17)
  }
  if (ret.usePaidPreparer && preparer) {
    values.PREP_NAME = upper(preparer.name).slice(0, 20)
    values.PREP_FIRMNAME = upper(preparer.firmName).slice(0, 20)
    values.PREP_SSN = preparer.ptin.toUpperCase().slice(0, 11)
    values.PREP_FEIN = digits(preparer.firmEin).slice(0, 10)
    values.PREP_PHONE = digits(preparer.phone).slice(-10)
  }
  return { id: 'ga500', file: FILE, title: 'Georgia Form 500', values, pages: [0, 1, 2, 3, 4] }
}

export function scheduleGa1(ret: TaxReturnInput, ga: GaResult): FormFill {
  const S = ga.schedule1
  const d = ret.ga
  const values: Record<string, FieldValue> = {
    SSN_COPY: ssn(ret.taxpayer.ssn),
    S1L1: amt(S['1']), S1L5: amt(S['5']), S1L5_OTHER: S['5'] ? 'SEE STATEMENT' : '', S1L6: amt(S['6']),
    S1L7A: amt(S['7a']), S1L7B: amt(S['7b']), S1L7C: amt(S['7c']), S1L7D: amt(S['7d']), S1L7E: amt(S['7e']), S1L7F: amt(S['7f']),
    S1L8: amt(S['8']), S1L9: amt(S['9']), S1L10: amt(S['10']), S1L12: amt(S['12']), S1L12_ADJ1: S['12'] ? 'SEE STATEMENT' : '',
    S1L13: amt(S['13']), S1L14: amt(S['14'], true)
  }
  if (S['7c']) { values.S1TP_DISABDATE = d.disabilityDate.taxpayer; values.S1TP_DISABTYPE = 'TOTAL' }
  if (S['7f']) { values.S1SP_DISABDATE = d.disabilityDate.spouse; values.S1SP_DISABTYPE = 'TOTAL' }
  const pages = [5]
  const pre: Record<Owner, string> = { taxpayer: 'TP', spouse: 'SP' }
  const owners: Owner[] = ['taxpayer', 'spouse']
  if (owners.some((o) => ga.retirement[o].exclusion > 0)) {
    pages.push(6)
    for (const o of owners) {
      const p = ga.retirement[o]
      if (!(p.exclusion > 0)) continue
      for (let i = 1; i <= 17; i++) if (i !== 4) values[`${pre[o]}_S1L${i}`] = amt(p.lines[String(i)], i >= 14)
    }
  }
  if (owners.some((o) => ga.retirement[o].military.exclusion > 0)) {
    pages.push(7)
    for (const o of owners) {
      const m = ga.retirement[o].military
      if (!(m.exclusion > 0)) continue
      for (let i = 1; i <= 8; i++) if (m.lines[String(i)] !== undefined) values[`${pre[o]}_S1L${i}_P3`] = amt(m.lines[String(i)], true)
    }
  }
  return { id: 'ga500s1', file: FILE, title: 'Georgia Form 500 Schedule 1', values, pages }
}

export function formGaIndCr(ret: TaxReturnInput, res: TaxReturnResult, ga: GaResult): FormFill {
  const care = Math.min(ga.indCr.care, ga.lines['20'])
  const values: Record<string, FieldValue> = {
    SSN_COPY: ssn(ret.taxpayer.ssn),
    CRP2L1: amt(res.schedule3.dependentCare), CRP2L3: amt(ga.indCr.care), CRP2L4: amt(care),
    SUML2: amt(care), SUML12: amt(ga.lines['20'])
  }
  return { id: 'gaindcr', file: FILE, title: 'Georgia Form IND-CR 202 and Summary Worksheet', values, pages: [8, 9] }
}

export function buildGaPacket(ret: TaxReturnInput, res: TaxReturnResult, ga: GaResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formGa500(ret, res, ga, preparer)]
  const S = ga.schedule1
  if (S['6'] !== 0 || S['13'] !== 0) forms.push(scheduleGa1(ret, ga))
  if (ga.indCr.care > 0) forms.push(formGaIndCr(ret, res, ga))
  const notIncluded = ga.attach.filter((a) => !a.startsWith('Form 500 Schedule 1') && !a.startsWith('Schedule 1 page') && !a.startsWith('Form IND-CR 202'))
  if (ga.indCr.other > 0) notIncluded.push('The IND-CR schedules for your other Georgia credits (the summary line 13 total is on Form 500 line 20)')
  if (ret.dependents.length > 4) notIncluded.push('A list of dependents beyond the first four (line 7d)')
  if (ga.statements.filter((x) => x.tax > 0).length > 6) notIncluded.push('More than six income statements: list the rest on an extra page')
  if (ret.ga.withholding1099 > 0 || ret.ga.otherWithholding > 0) notIncluded.push('Income statements for 1099s and G2 forms with Georgia withholding (only W-2s are filled in)')
  if (S['5'] > 0 || S['12'] > 0) notIncluded.push('A statement listing your other Schedule 1 additions or subtractions')
  return { forms, notIncluded }
}
