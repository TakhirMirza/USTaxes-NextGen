/**
 * Maps a computed Wisconsin return onto the Wisconsin Department of Revenue fillable Form 1 (2025):
 * public/forms/2025/wi1.pdf, pages 1–5 (Schedules 1, 2 and 3 are on pages 4 and 5). Whole dollars, no commas.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { WiResult } from '../engine/wi2025.ts'
import { WI_DONATION_LINES } from '../engine/wi2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { lineFor, scheduleDLines, withDefaults } from '../engine/capital.ts'
import type { ScheduleDLine } from '../engine/capital.ts'

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

const names = (ret: TaxReturnInput, joint: boolean): string =>
  [ret.taxpayer, ...(joint ? [ret.spouse] : [])].map((p) => `${p.firstName.trim()} ${p.lastName.trim()}`.trim()).join(' and ')
const schedHeader = (ret: TaxReturnInput, wi: WiResult, name: string, a: string, b: string, c: string): Record<string, FieldValue> =>
  ({ [name]: names(ret, wi.status === 'mfj'), ...ssnParts(ret.taxpayer.ssn, a, b, c) })

/** Schedule SB (subtractions from income). */
export function scheduleWiSb(ret: TaxReturnInput, wi: WiResult): FormFill | null {
  const SB = wi.sb
  if (wi.lines['6'] <= 0) return null
  const v: Record<string, FieldValue> = { ...schedHeader(ret, wi, 'name', 'ssn1', 'ssn2', 'ssn3'), namep2: names(ret, wi.status === 'mfj'), namep3: names(ret, wi.status === 'mfj'), ...ssnParts(ret.taxpayer.ssn, 'ssn1a', 'ssn2a', 'ssn3a') }
  const age67 = ret.taxpayer.age >= 67 || (wi.status === 'mfj' && ret.spouse.age >= 67)
  const put = (line: string, n: number): void => { if (n) v[line] = amt(n) }
  put('line1', SB.stateRefund); put('line2', SB.usInterest); put('line4', SB.socialSecurity); put('line5', SB.capitalGain)
  put('line6', SB.medicalInsurance); put('line9', SB.privateSchool); put('line10', SB.collegeSavings)
  put(age67 ? 'line16' : 'line13', SB.retirement)
  const p1 = SB.stateRefund + SB.usInterest + SB.socialSecurity + SB.capitalGain + SB.medicalInsurance + SB.privateSchool + SB.collegeSavings + SB.retirement
  v.line29 = amt(p1, true); v.line30 = amt(p1, true); v.line44 = amt(p1, true); v.line45 = amt(p1, true)
  if (SB.other) { v.line49a = 'Other subtractions (see attached)'; v.line49a1 = amt(SB.other); v.line49d = amt(SB.other) }
  v.line50 = amt(wi.lines['6'], true)
  return { id: 'wi-sb', file: 'wi-sb.pdf', title: 'Wisconsin Schedule SB', values: v, pages: SB.other ? [0, 1, 2] : [0, 1, 2] }
}

/** Schedule AD (additions to income). */
export function scheduleWiAd(ret: TaxReturnInput, wi: WiResult): FormFill | null {
  const AD = wi.ad
  if (wi.lines['4'] <= 0) return null
  const v: Record<string, FieldValue> = { ...schedHeader(ret, wi, 'name', 'ssn1', 'ssn2', 'ssn3'), namep2: names(ret, wi.status === 'mfj'), ...ssnParts(ret.taxpayer.ssn, 'ssn1a', 'ssn2a', 'ssn3a') }
  if (AD.bonds) v.line1 = amt(AD.bonds)
  if (AD.capitalLoss) v.line2 = amt(AD.capitalLoss)
  const p1 = AD.bonds + AD.capitalLoss
  v.line26 = amt(p1, true); v.line27 = amt(p1, true)
  if (AD.other) { v.line32a = 'Other additions (see attached)'; v.line32aa = amt(AD.other); v['line 32d'] = amt(AD.other) }
  v['line 33'] = amt(wi.lines['4'], true)
  return { id: 'wi-ad', file: 'wi-ad.pdf', title: 'Wisconsin Schedule AD', values: v }
}

/** Schedule WD (Wisconsin capital gains and losses): federal amounts, the 30% long-term exclusion and the $500 loss limit. */
export function scheduleWiWd(ret: TaxReturnInput, res: TaxReturnResult, wi: WiResult): FormFill | null {
  if (!wi.sb.capitalGain && !wi.ad.capitalLoss && !(res.scheduleD.net < 0)) return null
  const d = res.scheduleD
  const L = scheduleDLines(ret.capitalTransactions)
  const any = (l: ScheduleDLine): boolean => ret.capitalTransactions.some((t) => lineFor(withDefaults(t)) === l)
  const v: Record<string, FieldValue> = { ...schedHeader(ret, wi, 'name', 'ssn1', 'ssn2', 'ssn3'), name2: names(ret, wi.status === 'mfj'), ...ssnParts(ret.taxpayer.ssn, 'ssn1a', 'ssn2a', 'ssn3a') }
  const rows: [ScheduleDLine, string][] = [['1a', '1a'], ['1b', '1b'], ['2', '2'], ['3', '3'], ['8a', '9a'], ['8b', '9'], ['9', '10'], ['10', '11']]
  for (const [fed, wd] of rows) {
    if (!any(fed)) continue
    const t = L[fed]
    v[`${wd}d`] = amt(t.proceeds, true); v[`${wd}e`] = amt(t.basis, true)
    if (fed !== '1a' && fed !== '8a') v[`${wd}g`] = amt(t.adjustment)
    v[`${wd}h`] = amt(t.gain, true)
  }
  const capDist = ret.dividends.reduce((s, x) => s + x.capitalGainDistributions, 0)
  if (res.k1.shortTermGain) v['5'] = amt(res.k1.shortTermGain)
  if (ret.capitalLossCarryover.shortTerm) v['7'] = amt(-ret.capitalLossCarryover.shortTerm)
  v['8'] = amt(d.shortTerm, true)
  if (res.form4797.scheduleDGain) v['12'] = amt(res.form4797.scheduleDGain)
  if (res.k1.longTermGain) v['13'] = amt(res.k1.longTermGain)
  if (capDist) v['14'] = amt(capDist)
  if (ret.capitalLossCarryover.longTerm) v['16'] = amt(-ret.capitalLossCarryover.longTerm)
  v['17'] = amt(d.longTerm, true)
  const line18 = d.shortTerm + d.longTerm
  v['18'] = amt(line18, true)
  const fedLine7 = res.f1040['7a'] ?? res.f1040['7']
  let line27 = 0
  let line28 = 0
  if (line18 > 0) {
    const line19 = d.longTerm > 0 ? Math.min(d.longTerm, line18) : 0
    const line20 = Math.round(line19 * 0.3)
    line27 = line18 - line20
    Object.assign(v, { '19': amt(line19, true), '20': amt(line20, true), '26': amt(line20, true), '27': amt(line27, true) })
  } else if (line18 < 0) {
    line28 = Math.min(-line18, wi.status === 'mfs' ? 250 : 500)
    v['28'] = amt(line28, true)
  }
  const a = Math.max(0, fedLine7)
  Object.assign(v, { '29a': amt(a, true), '29b': amt(line27, true) })
  if (line27 > a) v['29c'] = amt(line27 - a)
  if (line27 < a) v['29d'] = amt(a - line27)
  const e = Math.max(0, -fedLine7)
  if (e || line28) {
    Object.assign(v, { '29e': amt(e, true), '29f': amt(line28, true) })
    if (line28 > e) v['29g'] = amt(line28 - e)
    if (line28 < e) v['29h'] = amt(e - line28)
  }
  // Part V: carryovers when the loss on line 18 is more than the loss allowed on line 28.
  if (line18 < 0 && -line18 > line28) {
    const l30 = Math.max(0, -d.shortTerm), l31 = Math.max(0, d.longTerm), l32 = Math.max(0, l30 - l31)
    const l33 = Math.min(line28, l32), l34 = l32 - l33
    const l35 = Math.max(0, -d.longTerm), l36 = Math.max(0, d.shortTerm), l37 = Math.max(0, l35 - l36)
    const l38 = line28 - l33, l39 = Math.max(0, l37 - l38)
    Object.assign(v, { '30': amt(l30, true), '31': amt(l31, true), '32': amt(l32, true), '33': amt(l33, true), '34': amt(l34, true), '35': amt(l35, true), '36': amt(l36, true), '37': amt(l37, true), '38': amt(l38, true), '39': amt(l39, true) })
  }
  return { id: 'wi-wd', file: 'wi-wd.pdf', title: 'Wisconsin Schedule WD', values: v }
}

/** Schedule CR: the credit totals entered (line 43 → Form 1 line 19; line 46 → line 35). */
export function scheduleWiCr(ret: TaxReturnInput, wi: WiResult): FormFill | null {
  const L = wi.lines
  if (L['19'] <= 0 && L['35'] <= 0) return null
  const v: Record<string, FieldValue> = { name: names(ret, wi.status === 'mfj'), name1pg2: names(ret, wi.status === 'mfj'), fein: digits(ret.taxpayer.ssn), fein1pg2: digits(ret.taxpayer.ssn) }
  if (L['19'] > 0) v['43B'] = amt(L['19'])
  if (L['35'] > 0) v['46B'] = amt(L['35'])
  return { id: 'wi-cr', file: 'wi-cr.pdf', title: 'Wisconsin Schedule CR', values: v }
}

/** Schedule OS: credit for net tax paid to another state (state code, Wisconsin income and the credit entered). */
export function scheduleWiOs(ret: TaxReturnInput, wi: WiResult): FormFill | null {
  const L = wi.lines
  if (L['20'] <= 0) return null
  const st = ret.wi.otherStateCode.trim().toUpperCase()
  const v: Record<string, FieldValue> = {
    name1: names(ret, wi.status === 'mfj'), name2: names(ret, wi.status === 'mfj'), idno1: digits(ret.taxpayer.ssn),
    sta1: st.slice(0, 1), sta1a: st.slice(1, 2), 'state1.31': amt(L['7'], true),
    'state1.38': amt(L['20']), state39: amt(L['20']), state41: amt(L['20'])
  }
  return { id: 'wi-os', file: 'wi-os.pdf', title: 'Wisconsin Schedule OS', values: v }
}

export function buildWiPacket(ret: TaxReturnInput, res: TaxReturnResult, wi: WiResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formWi1(ret, res, wi, preparer)]
  const extra: [FormFill | null, string][] = [
    [scheduleWiAd(ret, wi), 'Schedule AD'], [scheduleWiSb(ret, wi), 'Schedule SB'], [scheduleWiWd(ret, res, wi), 'Schedule WD'],
    [scheduleWiCr(ret, wi), 'Schedule CR'], [scheduleWiOs(ret, wi), 'Schedule OS']
  ]
  for (const [f] of extra) if (f) forms.push(f)
  const made = new Set(extra.filter(([f]) => f).map(([, n]) => n))
  const notIncluded = wi.attach.filter((a) => ![...made].some((n) => a.startsWith(n)))
  if (made.has('Schedule OS')) notIncluded.push('Schedule OS and the other state’s return: fill in Parts I–III from the other state’s return (the credit you entered is on lines 38–41)')
  if (made.has('Schedule CR')) notIncluded.push('Schedule CR: enter each credit on its own line (the totals you entered are on lines 43 and 46)')
  if (made.has('Schedule SB') && wi.sb.retirement) notIncluded.push(`Schedule SB: retirement subtraction is on line ${ret.taxpayer.age >= 67 || (wi.status === 'mfj' && ret.spouse.age >= 67) ? '16' : '13'}; move it if it is military (12), federal (14) or railroad (15) retirement`)
  if ((made.has('Schedule SB') && wi.sb.other) || (made.has('Schedule AD') && wi.ad.other)) notIncluded.push('A statement listing your other additions/subtractions (Schedule AD line 32, Schedule SB line 49)')
  if (!ret.wi.districtType || !ret.wi.districtName.trim()) notIncluded.push('Page 1: check city, village or town and fill in your tax district and county')
  if (!ret.wi.schoolDistrict.trim()) notIncluded.push('Page 1: your 4-digit school district number')
  return { forms, notIncluded }
}
