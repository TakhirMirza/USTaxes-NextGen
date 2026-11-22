/**
 * Fills the official 2025 Missouri forms (public/forms/2025/mo-1040.pdf: the Department of Revenue’s “Fillable
 * Calculating” MO-1040 packet, scripts and buttons removed, reduced to the pages used here):
 * page 0–4 MO-1040, 5–7 MO-A, 8–9 MO-PTS, 10 MO-CRP, 11 MO-CR, 12 MO-WFTC. Names and SSNs are shared fields that
 * print on every form. Whole dollars.
 */
import type { Owner, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MoResult } from '../engine/mo2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const SUFFIX = /^(JR|SR|II|III|IV|V)\.?$/i
const nameParts = (first: string, last: string): { first: string; mi: string; last: string; suffix: string } => {
  const f = first.trim().split(/\s+/)
  const mi = f.length > 1 && /^[A-Za-z]\.?$/.test(f[f.length - 1]) ? (f.pop() ?? '').replace('.', '') : ''
  const l = last.trim().split(/\s+/)
  const suffix = l.length > 1 && SUFFIX.test(l[l.length - 1]) ? (l.pop() ?? '').replace('.', '') : ''
  return { first: f.join(' '), mi, last: l.join(' '), suffix }
}
const ssn = (s: string): string => {
  const x = digits(s)
  return x.length === 9 ? `${x.slice(0, 3)}-${x.slice(3, 5)}-${x.slice(5)}` : x
}
const phone = (s: string): string => {
  const x = digits(s).slice(-10)
  return x.length === 10 ? `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}` : x
}
const STATUS = { single: 'c.single', dependent: 'c.dependent', combined: 'c.married', separate: 'c.marrfilingsep', hoh: 'c.headofhousehold', widow: 'c.widower' } as const
/** MO-CRP line 7 boxes by percentage. */
const CRP_BOX: Record<number, string> = { 100: 'c.crp_7aa', 50: 'c.crp_7ia', 45: 'c.crp_7da', 33: 'c.crp_7ja', 25: 'c.crp_7ka' }
export const MO_TRUST_FUNDS: [string, string][] = [
  ['a', 'Children’s Trust Fund'], ['b', 'Veterans Trust Fund'], ['c', 'Elderly Home-Delivered Meals Trust Fund'], ['d', 'Missouri National Guard Trust Fund'],
  ['e', 'Workers’ Memorial Fund'], ['f', 'Childhood Lead Testing Fund'], ['g', 'Missouri Military Family Relief Fund'], ['h', 'General Revenue Fund'],
  ['i', 'Organ Donor Program Fund'], ['j', 'Kansas City Regional Law Enforcement Memorial Foundation Fund'], ['k', 'Soldiers Memorial Military Museum in St. Louis Fund'], ['l', 'Missouri Medal of Honor Fund']
]

export function formMo1040(ret: TaxReturnInput, res: TaxReturnResult, mo: MoResult, preparer?: PreparerInfo | null): FormFill {
  const { Y, S, lines: L } = mo
  const two = mo.two
  const d = ret.mo
  const c = ret.contact
  const v: Record<string, FieldValue> = {}
  const money = (name: string, n: number | undefined, always = false): void => {
    const x = Math.round(n ?? 0)
    if (x === 0 && !always) return
    v[name] = x < 0 ? `-${-x}` : String(x)
  }
  const pages = [0, 1, 2, 3, 4]
  const owners: Owner[] = two ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: Owner) => (o === 'taxpayer' ? ret.taxpayer : ret.spouse)
  const suffixOf = (o: Owner): 'Y' | 'S' => (o === 'taxpayer' ? 'Y' : 'S')

  // ── Page 1 ──
  v[STATUS[mo.status]] = true
  v.federalreturn = true
  for (const o of owners) {
    const p = person(o)
    const k = suffixOf(o)
    if ((p.age >= 62 && p.age < 65) && !p.age65OrOlder) v[`62-${k}`] = true
    if (p.age >= 65 || p.age65OrOlder) v[`65-${k}`] = true
    if (p.blind) v[`blind-${k}`] = true
    if (d.disabled[o]) v[`disabled-${k}`] = true
  }
  const tp = nameParts(ret.taxpayer.firstName, ret.taxpayer.lastName)
  v['firstname-1'] = upper(tp.first)
  if (tp.mi) v['min-1'] = upper(tp.mi)
  v['lastname-1'] = upper(tp.last)
  if (tp.suffix) v['title-1'] = upper(tp.suffix)
  v.SSN_1 = ssn(ret.taxpayer.ssn)
  v['SSN-1'] = digits(ret.taxpayer.ssn)
  if (two || mo.status === 'separate') {
    const sp = nameParts(ret.spouse.firstName, ret.spouse.lastName)
    v['firstname-2'] = upper(sp.first)
    if (sp.mi) v['min-2'] = upper(sp.mi)
    v['lastname-2'] = upper(sp.last)
    if (sp.suffix) v['title-2'] = upper(sp.suffix)
    v.SSN_2 = ssn(ret.spouse.ssn)
    v['SSN-2'] = digits(ret.spouse.ssn)
  }
  v.address = upper([c.street, c.apt].filter((x) => x.trim()).join(' APT '))
  v.city = upper(c.city)
  v.state = upper(c.state).slice(0, 2)
  v['d.zipcode'] = digits(c.zip).slice(0, 5)
  if (digits(c.zip).length === 9) v['d.zipext'] = digits(c.zip).slice(5)
  if (d.county) v['COUNTY CODE'] = upper(d.county)

  // ── Page 2: lines 1–21 ──
  for (const k of ['1', '3', '5']) { money(`line${k}-Y`, Y[k], true); if (two) money(`line${k}-S`, S[k], true) }
  for (const k of ['2', '4']) { money(`line${k}-Y`, Y[k]); if (two) money(`line${k}-S`, S[k]) }
  money('line6', L['6'], true)
  v['line7-Y'] = String(Y['7'])
  if (two) v['line7-S'] = String(S['7'])
  money('line8', L['8'])
  money('line9', L['9'], true)
  money('line10', L['10'])
  money('line11', L['11'], true)
  v.line12 = String(L['12'])
  money('line13', L['13'], true)
  money('line14', L['14'], true)
  for (const k of ['15', '16', '17', '18', '19', '21', '24']) money(`line${k}`, L[k])
  money('line25', L['25'], true)
  money('line26', L['26'], true)
  for (const k of ['27', '29', '30', '33', '35']) { money(`line${k}Y`, Y[k], true); if (two) money(`line${k}S`, S[k], true) }
  for (const k of ['31', '34']) { money(`line${k}Y`, Y[k]); if (two) money(`line${k}S`, S[k]) }
  v.line32Y = '100'
  if (two) v.line32S = '100'
  money('line36', L['36'], true)
  for (const k of ['37', '38', '41', '42', '43', '44']) money(`line${k}`, L[k])
  money('line45', L['45'], true)

  // ── Pages 4–5 ──
  if (L['49'] > 0) {
    money('line49', L['49'], true)
    money('line50', L['50'])
    for (const [k] of MO_TRUST_FUNDS) money(`line51${k}`, d.trustFunds[k])
    money('line51', L['51'])
    money('line52', L['52'])
    money('line53', L['53'], true)
    const dep = ret.refundDeposit
    const route = digits(dep.routingNumber)
    const acct = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (L['53'] > 0 && route.length === 9 && acct) {
      v.dd_routingno = route
      v.dd_acctno = acct.slice(0, 17)
      v[dep.accountType === 'savings' ? 'dd_savings' : 'dd_checking'] = true
    }
  } else {
    money('line54', L['54'], true)
    money('line56', L['56'], true)
  }
  if (c.phone.trim()) v.dayphone = phone(c.phone)
  if (c.email.trim()) v.Emailaddress = c.email.trim()
  if (ret.usePaidPreparer && preparer) {
    v.FEIN = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9)
    if (preparer.phone.trim()) v.prepphone = phone(preparer.phone)
    if (preparer.firmAddress.trim()) v.prepaddress = upper(preparer.firmAddress)
    v.YES = 'X'
  }

  // ── MO-A ──
  const A = mo.a
  const p3 = mo.part3
  const partA = ['1', '2'].some((k) => A.Y[k] || A.S[k]) || ['8', '9', '10', '11', '12', '13', '15', '17', '18'].some((k) => A.Y[k] || A.S[k])
  if (partA || mo.part2 && mo.itemize || p3.D > 0) {
    pages.push(5, 6, 7)
    const cols: ('Y' | 'S')[] = two ? ['Y', 'S'] : ['Y']
    for (const col of cols) {
      const x = col.toLowerCase()
      for (const k of ['1', '2', '8', '9', '10', '11', '12', '13', '15', '17', '18']) money(`moa_${k}${x}`, A[col][k])
      money(`moa_7${x}`, A[col]['7'], true)
      money(`moa_19${x}`, A[col]['19'], true)
    }
    if (A.Y['11'] + (A.S['11'] ?? 0) > 0) {
      if (ret.mo.railroad.taxpayer + ret.mo.railroad.spouse > 0) v.moa_11r = true
      if (ret.mo.otherSubtractions.taxpayer + ret.mo.otherSubtractions.spouse > 0) { v.moa_11o = true; v.moa_11other = 'SEE STATEMENT' }
    }
    if (A.Y['2'] + (A.S['2'] ?? 0) > 0) { v.moa_2o = true; v.moa_2other = 'SEE STATEMENT' }
    const P = mo.part2
    if (P && mo.itemize) {
      for (const k of ['1', '2', '3', '6', '7', '8', '9', '10', '11', '12']) money(`moa_pt2_${k}`, P[k], ['1', '8', '11', '12'].includes(k))
      if (P.w1 !== undefined) {
        money('moa_wks1', P.w1, true); money('moa_wks2', P.w2, true); money('moa_wks3', P.w3); money('moa_wks4', P.w4, true)
        v.moa_wks5 = `${(P.w5 * 100).toFixed(2)}`; money('moa_wks6', P.w6, true); money('moa_wks7', P.w7, true)
      }
    }
    // Part 3: Section A (pt3), B (pt4), C (pt5), D.
    for (const col of cols) {
      const x = col.toLowerCase()
      if (p3.A[col]['1']) for (const k of ['1', '2', '3', '4']) money(`moa_pt3_${k}${x}`, p3.A[col][k], true)
      money(`moa_pt4_6${x}`, p3.B[`6${col}`])
      money(`moa_pt4_7${x}`, p3.B[`7${col}`])
      money(`moa_pt5_1${x}`, p3.C[col]['1'])
      money(`moa_pt5_2${x}`, p3.C[col]['2'])
      money(`moa_pt5_3${x}`, p3.C[col]['3'])
    }
    money('moa_pt3_5', p3.A.total)
    if (p3.B['8'] > 0) {
      money('moa_pt4_1', p3.B['1'], true); money('moa_pt4_2', p3.B['2'], true); money('moa_pt4_3', p3.B['3'], true); money('moa_pt4_4', p3.B['4'], true)
      money('moa_pt4_5', p3.B['5'], true); money('moa_pt4_8', p3.B['8'], true); money('moa_pt4_9', p3.B['9'], true)
    }
    money('moa_pt5_4', p3.C.total)
    money('moa_pt5_TE', p3.D, true)
  }

  // ── MO-PTS / MO-CRP ──
  const Pt = mo.pts
  if (Pt) {
    pages.push(8, 9)
    v[{ A: 'c.pts_65', B: 'c.pts_100disvet', C: 'c.pts_100disabled', D: 'c.pts_60orolder' }[d.pts.qualification]] = true
    v[two ? 'c.pts_married' : 'c.pts_single'] = true
    const dob = (s: string, n: 1 | 2): void => {
      const m = s.trim().match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/)
      if (!m) return
      v[`d.pts_bd_mm-${n}`] = m[1].padStart(2, '0'); v[`d.pts_bd_dd-${n}`] = m[2].padStart(2, '0'); v[`d.pts_bd_yy-${n}`] = m[3]
    }
    dob(d.birthDates.taxpayer, 1)
    if (two) dob(d.birthDates.spouse, 2)
    for (const k of ['2', '3', '4', '5', '6', '7', '9', '11', '12']) money(`n.pts_${k}`, Pt[k])
    for (const k of ['1', '8', '10', '13', '14']) money(`n.pts_${k}`, Pt[k], true)
    if (d.pts.owner) v['c.ownfullyear'] = true
    const crp = mo.crp
    if (crp) {
      pages.push(10)
      v['t.crp_address1'] = upper(d.pts.rentalAddress || c.street)
      if (d.pts.rentalApt.trim()) v['t.crp_apt1'] = upper(d.pts.rentalApt)
      v['t.crp_city1'] = upper(d.pts.rentalCity || c.city)
      v['t.crp_state1'] = 'MO'
      v['t.crp_zip1'] = digits(d.pts.rentalZip || c.zip).slice(0, 5)
      if (d.pts.landlordName.trim()) v['t.crp_llname1'] = upper(d.pts.landlordName)
      if (d.pts.landlordAddress.trim()) v['t.crp_lladdress1'] = upper(d.pts.landlordAddress)
      if (d.pts.landlordCity.trim()) v['t.crp_llcity1'] = upper(d.pts.landlordCity)
      if (d.pts.landlordState.trim()) v['t.crp_llstate1'] = upper(d.pts.landlordState).slice(0, 2)
      if (d.pts.landlordZip.trim()) v['t.crp_llzip1'] = digits(d.pts.landlordZip).slice(0, 5)
      if (d.pts.landlordPhone.trim()) v['d.crp_llphone1'] = phone(d.pts.landlordPhone)
      v['d.crp_5fr_mm-1'] = '01'; v['d.crp_5fr_dd-1'] = '01'; v['d.crp_5to_mm-1'] = '12'; v['d.crp_5to_dd-1'] = '31'
      const box = CRP_BOX[crp['7']]
      if (box) v[box] = true
      money('n.crp_6a', crp['6'], true)
      v['n.crp_7a'] = String(crp['7'])
      money('n.crp_8a', crp['8'], true)
      money('n.crp_9a', crp['9'], true)
    }
  }

  // ── MO-CR ──
  const K = mo.cr
  if (K) {
    pages.push(11)
    const x = mo.crCol.toLowerCase()
    const st = upper(d.otherState.state).slice(0, 2)
    v[mo.crCol === 'Y' ? 'mocr_st-1' : 'mocr_st-2'] = st
    for (const k of ['1', '2', '3', '5', '7', '9', '10', '11']) money(`mocr_${k}${x}`, K[k], true)
    v[`mocr_8${x}`] = String(K['8'])
  }

  // ── MO-WFTC ──
  const W = mo.wftc
  if (W) {
    pages.push(12)
    v.EIC_YES = 'X'
    v.MFJ_NO = 'X'
    v.INV_NO = 'X'
    const kids = ret.dependents.filter((k) => k.childRelationship && k.monthsLivedWithYou > 6 && (k.age < 19 || (k.student && k.age < 24) || k.disabled)).slice(0, 3)
    kids.forEach((k, i) => {
      v[`QCName-${i + 1}`] = upper(k.name)
      if (k.ssn) v[`QCSSN-${i + 1}`] = digits(k.ssn)
    })
    for (const k of ['5', '6', '7', '8', '9', '10']) money(`wftc_line${k}`, W[k], true)
  }
  return { id: 'mo-1040', file: 'mo-1040.pdf', title: 'Missouri Form MO-1040', values: v, pages }
}

export function buildMoPacket(ret: TaxReturnInput, res: TaxReturnResult, mo: MoResult, preparer?: PreparerInfo | null): FormPacket {
  return { forms: [formMo1040(ret, res, mo, preparer)], notIncluded: mo.attach }
}
