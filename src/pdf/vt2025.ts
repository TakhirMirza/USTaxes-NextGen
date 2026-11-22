/**
 * Fills the official Vermont forms (public/forms/2025/): Form IN-111, Schedules IN-112 and IN-113, and the 2026
 * Form HS-122 with the 2025 Schedule HI-144, Schedules IN-117, IN-119 and IN-153 and Form RCC-146 (the Department of Taxes’ fill-in PDFs, Rev. 10/25, with the Clear /
 * Print buttons removed). Whole dollars: the cents are preprinted.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { VtResult } from '../engine/vt2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const nameParts = (first: string): [string, string] => {
  const parts = first.trim().split(/\s+/)
  const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? parts.pop() ?? '' : ''
  return [parts.join(' '), mi.replace('.', '')]
}
const mmddyyyy = (s: string): string => {
  const m = s.trim().match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/)
  return m ? `${m[1].padStart(2, '0')}${m[2].padStart(2, '0')}${m[3]}` : digits(s).slice(0, 8)
}
const phone = (s: string): string => {
  const x = digits(s).slice(-10)
  return x.length === 10 ? `${x.slice(0, 3)}-${x.slice(3, 6)}-${x.slice(6)}` : x
}
const moneyIn = (v: Record<string, FieldValue>) => (name: string, n: number | undefined, always = false): void => {
  const x = Math.round(n ?? 0)
  if (x === 0 && !always) return
  v[name] = x < 0 ? `-${-x}` : String(x)
}
/** A percentage split into the whole part and the four decimals. */
const percent = (fraction: number): [string, string] => {
  const p = Math.round(fraction * 1e6) / 1e4
  const whole = Math.floor(p)
  return [String(whole), String(Math.round((p - whole) * 1e4)).padStart(4, '0')]
}
/** Filing status buttons by position (the export names contain an escaped slash). */
const FILING = { single: '#0', hoh: '#1', mfj: '#2', mfs: '#3', qss: '#4' } as const

export function formIn111(ret: TaxReturnInput, vt: VtResult, preparer?: PreparerInfo | null): FormFill {
  const L = vt.lines
  const d = ret.vt
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  const [tf, tmi] = nameParts(ret.taxpayer.firstName)
  v.TPLastName = upper(ret.taxpayer.lastName)
  v.TPFirstName = upper(tf)
  if (tmi) v.TPInit = upper(tmi)
  v.TPSSN = digits(ret.taxpayer.ssn)
  if (joint || fs === 'mfs') {
    const [sf, smi] = nameParts(ret.spouse.firstName)
    v.SpLastName = upper(ret.spouse.lastName)
    v.SpFirstName = upper(sf)
    if (smi) v.SpInit = upper(smi)
    v.SpSSN = digits(ret.spouse.ssn)
  }
  const street = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v.MailingAddress = street
  v.PhysicalStreetAddress = d.physicalAddress.trim() ? upper(d.physicalAddress) : street
  v.City = upper(c.city)
  v.State = upper(c.state).slice(0, 2)
  v.ZIP = digits(c.zip).length > 5 ? `${digits(c.zip).slice(0, 5)}-${digits(c.zip).slice(5, 9)}` : digits(c.zip)
  if (d.schoolCode.trim()) v.SchoolCode = digits(d.schoolCode).slice(0, 3)
  v.Residency = 'Resident'
  v['Filing Status'] = FILING[fs]
  const tpCov = d.coverage.taxpayer
  const spCov = d.coverage.spouse
  v['HCC-Code'] = joint ? (tpCov && spCov ? '1' : !tpCov && !spCov ? '2' : tpCov ? '3' : '4') : tpCov ? '1' : '2'
  for (const k of ['1', '3', '4']) money(`Line${k}`, L[k], true)
  money('Line2', L['2'])
  v.Line5a = String(L['5a'])
  if (L['5b']) v.Line5b = String(L['5b'])
  if (L['5c']) v.Line5c = String(L['5c'])
  v.Line5d = String(L['5d'])
  for (const k of ['5e', '6', '7', '8', '10', '14', '16']) money(`Line${k}`, L[k], true)
  money('Line9', L['9'])
  if (L['11'] > 0) { money('Line11', L['11']); money('Line12', L['12']); money('Line13', L['13']) }
  const [pw, pd] = percent(vt.adjustment)
  v['Line15-a'] = pw
  v['Line15-b'] = pd
  // ── Page 2 ──
  money('Line17', L['17'])
  money('Line18', L['18'])
  money('Line19', L['19'])
  money('Line20', L['20'], true)
  money('Line21', L['21'])
  if (d.useTax.mode === 'none') v['Line22-NoUseTax'] = true
  else money('Line22', L['22'], true)
  money('Line23', L['23'], true)
  money('Lind24a', L['24a'])
  money('Line24b', L['24b'])
  money('Line24c', L['24c'])
  money('Line24d', L['24d'])
  money('Line24e', L['24e'])
  money('Line25', L['25'], true)
  for (const k of ['26a', '26b', '26c', '26d']) money(`Line${k}`, L[k])
  money('Line26f', L['26f'], true)
  money('Line27', L['27'])
  money('Line28a', L['28a'])
  money('Line28b', L['28b'])
  money('Line29', L['29'], L['27'] > 0)
  money('Line30', L['30'])
  money('Line32', L['32'], L['30'] > 0)
  if (d.birthDates.taxpayer.trim()) v['Sig-TP-DOB'] = mmddyyyy(d.birthDates.taxpayer)
  if (c.phone.trim()) v['Sig-TP-Phone'] = phone(c.phone)
  if (joint && d.birthDates.spouse.trim()) v['Sig-SP-DOB'] = mmddyyyy(d.birthDates.spouse)
  if (ret.usePaidPreparer && preparer) {
    v['Sig-PrepAddress1'] = upper([preparer.firmName || preparer.name, preparer.firmAddress].filter((x) => x.trim()).join(', '))
    v['Sig-PrepSSNorPTIN'] = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 11)
    if (preparer.firmEin.trim()) v['Sig-PrepEIN'] = digits(preparer.firmEin)
    if (preparer.phone.trim()) v['Sig-PrepPhone'] = phone(preparer.phone)
  }
  return { id: 'vt-in111', file: 'vt-in111.pdf', title: 'Vermont Form IN-111', values: v }
}

export function formIn112(ret: TaxReturnInput, vt: VtResult): FormFill | null {
  const P1 = vt.p1
  const P2 = vt.p2
  const d = ret.vt
  const part1 = P1['6'] !== 0 || P1['18'] !== 0
  const part2 = P2['13'] > 0
  if (!part1 && !part2) return null
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  const [tf, tmi] = nameParts(ret.taxpayer.firstName)
  v.TPLastName = upper(ret.taxpayer.lastName)
  v['Taxpayer First name'] = upper(tf)
  if (tmi) v['Mid Initial'] = upper(tmi)
  v.TPSSN = digits(ret.taxpayer.ssn)
  if (part1) {
    for (const k of ['1', '2', '3', '4', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16a', '16b', '16c']) money(`PartILine${k}`, P1[k])
    money('PartILine6', P1['6'], true)
    money('PartILine18', P1['18'], true)
    money('PartILine19', P1['19'], true)
    if (P1['15'] > 0 && d.bondKind) v[d.bondKind] = true
  }
  if (part2) {
    money('PartIILine1', P2['1'])
    money('PartIILine2', P2['2'])
    if (P2['3'] > 0) {
      v.PartIILine3 = String(P2['3'])
      const kids = ret.dependents.filter((x) => vt.ctcChildren.includes(x.id)).slice(0, 3)
      kids.forEach((k, i) => {
        const n = i + 1
        const parts = k.name.trim().split(/\s+/)
        const last = parts.length > 1 ? parts.pop() ?? '' : ret.taxpayer.lastName
        const [first, mi] = nameParts(parts.join(' '))
        v[`PartIILine3Child${n}LastName`] = upper(last)
        v[`PartIILine3Child${n}FirstName`] = upper(first)
        if (mi) v[`PartIILine3Child${n}MiddleInitial`] = upper(mi)
        if (k.ssn) v[`PartIILine3Child${n}SSN`] = digits(k.ssn)
        v[`PartIILine3Child${n}YearOfBirth`] = String(2025 - k.age)
      })
      money('PartIILine4', P2['4'], true)
    }
    if (P2['7'] > 0) {
      v.PartIILine5 = String(P2['5'])
      money('PartIILine6', P2['6'], true)
      money('PartIILine7', P2['7'], true)
    }
    if (P2['12'] > 0) {
      money('PartIILine8', P2['8'], true)
      money('PartIILine9', P2['9'])
      money('PartIILine10', P2['10'])
      money('PartIILine11', P2['11'])
      money('PartIILine12', P2['12'], true)
    }
    money('PartIILine13', P2['13'], true)
  }
  return { id: 'vt-in112', file: 'vt-in112.pdf', title: 'Vermont Schedule IN-112', values: v, pages: part1 && part2 ? [0, 1] : part1 ? [0] : [1] }
}

export function formIn113(ret: TaxReturnInput, vt: VtResult): FormFill | null {
  const t = vt.in113
  if (!t) return null
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  const [tf] = nameParts(ret.taxpayer.firstName)
  v.TPLastName = upper(ret.taxpayer.lastName)
  v.TPFirstName = upper(tf)
  v.TPSSN = digits(ret.taxpayer.ssn)
  money('Line 30', t['30'], true)
  if (ret.vt.activeDutyMonths > 0) v['Number of Months'] = String(Math.min(12, Math.round(ret.vt.activeDutyMonths)))
  money('Line 32', t['32'], true)
  money('Line 33', t['33'], true)
  money('Line 34', t['34'], true)
  const [pw, pd] = percent(vt.adjustment)
  v['Line 35-1'] = pw
  v['Line 35-2'] = pd
  return { id: 'vt-in113', file: 'vt-in113.pdf', title: 'Vermont Schedule IN-113', values: v }
}

export function formHs122(ret: TaxReturnInput, vt: VtResult): FormFill | null {
  const h = ret.vt.homestead
  if (!h.file) return null
  const d = ret.vt
  const c = ret.contact
  const fs = ret.filingStatus
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  const [tf, tmi] = nameParts(ret.taxpayer.firstName)
  v.TPLastName = upper(ret.taxpayer.lastName)
  v.TPFirstName = upper(tf)
  if (tmi) v.TPMI = upper(tmi)
  v.TPSSN = digits(ret.taxpayer.ssn)
  if (fs === 'mfj' || fs === 'mfs') {
    const [sf, smi] = nameParts(ret.spouse.firstName)
    v.SPLastName = upper(ret.spouse.lastName)
    v.SPFirstName = upper(sf)
    if (smi) v.SPMI = upper(smi)
    v.SPSSN = digits(ret.spouse.ssn)
  }
  v['Mailing Address'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v.City = upper(c.city)
  v.State = upper(c.state).slice(0, 2)
  v.ZIP = digits(c.zip).length > 5 ? `${digits(c.zip).slice(0, 5)}-${digits(c.zip).slice(5, 9)}` : digits(c.zip)
  if (d.birthDates.taxpayer.trim()) v.DOB = mmddyyyy(d.birthDates.taxpayer)
  v.LocationofHomestead = upper(h.location || d.physicalAddress || c.street)
  if (h.town.trim()) v['City/Town of Legal Residence'] = upper(h.town)
  const status = { single: '#0', mfj: '#1', hoh: '#2', mfs: '#3', qss: '' }[fs]
  if (status) v.FedFilingStatus = status
  const span = digits(h.span)
  if (span.length === 11) { v['LineA1-SPAN-a'] = span.slice(0, 3); v['LineA1-SPAN-b'] = span.slice(3, 6); v['LineA1-SPAN-c'] = span.slice(6) }
  const pct = (name: string, n: number): void => {
    if (!(n > 0)) return
    const [w, dd] = [Math.floor(n), Math.round((n - Math.floor(n)) * 100)]
    v[`${name}-1`] = String(w)
    v[`${name}-2`] = String(dd).padStart(2, '0')
  }
  if (h.businessUse > 25) pct('LineA2', h.businessUse)
  pct('LineA3', h.rentalUse)
  v['122LineA4'] = h.otherBuildings ? 'Yes' : 'No'
  const pages = [0, 1]
  const hi = vt.hi144
  if (h.claimCredit && hi) {
    v['122LineB1'] = 'Yes'
    v['122LineB2'] = ret.canBeClaimedAsDependent ? 'Yes' : 'No'
    v['122LineB3'] = 'No'
    money('122LineB4', h.housesiteValue, true)
    money('122LineB5', h.educationTax, true)
    money('122LineB6', h.municipalTax, true)
    const own = h.ownership > 0 ? h.ownership : 100
    v['LineB7-1'] = String(Math.floor(own))
    v['LineB7-2'] = String(Math.round((own - Math.floor(own)) * 100)).padStart(2, '0')
    money('LineZ', hi.z, true)
    // ── Schedule HI-144 ──
    const c1 = hi.c1
    for (const k of 'abcdefghijklmn'.split('')) money(`144.Line${k.toUpperCase()}1`, c1[k])
    money('144.LineO1', c1.o, true)
    if (hi.c3.n > 0) { money('144.LineN3', hi.c3.n); money('144.LineO3', hi.c3.o); money('144.LineT3', hi.c3.t) }
    if (c1.h > 0) v['144.LineH-Specify'] = 'CHILD SUPPORT / GIFTS'
    if (c1.n > 0) v['144.LineN-Specify'] = 'OTHER INCOME, TAXABLE REFUNDS'
    money('144.LineP1', c1.p)
    money('144.LineQ1', c1.q)
    money('144.LineR2c1', c1.r2)
    money('144.LineR3c1', c1.r3)
    money('144.LineR4c1', c1.r4)
    money('144.LineS1', c1.s, true)
    money('144.LineT1', c1.t, true)
    money('144.LineU', c1.u, true)
    if (c1.v > 0) { money('144.LineV1', c1.v); money('144.LineW', c1.w) }
    money('144.LineY', c1.y)
    pages.push(2, 3)
  }
  if (ret.contact.phone.trim()) v['Taxpayer Phone Number'] = phone(ret.contact.phone)
  return { id: 'vt-hs122', file: 'vt-hs122.pdf', title: h.claimCredit ? 'Vermont Form HS-122 with Schedule HI-144' : 'Vermont Form HS-122 (homestead declaration)', values: v, pages }
}

/** Name and SSN at the top of a schedule. */
function header(ret: TaxReturnInput, v: Record<string, FieldValue>, names: { last: string; first: string; mi?: string; ssn: string }): void {
  const [tf, tmi] = nameParts(ret.taxpayer.firstName)
  v[names.last] = upper(ret.taxpayer.lastName)
  v[names.first] = upper(tf)
  if (tmi && names.mi) v[names.mi] = upper(tmi)
  v[names.ssn] = digits(ret.taxpayer.ssn)
}

export function formIn153(ret: TaxReturnInput, vt: VtResult): FormFill | null {
  const G = vt.in153
  if (!(vt.p1['8'] > 0)) return null
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  header(ret, v, { last: 'TPLastName', first: 'TPFirstName', mi: 'Mid Initial', ssn: 'TPSSN' })
  money('Line 1', G['1'], true)
  money('Line 2a', G['2a'])
  money('Line 2b', G['2b'])
  money('Line 3', G['3'])
  money('Line 4', G['4'], true)
  money('Line 8', G['8'], true)
  money('Line 9', G['9'], true)
  if (G['10'] !== undefined) {
    for (const k of ['10', '11', '12', '13a', '13b', '13c', '14', '15', '16', '17', '18']) money(`Line ${k}`, G[k], ['10', '12', '15', '17', '18'].includes(k))
  }
  money('Line 19', G['19'], true)
  money('Federal Taxable Income', G['fti'], true)
  money('Line 20', G['20'], true)
  money('Line 21', G['21'], true)
  return { id: 'vt-in153', file: 'vt-in153.pdf', title: 'Vermont Schedule IN-153', values: v }
}

export function formIn117(ret: TaxReturnInput, vt: VtResult): FormFill | null {
  const K = vt.in117
  if (!K) return null
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  header(ret, v, { last: 'Taxpayer Last name', first: 'Taxpayer First name', mi: 'Middle Initial', ssn: 'Taxpayer SSN' })
  v['Line 1 Name of state or Canadian province'] = upper(ret.vt.otherState.state).slice(0, 2)
  money('Line 2 Adjusted Gross Income taxed in another state or Candian Province that is also subject to Vermont income tax', K['2'], true)
  for (const k of ['3', '4', '6', '7']) money(`Line${k}`, K[k])
  for (const k of ['5', '8', '9', '10', '13', '16', '17', '18', '19', '20', '21']) money(`Line${k}`, K[k], true)
  for (const k of ['11', '12', '14', '15']) money(`Line${k}`, K[k])
  return { id: 'vt-in117', file: 'vt-in117.pdf', title: 'Vermont Schedule IN-117', values: v }
}

export function formIn119(ret: TaxReturnInput, vt: VtResult): FormFill | null {
  const { p1: A, p2: B } = vt.in119
  const part1 = A['7'] + A['14'] > 0
  const part2 = B['9'] > 0
  if (!part1 && !part2) return null
  const q = ret.vt.in119
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  header(ret, v, { last: 'TPLastName', first: 'Taxpayer First name', mi: 'Mid Initial', ssn: 'TPSSN' })
  if (part1) {
    for (const k of ['1', '2', '3', '5', '6', '8', '9', '10', '12', '13']) money(`Part I Line${k}`, A[k])
    for (const k of ['4', '7', '11', '14']) money(`Part I Line${k}`, A[k], true)
    money('Part I Line15', A['15'], true)
  }
  if (part2) {
    money('Part II Line1a', B['1a'])
    money('Part II Line1b', B['1b'])
    if (q.entityName.trim()) v['Name of entity'] = upper(q.entityName)
    if (q.entityFein.trim()) v.FEIN = digits(q.entityFein)
    for (const k of ['2', '3', '4', '5', '6', '7', '8']) {
      if (!B[`${k}c`]) continue
      money(`Part II Line${k}a`, B[`${k}a`])
      money(`Part II Line${k}b`, B[`${k}b`])
      money(`Part II Line${k}c`, B[`${k}c`], true)
    }
    money('Part II Line9', B['9'], true)
  }
  return { id: 'vt-in119', file: 'vt-in119.pdf', title: 'Vermont Schedule IN-119', values: v, pages: part1 && part2 ? [0, 1] : part1 ? [0] : [1] }
}

export function formRcc146(ret: TaxReturnInput, vt: VtResult): FormFill | null {
  const R = vt.rcc
  if (!R) return null
  const d = ret.vt
  const rn = d.renter
  const c = ret.contact
  const fs = ret.filingStatus
  const v: Record<string, FieldValue> = {}
  const money = moneyIn(v)
  header(ret, v, { last: 'TPLastName', first: 'TPFirstName', mi: 'TPMI', ssn: 'TPSSN' })
  if (fs === 'mfj' || fs === 'mfs') {
    const [sf, smi] = nameParts(ret.spouse.firstName)
    v.SPLastName = upper(ret.spouse.lastName)
    v.SPFirstName = upper(sf)
    if (smi) v.SPMI = upper(smi)
    v.SPSSN = digits(ret.spouse.ssn)
  }
  v['Mailing Address'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v.City = upper(c.city)
  v.State = upper(c.state).slice(0, 2)
  v.ZIP = digits(c.zip).length > 5 ? `${digits(c.zip).slice(0, 5)}-${digits(c.zip).slice(5, 9)}` : digits(c.zip)
  if (d.birthDates.taxpayer.trim()) v['TP-DOB'] = mmddyyyy(d.birthDates.taxpayer)
  if (rn.county.trim()) v.CountyOfRentalLocation = upper(rn.county)
  if (d.schoolCode.trim()) v.SchoolCode = digits(d.schoolCode).slice(0, 3)
  v.PhysicalAddress = upper(rn.address || d.physicalAddress || c.street)
  if (rn.unit.trim()) v.UnitNumber = upper(rn.unit)
  v['City/Town of Legal Residence'] = upper(rn.town || c.city)
  const status = { single: '#0', mfj: '#1', mfs: '#2', hoh: '#3', qss: '' }[fs]
  if (status) v.FedFilingStatus = status
  v.PayIncome = rn.applyToTax ? '#0' : '#1'
  const span = digits(rn.span)
  if (span.length === 11) { v['Line1a-SPAN'] = span.slice(0, 3); v['Line1b-SPAN'] = span.slice(3, 6); v['Line1c-SPAN'] = span.slice(6) }
  v.Line2 = '#0'
  v.Line3 = ret.canBeClaimedAsDependent ? '#0' : '#1'
  v.Line4 = rn.monthsRented >= 6 ? '#0' : '#1'
  v.Line5 = rn.sharedWithAdult ? '#0' : '#1'
  v.Line6 = rn.subsidized ? '#0' : '#1'
  if (rn.subsidized && rn.subsidizedMonths > 0) v.Line6a = String(Math.min(12, Math.round(rn.subsidizedMonths)))
  v.Line7 = String(Math.min(12, Math.max(0, Math.round(rn.monthsRented))))
  v.Line8 = String(R['8'])
  v.Line9 = '#0'
  money('Line10', R['10'], true)
  money('Line11', R['11'])
  money('Line12', R['12'])
  money('Line13', R['13'])
  money('Line14', R['14'], true)
  if (c.phone.trim()) v['Sig-TP Phone Number'] = phone(c.phone)
  return { id: 'vt-rcc146', file: 'vt-rcc146.pdf', title: 'Vermont Form RCC-146 (renter credit claim)', values: v }
}

export function buildVtPacket(ret: TaxReturnInput, res: TaxReturnResult, vt: VtResult, preparer?: PreparerInfo | null): FormPacket {
  void res
  const forms = [formIn111(ret, vt, preparer), formIn112(ret, vt), formIn113(ret, vt), formIn117(ret, vt), formIn119(ret, vt), formIn153(ret, vt), formHs122(ret, vt), formRcc146(ret, vt)].filter((x): x is FormFill => x !== null)
  return { forms, notIncluded: vt.attach }
}
