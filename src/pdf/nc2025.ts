/**
 * Maps a computed North Carolina return onto the NCDOR web fill-in PDFs (2025): Form D-400
 * (public/forms/2025/ncd400.pdf) and Schedule S (ncd400s.pdf), without their "Do not include this page"
 * instruction sheets. Amounts are whole dollars.
 */
import type { Person, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { NcResult } from '../engine/nc2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const amt = (n: number | undefined, keepZero = false): string => {
  if (n === undefined || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  if (v === 0) return keepZero ? '0' : ''
  return String(v)
}
const upper = (s: string): string => s.toUpperCase()
const firstAndInitial = (p: Person): [string, string] => {
  const parts = p.firstName.trim().split(/\s+/)
  if (parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1])) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '').toUpperCase()]
  return [p.firstName.trim(), '']
}
const STATUS: Record<TaxReturnInput['filingStatus'], string> = { single: 'y_d400wf_fstat1', mfj: 'y_d400wf_fstat2', mfs: 'y_d400wf_fstat3', hoh: 'y_d400wf_fstat4', qss: 'y_d400wf_fstat5' }

export function formD400(ret: TaxReturnInput, res: TaxReturnResult, nc: NcResult, preparer?: PreparerInfo | null): FormFill {
  const L = nc.lines
  const d = ret.nc
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const [first, mi] = firstAndInitial(ret.taxpayer)
  const [sFirst, sMi] = firstAndInitial(ret.spouse)
  const values: Record<string, FieldValue> = {
    y_d400wf_ssn1: digits(ret.taxpayer.ssn), y_d400wf_ssn2: joint || fs === 'mfs' ? digits(ret.spouse.ssn) : '',
    y_d400wf_fname1: upper(first), y_d400wf_mi1: upper(mi), y_d400wf_lname1: upper(ret.taxpayer.lastName.trim()),
    y_d400wf_fname2: joint ? upper(sFirst) : '', y_d400wf_mi2: joint ? upper(sMi) : '', y_d400wf_lname2: joint ? upper(ret.spouse.lastName.trim()) : '',
    y_d400wf_add: upper(c.street.trim()), 'y_d400wf_apartment number': upper(c.apt.trim()), y_d400wf_city: upper(c.city.trim()), y_d400wf_zip: digits(c.zip).slice(0, 9),
    y_d400wf_county: upper(d.county.trim().replace(/[^A-Za-z]/g, '')).slice(0, 5),
    y_d400wf_rs1yes: true, y_d400wf_rs2yes: joint,
    [STATUS[fs]]: true,
    y_d400wf_sname2: fs === 'mfs' ? upper(`${ret.spouse.firstName.trim()} ${ret.spouse.lastName.trim()}`) : '', y_d400wf_sssn2: fs === 'mfs' ? digits(ret.spouse.ssn) : '',
    y_d400wf_li6_good: amt(L['6'], true), y_d400wf_li7_good: amt(L['7']), y_d400wf_li8_good: amt(L['8'], true), y_d400wf_li9_good: amt(L['9']),
    y_d400wf_li10a_good: L['10a'] ? String(L['10a']) : '', y_d400wf_li10b_good: amt(L['10b']),
    y_d400wf_ncstandarddeduction: nc.deduction.method === 'standard', y_d400wf_ncitemizeddeduction: nc.deduction.method === 'itemized',
    y_d400wf_li11_page1_good: amt(L['11'], true), y_d400wf_li12a_pg1_good: amt(L['12a'], true), y_d400wf_li12b_pg1_good: amt(L['12b'], true),
    y_d400wf_li14_pg1_good: amt(L['14'], true), y_d400wf_li15_pg1_good: amt(L['15'], true),
    y_d400wf_lname2_PG2: upper(ret.taxpayer.lastName.trim()).slice(0, 10),
    y_d400wf_li16_pg2_good: amt(L['16']), y_d400wf_li17_pg2_good: amt(L['17'], true), y_d400wf_li18_pg2_good: amt(L['18'], true),
    'y_d400wf_Consumer Use Tax': L['18'] === 0 && d.noUseTaxDue, y_d400wf_li19_pg2_good: amt(L['19'], true),
    y_d400wf_li20a_pg2_good: amt(L['20a']), y_d400wf_li20b_pg2_good: amt(L['20b']),
    y_d400wf_li21a_pg2_good: amt(L['21a']), y_d400wf_li21b_pg2_good: amt(L['21c']),
    y_d400wf_li23_pg2_good: amt(L['23'], true), y_d400wf_li25_pg2_good: amt(L['25'], true),
    y_d400wf_li26a_pg2_good: amt(L['26a']), y_d400wf_li27_pg2_good: amt(L['27']), y_d400wf_li28_pg2_good: amt(L['28']),
    y_d400wf_li29_pg2_good: amt(L['29']), y_d400wf_li30_pg2_good: amt(L['30']), y_d400wf_li33_pg2_good: amt(L['33']), y_d400wf_li34_pg2_good: amt(L['34'])
  }
  const phone = digits(c.phone).slice(-10)
  if (phone) values.y_d400wf_dayphone = phone
  if (ret.usePaidPreparer && preparer) {
    values.y_d400wf_ppssn = preparer.ptin.toUpperCase()
    values.y_d400wf_ppphoneno = digits(preparer.phone).slice(-10)
  }
  return { id: 'ncd400', file: 'ncd400.pdf', title: 'North Carolina Form D-400', values }
}

export function scheduleS(ret: TaxReturnInput, nc: NcResult): FormFill {
  const A = nc.scheduleS.additions
  const B = nc.scheduleS.deductions
  return {
    id: 'ncd400s', file: 'ncd400s.pdf', title: 'North Carolina Schedule S',
    values: {
      y_d400wf_lname2_PG2: upper(ret.taxpayer.lastName.trim()).slice(0, 10), y_d400schswf_ssn: digits(ret.taxpayer.ssn),
      y_d400schswf_li1_good: amt(A['1']), y_d400schswf_li3_good: amt(A['3']), y_d400schswf_li16_good: amt(A['16']),
      y_d400schswf_li17_good: amt(B['17']), y_d400schswf_li18_good: amt(B['18']), y_d400schswf_li19_good: amt(B['19']), y_d400schswf_li20_good: amt(B['20']),
      y_d400schswf_li21_good: amt(B['21']), y_d400schswf_li41_good: amt(B['41'])
    }
  }
}

export function buildNcPacket(ret: TaxReturnInput, res: TaxReturnResult, nc: NcResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formD400(ret, res, nc, preparer)]
  if (nc.lines['7'] > 0 || nc.lines['9'] > 0) forms.push(scheduleS(ret, nc))
  const notIncluded = nc.attach.filter((a) => a !== 'Form D-400 Schedule S, supplemental schedule')
  notIncluded.push('Form D-400 page 1: answer the veteran and federal extension questions')
  if (nc.scheduleS.additions.other > 0 || nc.scheduleS.deductions.other > 0) notIncluded.push('Schedule S: put your other additions or deductions on their own lines (only the totals on lines 16 and 41 include them here)')
  return { forms, notIncluded }
}
