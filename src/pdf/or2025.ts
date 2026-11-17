/**
 * Fills the official 2025 Oregon Form OR-40 (150-101-040), Schedule OR-ASC (150-101-063), Schedule OR-A (150-101-007)
 * and Schedule OR-WFHDC (150-101-195) from a computed return. Whole dollars; the forms print the cents.
 */
import type { Owner, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { OrResult } from '../engine/or2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const money = (n: number | undefined): string => {
  const v = Math.round(n ?? 0)
  return v > 0 ? String(v) : ''
}
const keep0 = (n: number | undefined): string => String(Math.max(0, Math.round(n ?? 0)))
const signed = (n: number | undefined): string => String(Math.round(n ?? 0))
const ssn = (v: string): string => {
  const s = digits(v)
  return s.length === 9 ? `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}` : s
}
const date = (s: string): string => {
  const x = digits(s)
  return x.length === 8 ? `${x.slice(0, 2)}/${x.slice(2, 4)}/${x.slice(4)}` : ''
}
const phone = (s: string): string => {
  const x = digits(s).slice(-10)
  return x.length === 10 ? `${x.slice(0, 3)}-${x.slice(3, 6)}-${x.slice(6)}` : ''
}
/** First name and middle initial, as typed ("Pat Q" → ["PAT", "Q"]). */
const firstAndInitial = (s: string): [string, string] => {
  const parts = upper(s).split(/\s+/).filter(Boolean)
  if (parts.length > 1 && parts[parts.length - 1].replace('.', '').length === 1) return [parts.slice(0, -1).join(' '), parts[parts.length - 1].replace('.', '')]
  return [parts.join(' '), '']
}
const splitName = (name: string): [string, string] => {
  const parts = name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts.pop() ?? '' : ''
  return [parts.join(' '), last]
}
/** "1 Main St, Portland OR 97201" → street, city, state, ZIP. */
const splitAddress = (s: string): { street: string; city: string; state: string; zip: string; plus4: string } => {
  const m = /^(.*?),\s*([^,]+?),?\s+([A-Za-z]{2})\s+(\d{5})(?:-?(\d{4}))?$/.exec(s.trim())
  return m ? { street: m[1], city: m[2], state: m[3].toUpperCase(), zip: m[4], plus4: m[5] ?? '' } : { street: s, city: '', state: '', zip: '', plus4: '' }
}

export function formOr40(ret: TaxReturnInput, res: TaxReturnResult, or: OrResult, preparer?: PreparerInfo | null): FormFill {
  const L = or.lines
  const d = ret.or
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const v: Record<string, FieldValue> = {}
  const p = 'or-40-'

  // ── Page 1 ──
  const [tf, ti] = firstAndInitial(ret.taxpayer.firstName)
  v[`${p}p1-11`] = tf
  v[`${p}p1-12`] = ti
  v[`${p}p1-13`] = date(d.birthDate.taxpayer)
  v[`${p}p1-14`] = upper(ret.taxpayer.lastName)
  v[`${p}p1-15`] = ssn(ret.taxpayer.ssn)
  if (joint || fs === 'mfs') {
    const [sf, si] = firstAndInitial(ret.spouse.firstName)
    v[`${p}p1-19`] = sf
    v[`${p}p1-20`] = si
    v[`${p}p1-21`] = date(d.birthDate.spouse)
    v[`${p}p1-22`] = upper(ret.spouse.lastName)
    v[`${p}p1-23`] = ssn(ret.spouse.ssn)
  }
  v[`${p}p1-27`] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v[`${p}p1-28`] = upper(c.city)
  v[`${p}p1-29`] = upper(c.state).slice(0, 2)
  const zip = digits(c.zip)
  v[`${p}p1-30a`] = zip.slice(0, 5)
  v[`${p}p1-30b`] = zip.slice(5, 9)
  v[`${p}p1-32`] = phone(c.phone)
  v['or-40_p1_33'] = `#${{ single: 0, mfj: 1, mfs: 2, hoh: 3, qss: 4 }[fs]}`

  // ── Page 2 ──
  v[`${p}p2-1`] = String(or.exemptions.taxpayer + (d.severeDisability.taxpayer ? 1 : 0))
  if (or.exemptions.taxpayer) v[`${p}p2-2`] = true
  if (d.severeDisability.taxpayer) v[`${p}p2-3`] = true
  if (ret.canBeClaimedAsDependent) v[`${p}p2-4`] = true
  if (joint) {
    v[`${p}p2-5`] = String(1 + (d.severeDisability.spouse ? 1 : 0))
    v[`${p}p2-6`] = true
    if (d.severeDisability.spouse) v[`${p}p2-7`] = true
  }
  const deps = [...ret.dependents].sort((a, b) => a.age - b.age)
  deps.slice(0, 3).forEach((x, i) => {
    const base = 11 + i * 7
    const [first, last] = splitName(x.name)
    const [fn, mi] = firstAndInitial(first)
    v[`${p}p2-${base}`] = fn
    v[`${p}p2-${base + 1}`] = mi
    v[`${p}p2-${base + 2}`] = upper(last)
    v[`${p}p2-${base + 3}`] = date(d.dependentBirthDates[x.id] ?? '')
    v[`${p}p2-${base + 4}`] = ssn(x.ssn)
    v[`${p}p2-${base + 5}`] = upper(d.dependentCodes[x.id] || (x.childRelationship ? 'SD' : '')).slice(0, 2)
    if (d.childDisability[x.id]) v[`${p}p2-${base + 6}`] = true
  })
  v[`${p}p2-32`] = money(or.exemptions.dependents)
  v[`${p}p2-33`] = money(or.exemptions.disabledChildren)
  v[`${p}p2-34`] = keep0(or.exemptions.total)

  // ── Pages 3–4 ──
  const p3: [string, string][] = [['7', '1'], ['8', '2'], ['9', '3'], ['10', '4'], ['11', '5'], ['12', '6'], ['13', '7'], ['14', '8'], ['15', '9'], ['16', '10'], ['17', '11'], ['18', '16'], ['19', '17']]
  for (const [line, n] of p3) v[`${p}p3-${n}`] = ['7', '9', '15'].includes(line) ? signed(L[line]) : ['14', '17', '18', '19'].includes(line) ? keep0(L[line]) : money(L[line])
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  if (person('taxpayer').age65OrOlder || person('taxpayer').age >= 65) v[`${p}p3-12`] = true
  if (person('taxpayer').blind) v[`${p}p3-13`] = true
  if (joint && (person('spouse').age65OrOlder || person('spouse').age >= 65)) v[`${p}p3-14`] = true
  if (joint && person('spouse').blind) v[`${p}p3-15`] = true
  const p4: [string, string][] = [['20', '1'], ['21', '4'], ['22', '5'], ['23', '6'], ['24', '7'], ['25', '8'], ['26', '9'], ['27', '10'], ['28', '11'], ['29', '12'], ['30', '13'], ['31', '14']]
  for (const [line, n] of p4) v[`${p}p4-${n}`] = ['20', '24', '29', '31'].includes(line) ? keep0(L[line]) : money(L[line])

  // ── Pages 5–6 ──
  const p5: [string, string][] = [['32', '1'], ['33', '2'], ['34', '3'], ['35', '4'], ['36', '5'], ['37', '6'], ['38', '7'], ['39', '8'], ['40', '9'], ['41', '10'], ['42', '11'], ['43', '12'], ['44', '13']]
  for (const [line, n] of p5) v[`${p}p5-${n}`] = line === '40' ? keep0(L[line]) : money(L[line])
  const p6: [string, string][] = [['45', '1a'], ['46', '1b'], ['47', '2'], ['48', '3'], ['52', '9'], ['53', '10']]
  for (const [line, n] of p6) v[`${p}p6-${n}`] = money(L[line])
  if (L['53'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      v[`${p}p6-12`] = dep.accountType === 'savings' ? '#1' : '#0'
      v[`${p}p6-14`] = digits(dep.routingNumber).slice(0, 9)
      v[`${p}p6-15`] = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17).padEnd(17, ' ')
    }
  }
  if (d.donateKicker && L['55b'] > 0) {
    v[`${p}p6-16`] = true
    v[`${p}p6-17`] = money(L['55b'])
  }
  // ── Page 7: paid preparer ──
  if (ret.usePaidPreparer && preparer) {
    const [pf, pl] = splitName(preparer.name)
    v[`${p}p7-6`] = upper(pf)
    v[`${p}p7-8`] = upper(pl)
    v[`${p}p7-4`] = phone(preparer.phone)
    v[`${p}p7-9`] = upper(preparer.firmAddress)
  }
  return { id: 'or40', file: 'or40.pdf', title: 'Oregon Form OR-40', values: v, pages: [0, 1, 2, 3, 4, 5, 6] }
}

export function formOrAsc(ret: TaxReturnInput, or: OrResult): FormFill {
  const v: Record<string, FieldValue> = {}
  const a = 'or-asc-'
  v[`${a}p1-1a`] = upper(ret.taxpayer.lastName)
  v[`${a}p1-1b`] = ssn(ret.taxpayer.ssn)
  or.asc.additions.slice(0, 2).forEach((x, i) => { v[`${a}p1-${1 + i * 2}`] = x.code; v[`${a}p1-${2 + i * 2}`] = String(x.amount) })
  if (or.asc.additions.length) v[`${a}p1-5`] = String(or.lines['8'])
  or.asc.subtractions.slice(0, 3).forEach((x, i) => { v[`${a}p1-${6 + i * 2}`] = x.code; v[`${a}p1-${7 + i * 2}`] = String(x.amount) })
  if (or.asc.subtractions.length) v[`${a}p1-12`] = String(or.lines['13'])
  or.asc.standard.slice(0, 5).forEach((x, i) => { v[`${a}p2-${1 + i * 3}`] = x.code; v[`${a}p2-${2 + i * 3}`] = x.state; v[`${a}p2-${3 + i * 3}`] = String(x.amount) })
  if (or.asc.standard.length) v[`${a}p2-16`] = String(or.lines['27'])
  or.asc.refundable.slice(0, 3).forEach((x, i) => { v[`${a}p3-${1 + i * 2}`] = x.code; v[`${a}p3-${2 + i * 2}`] = String(x.amount) })
  if (or.asc.refundable.length) v[`${a}p3-7`] = String(or.lines['39'])
  const pages = [0]
  if (or.asc.standard.length) pages.push(1)
  if (or.asc.refundable.length) pages.push(2)
  return { id: 'orasc', file: 'or-asc.pdf', title: 'Oregon Schedule OR-ASC', values: v, pages }
}

export function formOrA(ret: TaxReturnInput, or: OrResult): FormFill {
  const A = or.schA
  const v: Record<string, FieldValue> = {}
  v['or-a-p1-1'] = upper(ret.taxpayer.lastName)
  v['or-a-p1-2'] = ssn(ret.taxpayer.ssn)
  const map: [string, string][] = [['1', 'p1-3'], ['2', 'p1-4'], ['3', 'p1-5'], ['4', 'p1-6'], ['5', 'p1-7'], ['6', 'p1-8'], ['7', 'p1-9'], ['9', 'p1-10'], ['11', 'p1-13'],
    ['12', 'p2-1'], ['17', 'p2-6'], ['18', 'p2-7'], ['19', 'p2-8'], ['21', 'p2-10'], ['22', 'p2-11'], ['23', 'p2-13']]
  for (const [line, f] of map) v[`or-a-${f}`] = ['2', '4', '11', '17', '21', '23'].includes(line) ? keep0(A[line]) : money(A[line])
  if (A['22'] > 0) v['or-a-p2-12'] = 'OTHER ITEMIZED DEDUCTIONS (FEDERAL SCHEDULE A, LINE 16)'
  return { id: 'ora', file: 'or-a.pdf', title: 'Oregon Schedule OR-A', values: v }
}

export function formOrWfhdc(ret: TaxReturnInput, res: TaxReturnResult, or: OrResult): FormFill | null {
  const W = or.wfhdc
  if (!W) return null
  const v: Record<string, FieldValue> = {}
  const w = 'or-wfhdc-'
  const [tf, ti] = firstAndInitial(ret.taxpayer.firstName)
  v[`${w}p1_1`] = tf
  v[`${w}p1_2`] = ti
  v[`${w}p1_3`] = upper(ret.taxpayer.lastName)
  v[`${w}p1_4`] = ssn(ret.taxpayer.ssn)
  if (ret.filingStatus === 'mfj') {
    const [sf, si] = firstAndInitial(ret.spouse.firstName)
    v[`${w}p1_7`] = sf
    v[`${w}p1_8`] = si
    v[`${w}p1_9`] = upper(ret.spouse.lastName)
    v[`${w}p1_10`] = ssn(ret.spouse.ssn)
  }
  const providerFields = [
    ['p1_16', 'p1_17', 'p1_18', 'p1_19', 'p1_20a', 'p1_20b', 'or-21-RF-p1-22', 'p1_25'],
    ['p2_4', 'p2_5', 'p2_6', 'p2_7', 'p2_8a', 'p2_8b', 'or-21-RF-p1-10', 'p2_14'],
    ['p2_18', 'p2_19', 'p2_20', 'p2_21', 'p2_22a', 'p2_22b', 'or-21-RF-p2-24', 'p2_27']
  ]
  const providers = ret.dependentCare.providers.slice(0, 3)
  providers.forEach((x, i) => {
    const [biz, street, city, st, z5, z4, fein, amt] = providerFields[i]
    const a = splitAddress(x.address)
    const name = (k: string): string => (k.startsWith('or-21') ? k : `${w}${k}`)
    v[name(biz)] = upper(x.name)
    v[name(street)] = upper(a.street)
    v[name(city)] = upper(a.city)
    v[name(st)] = a.state
    v[name(z5)] = a.zip
    v[name(z4)] = a.plus4
    v[name(fein)] = digits(x.tin).slice(0, 9)
    v[name(amt)] = money(x.amountPaid)
  })
  if (providers.length) v[`${w}p2_28`] = keep0(providers.reduce((s, x) => s + Math.round(x.amountPaid), 0))
  const kids = [...ret.dependents].filter((x) => x.age < 13).sort((a, b) => a.age - b.age).slice(0, 3)
  const each = kids.length ? Math.floor(W['10'] / kids.length) : 0
  kids.forEach((x, i) => {
    const n = 1 + i * 10
    const [first, last] = splitName(x.name)
    const [fn, mi] = firstAndInitial(first)
    const amount = i === kids.length - 1 ? W['10'] - each * (kids.length - 1) : each
    v[`${w}p3_${n}`] = fn
    v[`${w}p3_${n + 1}`] = mi
    v[`${w}p3_${n + 2}`] = upper(last)
    v[`${w}p3_${n + 3}`] = ssn(x.ssn)
    v[`${w}p3_${n + 4}`] = upper(ret.or.dependentCodes[x.id] || 'SD').slice(0, 2)
    v[`${w}p3_${n + 5}`] = date(ret.or.dependentBirthDates[x.id] ?? '')
    if (ret.or.childDisability[x.id]) v[`${w}p3_${n + 6}`] = true
    v[`${w}p3_${n + 7}`] = money(amount)
    v[`${w}p3_${n + 9}`] = money(amount)
  })
  v[`${w}p4_1`] = keep0(W['10'])
  v[`${w}p4_3`] = keep0(W['10'])
  v[`${w}p4_4`] = String(or.exemptions.taxpayer + or.exemptions.spouse + or.exemptions.dependents)
  v[`${w}p4_6`] = v[`${w}p4_4`]
  v[`${w}p4_8`] = String(W['15'])
  const lines: [string, string][] = [['16', 'p5_1'], ['17', 'p5_2'], ['18', 'p5_3'], ['19', 'p5_4'], ['20', 'p5_5'], ['21', 'p5_6'], ['22', 'p5_7'], ['24', 'p5_10'], ['26', 'p5_12'], ['27', 'p5_13'], ['29', 'p5_15']]
  for (const [line, f] of lines) v[`${w}${f}`] = keep0(line === '26' || line === '27' ? W['24'] : W[line])
  const pct = Math.round(W['23'] * 100)
  v[`${w}p5_8`] = pct >= 100 ? '1' : '0'
  v[`${w}p5_9`] = String(pct % 100).padStart(2, '0')
  void res
  return { id: 'orwfhdc', file: 'or-wfhdc.pdf', title: 'Oregon Schedule OR-WFHDC', values: v }
}

export function buildOrPacket(ret: TaxReturnInput, res: TaxReturnResult, or: OrResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formOr40(ret, res, or, preparer)]
  const asc = or.asc
  if (asc.additions.length || asc.subtractions.length || asc.standard.length || asc.refundable.length) forms.push(formOrAsc(ret, or))
  if (or.itemize) forms.push(formOrA(ret, or))
  const wf = formOrWfhdc(ret, res, or)
  if (wf && (or.wfhdc?.['29'] ?? 0) > 0) forms.push(wf)
  const notIncluded = [...or.attach]
  if (ret.dependents.length > 3) notIncluded.push('Schedule OR-ADD-DEP for dependents after the third')
  if (ret.dependents.some((x) => !(ret.or.dependentBirthDates[x.id] ?? '').replace(/\D/g, ''))) notIncluded.push('Page 2: dependents’ dates of birth that were not entered')
  if (asc.subtractions.length > 3 || asc.standard.length > 5 || asc.refundable.length > 3 || asc.additions.length > 2) notIncluded.push('A second Schedule OR-ASC for the codes that did not fit')
  if (or.lines['38'] > 0) notIncluded.push('Keep the Oregon Kids Credit worksheet (OR-40 instructions) with your records')
  if (or.retirementCredit && or.retirementCredit['credit'] > 0) notIncluded.push('Keep the retirement income credit worksheet (Publication OR-17) with your records')
  if (or.wfhdc && or.wfhdc['29'] > 0) notIncluded.push('Schedule OR-WFHDC: check each provider’s SSN or FEIN, phone and relationship code, and the expenses split between children')
  return { forms, notIncluded }
}
