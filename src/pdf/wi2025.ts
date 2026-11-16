/**
 * Maps a computed Wisconsin return onto the Wisconsin Department of Revenue fillable Form 1 (2025):
 * public/forms/2025/wi1.pdf, pages 1–5 (Schedules 1, 2 and 3 are on pages 4 and 5). Whole dollars, no commas.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { WiResult } from '../engine/wi2025.ts'
import { WI_DONATION_LINES } from '../engine/wi2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return v < 0 ? `-${-v}` : String(v)
}
const upper = (s: string): string => s.trim().toUpperCase()
const firstAndInitial = (first: string): [string, string] => {
  const parts = first.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [first.trim(), '']
}
const ssnParts = (ssn: string, a: string, b: string, c: string): Record<string, string> => {
  const s = digits(ssn)
  return { [a]: s.slice(0, 3), [b]: s.slice(3, 5), [c]: s.slice(5, 9) }
}

export function formWi1(ret: TaxReturnInput, res: TaxReturnResult, wi: WiResult, preparer?: PreparerInfo | null): FormFill {
  const L = wi.lines
  const d = ret.wi
  const c = ret.contact
  const [first, mi] = firstAndInitial(ret.taxpayer.firstName)
  const [sFirst, sMi] = firstAndInitial(ret.spouse.firstName)
  const joint = wi.status === 'mfj'
  const spouseOnTop = joint || wi.status === 'mfs' || (wi.status === 'hoh' && d.hohMarried)
  const status = wi.status === 'single' ? 'Single' : joint ? 'Joint' : wi.status === 'mfs' ? 'Married Separate' : d.hohMarried ? 'Head Household Married' : 'Head Household NOT Married'
  const values: Record<string, FieldValue> = {
    lname: upper(ret.taxpayer.lastName), fname: upper(first), mi,
    ...ssnParts(ret.taxpayer.ssn, 'ss3', 'ss2', 'ss4'),
    splname: joint ? upper(ret.spouse.lastName) : '', sfname: joint ? upper(sFirst) : '', smi: joint ? sMi : '',
    ...(spouseOnTop ? ssnParts(ret.spouse.ssn, 'sss3', 'sss2', 'sss4') : {}),
    address: upper(c.street), apt: upper(c.apt), city: upper(c.city), state: upper(c.state).slice(0, 2), zip: digits(c.zip).slice(0, 9),
    status,
    reside99: upper(d.districtName), county: upper(d.county), schdist: digits(d.schoolDistrict).slice(0, 4),
    line1: amt(L['1'], true), '2': amt(L['2']), '3': amt(L['3'], true), '3wages': amt(L['3w']), '4': amt(L['4']), '5': amt(L['5'], true),
    '6': amt(L['6']), '7': amt(L['7'], true), '8': amt(L['8'], true), '8a': ret.canBeClaimedAsDependent, '9': amt(L['9'], true),
    '10a': String(L['10aN'] || ''), line10a: amt(L['10a']), '10b': L['10bN'] ? String(L['10bN']) : '', line10b: amt(L['10b']), '10c': amt(L['10c']),
    you: wi.exemptions.age65 > 0 && (ret.taxpayer.age65OrOlder || ret.taxpayer.age >= 65),
    spouse: joint && (ret.spouse.age65OrOlder || ret.spouse.age >= 65),
    // Page 2.
    lnamepg2: upper(ret.taxpayer.lastName), fnamepg2: upper(first), ...ssnParts(ret.taxpayer.ssn, 'ss3pg2', 'ss2pg2', 'ss4pg2'),
    '11': amt(L['11'], true), '12': amt(L['12'], true), '13': amt(L['13']), '14': amt(L['14']),
    '16a': amt(d.rentHeatIncluded), '16aa': amt(d.rentHeatNotIncluded), Line16aaa: amt(L['16a']), '16b': amt(d.propertyTaxes), '16bb': amt(L['16b']),
    '18': amt(L['18']), '19': amt(L['19']), '20': amt(L['20']), '20-StateAbb': L['20'] > 0 ? upper(d.otherStateCode).slice(0, 2) : '',
    '21': amt(L['21']), '22': amt(L['22'], true), '23': amt(L['23']), '23-checkbox': L['23'] === 0, '24': amt(L['24']), '27': amt(L['27'], true),
    line28: amt(L['28']), line29: amt(L['29']),
    '30': L['30'] > 0 ? String(Math.min(9, L['30n'])) : '', '30a': L['30'] > 0 ? amt(L['30a']) : '', '30percent': L['30'] > 0 ? String(wi.eicPercent) : '', line30: amt(L['30']),
    '33': amt(L['33']),
    // Page 3.
    lnamepg3: upper(ret.taxpayer.lastName), fnamepg3: upper(first), ...ssnParts(ret.taxpayer.ssn, 'ss3pg3', 'ss2pg3', 'ss4pg3'),
    '35': amt(L['35']), '37': amt(L['37'], true), '39': amt(L['39'], true), '40': amt(L['40']), '41': amt(L['41']), '42': amt(L['42']),
    '43': amt(L['43']), '45': amt(L['45']),
    // Page 4: Schedules 1 and 2.
    lnamepg4: upper(ret.taxpayer.lastName), fnamepg4: upper(first), ...ssnParts(ret.taxpayer.ssn, 'ss3pg4', 'ss2pg4', 'ss4pg4'),
    // Page 5: Schedule 3.
    lnamepg5: upper(ret.taxpayer.lastName), fnamepg5: upper(first),
    // The form's on-screen help note must not print.
    Purpose: ''
  }
  if (d.districtType) values.district = d.districtType
  if (wi.status === 'mfs' || (wi.status === 'hoh' && d.hohMarried)) {
    values.lastname = upper(ret.spouse.lastName)
    values.firstname = upper(sFirst)
    values.mi2 = sMi
  }
  const S1 = wi.sch1
  if (L['13'] > 0) {
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '9']) values[`sch1-${k}`] = amt(S1[k], true)
  }
  const S2 = wi.sch2
  if (L['18'] > 0) {
    for (const col of ['a', 'b']) for (const k of ['1', '2', '3', '4', '5']) values[`sch2${col}-${k}`] = amt(S2[`${col}${k}`], k === '3' || k === '5')
    values['sch2-6'] = amt(S2['6'])
    values['sch2-8'] = amt(S2['8'])
  }
  const DON: Record<string, string> = { '1a': 'sch3-1a', '1b': 'sch3-1b', '1c': 'sch3-1c', '1d': 'sch3-1d', '1e': 'sch3-1e', '1f': 'sch3-1f', '1g': 'sch3-1g', '1h': 'sch3-1h' }
  for (const k of WI_DONATION_LINES) values[DON[k]] = amt(L[`d${k}`])
  values['sch3-2'] = amt(L['24'])
  values.phone2 = digits(c.phone).slice(-7)
  values.area2 = digits(c.phone).slice(-10, -7)
  if (ret.usePaidPreparer && preparer) values.allow = 'no'
  const pages = [0, 1, 2]
  if (L['13'] > 0 || L['18'] > 0) pages.push(3)
  if (L['24'] > 0) pages.push(4)
  return { id: 'wi1', file: 'wi1.pdf', title: 'Wisconsin Form 1', values, pages }
}

export function buildWiPacket(ret: TaxReturnInput, res: TaxReturnResult, wi: WiResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formWi1(ret, res, wi, preparer)]
  const notIncluded = [...wi.attach]
  if (!ret.wi.districtType || !ret.wi.districtName.trim()) notIncluded.push('Page 1: check city, village or town and fill in your tax district and county')
  if (!ret.wi.schoolDistrict.trim()) notIncluded.push('Page 1: your 4-digit school district number')
  return { forms, notIncluded }
}
