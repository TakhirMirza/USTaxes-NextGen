/**
 * Maps a computed Maryland return onto the Comptroller of Maryland fillable PDFs: Form 502, Form 502B
 * (dependents, taken from the 2D-barcode edition with the barcode buttons left alone) and Form 502SU,
 * stored as public/forms/2025/md502.pdf, md502b.pdf and md502su.pdf. Amounts are whole dollars.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MdResult } from '../engine/md2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(Math.abs(n))
  return v === 0 && !keepZero ? '' : String(v)
}
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const splitName = (full: string): [string, string] => {
  const parts = full.trim().split(/\s+/)
  return parts.length > 1 ? [parts.slice(0, -1).join(' '), parts[parts.length - 1]] : [full.trim(), '']
}

const STATUS_STATE = ['', 'Single', 'Married filing joint return or spouse had no income', 'Married filing separately', 'Head of household', 'Surviving Spouse with dependent child', 'Dependent taxpayer']

export function form502(ret: TaxReturnInput, res: TaxReturnResult, md: MdResult, preparer?: PreparerInfo | null): FormFill {
  const L = md.lines
  const c = ret.contact
  const m = ret.maryland
  const joint = md.status === 2
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const e = md.exemptions
  const values: Record<string, FieldValue> = {
    'Enter social security number': digits(ret.taxpayer.ssn),
    "Enter spouse's social security number": joint ? digits(ret.spouse.ssn) : '',
    'Enter your first name': first, 'Enter your middle initial': mi, 'Enter your last name': ret.taxpayer.lastName.trim(),
    "Enter Spouse's First Name": joint ? sFirst : '', "Enter Spouse's middle initial": joint ? sMi : '', "Enter Spouse's last name": joint ? ret.spouse.lastName.trim() : '',
    'Enter Current Mailing Address Line 1 (Street No. and Street Name or PO Box)': c.street,
    'Enter Current Mailing Address Line 2 (Street No. and Street Name or PO Box)': c.apt,
    'Enter city or town': c.city, 'Enter state': c.state.toUpperCase(), 'Enter zip code + 4': digits(c.zip),
    'Enter 4 Digit Political Subdivision Code (See Instruction 6)': digits(m.subdivisionCode).slice(0, 4),
    'Enter Maryland Political Subdivision (See Instruction 6)': (m.subdivisionName.trim() || md.county?.name || '').toUpperCase(),
    'Enter Maryland Physical Address Line 1 (Street No. and Street Name) (No PO Box)': c.state.toUpperCase() === 'MD' ? c.street : '',
    'Enter Maryland Physical Address Line 2 No. and Street Name) (No PO Box)': c.state.toUpperCase() === 'MD' ? c.apt : '',
    'Enter city': c.state.toUpperCase() === 'MD' ? c.city : '',
    'Physical Zip Code': c.state.toUpperCase() === 'MD' ? digits(c.zip) : '',
    'Physical Maryland County': md.county && md.county.code !== '0400' ? md.county.name.replace(/ County$/, '').toUpperCase() : '',
    'Check Box - 1': STATUS_STATE[md.status],
    "Enter spouse's social security number if filing married separately": md.status === 3 ? digits(ret.spouse.ssn) : '',
    // Exemptions
    'Check Box 15': e.a >= 1, 'Check Box 18': e.a >= 2, 'Text Field 15': e.a ? String(e.a) : '', 'Enter A $': amt(e.aAmount, e.a > 0),
    'Check Box 20': e.b > 0 && e.you65, 'Check Box 21': e.b > 0 && e.spouse65,
    'B. Check this box if you are blind': e.b > 0 && e.youBlind, 'B. Check this box if your spouse is blind': e.b > 0 && e.spouseBlind,
    'B. Enter number exemptions checked B': e.b ? String(e.b) : '', 'Enter B $ ': amt(e.bAmount),
    'Text Field 16': e.c ? String(e.c) : '', 'Enter C $ ': amt(e.cAmount, e.c > 0),
    'Text Field 17': String(e.d), 'D. Enter Dollar Amount Total Exemptions (Add A, B and C.) ': amt(e.dAmount, true),
    'Enter email addressEnter DOB if your spouse has no healthcare 2': c.email,
    // Income, additions, subtractions
    'Enter 1': amt(L['1'], true), 'Enter 1a': amt(L['1a']), 'Enter 1b': amt(L['1b']), 'Enter 1c': amt(L['1c']), 'Enter 1dEnter 1d': amt(L['1d']),
    'Enter Y of income more than $11,000': L['1e'] ? 'Y' : '',
    'Enter 2': amt(L['2']), 'Enter 3': amt(L['3']), 'Enter 4': amt(L['4']), 'Enter 5': amt(L['5']), 'Enter 6': amt(L['6']), 'Enter 7': amt(L['7'], true),
    'Enter 8': amt(L['8']), 'Enter 9': amt(L['9']),
    'Check Box 30': md.pension.taxpayer > 0, 'Check Box 31': md.pension.spouse > 0, 'Enter 10a': amt(L['10a']),
    'Enter 11': amt(L['11']), 'Enter 13': amt(L['13']), 'Enter 14': amt(L['14']), 'Enter 15': amt(L['15']), 'Enter 16': amt(L['16'], true),
    'Check Box 34': md.deduction.method === 'itemized' ? 'Itemized' : 'Standard',
    'Enter 17a ': amt(L['17a']), 'Enter 17a  2': amt(L['17b']), 'Enter 17a  3': amt(L['17c']),
    'Enter 17': amt(L['17'], true), 'Enter 18': amt(L['18'], true), 'Enter 19 ': amt(L['19'], true), 'Enter 20': amt(L['20'], true), 'Enter 19': amt(L['20a']),
    // Tax and credits
    'Text Box 30': amt(L['21'], true), 'Text Box 32': amt(L['21a']), 'Enter 17a  6': amt(L['21b']),
    'Text Box 34': amt(L['22']), 'Check Box 37': L['22'] > 0 && res.eic.qualifyingChildren > 0,
    'Text Box 36': amt(L['23']), 'Text Box 38': amt(L['24']), 'Text Box 40': amt(L['26']), 'Text Box 42': amt(L['27'], true),
    'Enter local tax rate': typeof md.county?.rate === 'number' ? String(Math.round(md.county.rate * 10000)).padStart(3, '0').replace(/^0/, '') : '',
    'Text Box 44': amt(L['28'], true), 'Text Box 46': amt(L['29']), 'Text Box 48': amt(L['30']), 'Text Box 50': amt(L['31']),
    'Text Box 52': amt(L['32']), 'Text Box 54': amt(L['33'], true), 'Text Box 56': amt(L['34'], true),
    'Text Box 58': amt(L['35']), 'Text Box 60': amt(L['36']), 'Text Box 62': amt(L['37']), 'Text Box 64': amt(L['38']), 'Text Box 90': amt(L['39']),
    'Text Box 66': amt(L['40'], true),
    'Text Box 68': amt(L['41']), 'Text Box 70': amt(L['43']), 'Text Box 72': amt(L['44']), 'Text Box 74': amt(L['45']),
    'Text Box 76': amt(L['46'], true), 'Text Box 78': amt(L['47']), 'Text Box 80': amt(L['48']), 'Text Box 82': amt(L['49']), 'Text Box 84': amt(L['50']),
    'Text Box 91': amt(L['52'], L['47'] > 0),
    'Text Box 96': digits(c.phone).slice(-10)
  }
  // Code letters for lines 5 and 13 (up to four each).
  md.additions.slice(0, 4).forEach((a, i) => { values[`Text Field ${5 + i}`] = a.code })
  md.subtractions.slice(0, 4).forEach((s, i) => { values[`Text Field ${9 + i}`] = s.code })
  const d = ret.refundDeposit
  if (L['50'] > 0 && digits(d.routingNumber).length === 9 && digits(d.accountNumber)) {
    values['Check Box 44'] = true
    values['Check Box 52'] = d.accountType === 'savings' ? 'Savings' : 'Checking'
    values['Text Box 111'] = digits(d.routingNumber)
    values['Text Box 110'] = d.accountNumber.replace(/[^0-9A-Za-z]/g, '')
    values['Text Box 102'] = joint ? `${ret.taxpayer.firstName} ${ret.taxpayer.lastName} & ${ret.spouse.firstName} ${ret.spouse.lastName}` : `${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`
  }
  if (ret.usePaidPreparer && preparer) {
    values['Text Box 108'] = preparer.firmName ? `${preparer.name} / ${preparer.firmName}` : preparer.name
    values['Text Box 104'] = preparer.firmAddress
    values['Text Box 106'] = preparer.phone
    values['Text Box 107'] = preparer.ptin.toUpperCase()
  }
  return { id: 'md502', file: 'md502.pdf', title: 'Maryland Form 502', values }
}

export function form502b(ret: TaxReturnInput, md: MdResult): FormFill {
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const joint = md.status === 2
  const regular = ret.dependents.length
  const values: Record<string, FieldValue> = {
    TP_SSN_COPY: digits(ret.taxpayer.ssn), SP_SSN_COPY: joint ? digits(ret.spouse.ssn) : '',
    TP_FIRSTNAME_COPY: first, TP_MINIT_COPY: mi, TP_LASTNAME_COPY: ret.taxpayer.lastName.trim(),
    SP_FIRSTNAME_COPY: joint ? sFirst : '', SP_MINIT_COPY: joint ? sMi : '', SP_LASTNAME_COPY: joint ? ret.spouse.lastName.trim() : '',
    '502B_TOTALBOXES_REG': String(regular), '502B_TOTALBOXES_65': md.exemptions.deps65 ? String(md.exemptions.deps65) : '',
    '502B_TOTALBOXES_TTL': String(regular + md.exemptions.deps65),
    'TP_SSN_COPY+1': ret.dependents.length > 5 ? digits(ret.taxpayer.ssn) : '',
    TP_WHOLENAME_COPY: ret.dependents.length > 5 ? `${ret.taxpayer.firstName} ${ret.taxpayer.lastName}` : ''
  }
  ret.dependents.slice(0, 12).forEach((dep, i) => {
    const n = i + 1
    const [f, l] = splitName(dep.name)
    values[`DP_FNAME${n}`] = f
    values[`DP_LNAME${n}`] = l
    values[`DP_SSN${n}`] = digits(dep.ssn)
    values[`DP_REL${n}`] = dep.relationship
    values[`DP_REG${n}`] = true
    values[`DP_65_${n}`] = dep.age >= 65
    values[`DP_BIRTHDAY${n}`] = ret.maryland.dependentBirthDates[dep.id] ?? ''
  })
  return { id: 'md502b', file: 'md502b.pdf', title: 'Maryland Form 502B', values }
}

/** Form 502SU line letter → field. */
const SU_FIELD: Record<string, number> = {
  a: 9, b: 10, c: 11, d: 12, e: 13, f: 15, g: 16, h: 17, i: 18, j: 19, k: 20, l: 21, m: 22, n: 23, o: 24, p: 25, q: 26, r: 27, s: 28, t: 29,
  u: 30, v: 31, va: 32, w: 34, xa: 35, xb: 36, xc: 37, xd: 38, xe: 39, y: 40, z: 41, aa: 42, ab: 43, bb: 44, cc: 45, cd: 46, da: 93, dd: 47,
  dm: 48, ee: 50, ff: 51, hh: 52, ii: 53, jj: 54, kk: 55, ll: 56, mm: 57, nn: 58, oo: 59, pp: 60, qq: 61, rr: 63, ss: 64, tt: 65, uu: 66,
  vv: 67, ww: 68, xx: 69, ya: 70, yb: 82, yc: 72, yd: 79, ye: 80, yf: 89
}
export const MD_SU_LETTERS = Object.keys(SU_FIELD)

export function form502su(ret: TaxReturnInput, md: MdResult): FormFill {
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const joint = md.status === 2
  const values: Record<string, FieldValue> = {
    'Text Field 1': first, 'Text Field 2': mi, 'Text Field 3': ret.taxpayer.lastName.trim(), 'Text Field 4': digits(ret.taxpayer.ssn),
    'Text Field 5': joint ? sFirst : '', 'Text Field 6': joint ? sMi : '', 'Text Field 7': joint ? ret.spouse.lastName.trim() : '', 'Text Field 8': joint ? digits(ret.spouse.ssn) : '',
    'Text Field 87': amt(md.lines['13'], true)
  }
  for (const s of md.subtractions) {
    const f = SU_FIELD[s.code]
    if (f) values[`Text Field ${f}`] = amt(s.amount)
  }
  return { id: 'md502su', file: 'md502su.pdf', title: 'Maryland Form 502SU', values }
}

/** Form 502CG: net capital gain income subject to the additional 2% tax (line 9 → Form 502 line 20a). */
export function form502cg(ret: TaxReturnInput, md: MdResult): FormFill | null {
  const C = md.cg
  if (!C) return null
  const [tf, tmi] = firstAndInitial(ret.taxpayer)
  const v: Record<string, FieldValue> = { 'Text Field 13': tf, 'Text Field 12': tmi, 'Text Field 11': ret.taxpayer.lastName.trim(), 'Text Field 10': digits(ret.taxpayer.ssn) }
  if (ret.filingStatus === 'mfj') {
    const [sf, smi] = firstAndInitial(ret.spouse)
    Object.assign(v, { 'Text Field 9': sf, 'Text Field 8': smi, 'Text Field 7': ret.spouse.lastName.trim(), 'Text Field 6': digits(ret.spouse.ssn) })
  }
  v['Text Box 69'] = amt(C['1'], true)
  if (C['1a']) v['Text Field 15'] = amt(C['1a'])
  ;['2', '3', '4', '5', '6', '7'].forEach((k, i) => { if (C[k]) v[`Text Box ${71 + i}`] = amt(C[k]) })
  v['Text Box 77'] = amt(C['8'], true)
  v['Text Box 78'] = amt(C['9'], true)
  return { id: 'md502cg', file: 'md502cg.pdf', title: 'Maryland Form 502CG', values: v, pages: [0] }
}

const ROTH = /[JQT]/i

/** Form 502R: retirement income by source (Parts 1–6). */
export function form502r(ret: TaxReturnInput, md: MdResult): FormFill | null {
  if (!ret.retirement.length && !ret.socialSecurity.length && md.lines['10a'] <= 0) return null
  const joint = md.status === 2
  const [tf, tmi] = firstAndInitial(ret.taxpayer)
  const [sf, smi] = firstAndInitial(ret.spouse)
  const v: Record<string, FieldValue> = {
    'Text Field 1': tf, 'Text Field 2': tmi, 'Text Field 3': ret.taxpayer.lastName.trim(), 'Text Field 4': digits(ret.taxpayer.ssn),
    'Text Field 9': ret.taxpayer.age ? String(ret.taxpayer.age) : '', 'Check Box 1': !!ret.maryland.totallyDisabled.taxpayer
  }
  if (joint) Object.assign(v, {
    'Text Field 5': sf, 'Text Field 6': smi, 'Text Field 7': ret.spouse.lastName.trim(), 'Text Field 8': digits(ret.spouse.ssn),
    'Text Field 10': ret.spouse.age ? String(ret.spouse.age) : '', 'Check Box 2': !!ret.maryland.totallyDisabled.spouse
  })
  // Part 4 lines 1, 2, 5 (You / Spouse field numbers). SEP and rollover-only IRAs can't be told apart from 1099-R data; they go on line 2.
  const cols: Record<string, [number, number]> = { plan: [11, 36], ira: [13, 37], roth: [20, 40] }
  const sums: Record<string, Record<'taxpayer' | 'spouse', number>> = { plan: { taxpayer: 0, spouse: 0 }, ira: { taxpayer: 0, spouse: 0 }, roth: { taxpayer: 0, spouse: 0 } }
  for (const x of ret.retirement) {
    const kind = ROTH.test(x.code) ? 'roth' : x.ira ? 'ira' : 'plan'
    const o = joint ? x.owner : 'taxpayer'
    sums[kind][o] += Math.max(0, x.taxableAmount)
  }
  let total = 0
  for (const [k, [you, sp]] of Object.entries(cols)) {
    v[`Text Field ${you}`] = amt(sums[k].taxpayer); v[`Text Field ${sp}`] = amt(sums[k].spouse)
    total += sums[k].taxpayer + sums[k].spouse
  }
  v['Text Field 25'] = amt(total, true)
  const ss = (o: 'taxpayer' | 'spouse'): number => ret.socialSecurity.filter((x) => (joint ? x.owner : 'taxpayer') === o).reduce((t, x) => t + Math.max(0, x.netBenefits), 0)
  v['Text Field 26'] = amt(ss('taxpayer')); v['Text Field 43'] = amt(ss('spouse'))
  // Line 10: military (u) and public safety (v) subtractions. Form 502SU does not split them by person, so they go in the You column.
  const mil = md.subtractions.filter((x) => x.code === 'u' || x.code === 'v').reduce((t, x) => t + x.amount, 0)
  v['Text Field 34'] = amt(mil)
  v['Text Field 30'] = amt(md.pension.taxpayer); v['Text Field 45'] = amt(md.pension.spouse)
  return { id: 'md502r', file: 'md502r.pdf', title: 'Maryland Form 502R', values: v, pages: [0] }
}

/** Form 502CR: Part M (senior tax credit), Part AA summary, Part BB local credit and Part CC refundable credits. */
export function form502cr(ret: TaxReturnInput, md: MdResult): FormFill | null {
  const L = md.lines
  const { senior, childTaxCredit } = md.credits
  if (L['24'] <= 0 && L['31'] <= 0 && L['45'] <= 0) return null
  const joint = md.status === 2
  const [tf, tmi] = firstAndInitial(ret.taxpayer)
  const [sf, smi] = firstAndInitial(ret.spouse)
  const v: Record<string, FieldValue> = {
    'Text Field 1': digits(ret.taxpayer.ssn), 'Text Field 3': tf, 'Text Field 4': tmi, 'Text Field 5': ret.taxpayer.lastName.trim()
  }
  if (joint) Object.assign(v, { 'Text Field 2': digits(ret.spouse.ssn), 'Text Field 6': sf, 'Text Field 7': smi, 'Text Field 8': ret.spouse.lastName.trim() })
  if (senior > 0) { v['Text Field 1051'] = amt(senior); v['Text Field 1039'] = amt(senior) }
  if (L['24'] > 0) v['Text Field 1038'] = amt(L['24'])
  if (L['31'] > 0) v['Text Field 1037'] = amt(L['31'])
  if (childTaxCredit > 0) v['Text Field 1030'] = amt(childTaxCredit)
  if (L['45'] > 0) v['Text Field 1028'] = amt(L['45'])
  return { id: 'md502cr', file: 'md502cr.pdf', title: 'Maryland Form 502CR', values: v, pages: [0, 1, 2, 3] }
}

export function buildMarylandPacket(ret: TaxReturnInput, res: TaxReturnResult, md: MdResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [form502(ret, res, md, preparer)]
  if (ret.dependents.length && md.status !== 6) forms.push(form502b(ret, md))
  if (md.subtractions.length) forms.push(form502su(ret, md))
  const cg = form502cg(ret, md)
  if (cg) forms.push(cg)
  const r502 = form502r(ret, md)
  if (r502) forms.push(r502)
  const cr = form502cr(ret, md)
  if (cr) forms.push(cr)
  const m = ret.maryland
  const notIncluded = md.attach.filter((a) => !(cg && a.startsWith('Form 502CG')) && !(r502 && a.startsWith('Form 502R')) && !(cr && a.startsWith('Form 502CR')))
  if (cr && m.otherCredits > 0) notIncluded.push('Form 502CR: enter your other credits (included in Part AA line 14) on their own parts (A–L)')
  if (cr && m.localCredits > 0) notIncluded.push('Form 502CR Part A: credit for tax paid to another state (Part BB line 1 shows the local credit total)')
  if (cr && m.refundableCredits > 0) notIncluded.push('Form 502CR Part CC: enter your other refundable credits on their lines (included in line 10)')
  if (md.subtractions.some((s) => !SU_FIELD[s.code])) notIncluded.push('Form 502SU lines for codes the app does not recognize')
  if (md.county?.rate === 'anne-arundel' || md.county?.rate === 'frederick') notIncluded.push(`Local tax: ${md.county.name} uses its own brackets; line 28 is figured with its 2025 rates (the rate box is left blank).`)
  forms.push(...dependentsStatement(ret, 12, 'Form 502B (continued)', 'st-md-deps'))
  return { forms, notIncluded }
}
