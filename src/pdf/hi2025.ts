/**
 * Fills the official 2025 Hawaii Form N-11 (public/forms/2025/hi-n11.pdf: the Department of Taxation’s fill-in N-11,
 * four pages, followed by Schedule X, two pages; the print / reset buttons, on-screen notes and the stale barcode
 * field removed). Schedule X is kept only when the renters or child care credit is claimed. Whole dollars.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { careQualifyingPerson } from '../engine/compute.ts'
import type { HiResult } from '../engine/hi2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const ssnFmt = (s: string): string => {
  const x = digits(s)
  return x.length === 9 ? `${x.slice(0, 3)}-${x.slice(3, 5)}-${x.slice(5)}` : x
}

/** N-11 lines whose negative amounts go in the separate “-” box. */
const NEG = new Set(['7', '12', '20', '24', '34', '36'])
/** Lines printed even when zero. */
const ALWAYS = new Set(['7', '12', '20', '24', '25', '26', '27', '34', '36', '41'])

export function formHiN11(ret: TaxReturnInput, res: TaxReturnResult, hi: HiResult, preparer?: PreparerInfo | null): FormFill {
  const L = hi.lines
  const X = hi.x
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const d = ret.hi
  const v: Record<string, FieldValue> = {}
  const money = (name: string, n: number, always = false): void => {
    const x = Math.round(n)
    if (x === 0 && !always) return
    if (x < 0 && NEG.has(name)) { v[`${name}_neg`] = '-'; v[name] = String(-x); return }
    v[name] = x < 0 ? `-${-x}` : String(x)
  }
  const schX = L['29'] + L['30'] > 0
  const part2 = L['35'] > 0 || Object.keys(hi.crCarry).length > 0
  const cr = L['32'] > 0 || part2
  const pages = [0, 1, 2, 3, ...(cr ? (part2 ? [4, 5, 6] : [4]) : []), ...(schX ? [7, 8] : [])]

  // ── Page 1: names, address, filing status, exemptions ──
  const tp = ret.taxpayer
  const sp = ret.spouse
  const first = (s: string): [string, string] => {
    const parts = s.trim().split(/\s+/)
    const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? parts.pop() ?? '' : ''
    return [parts.join(' '), mi.replace('.', '')]
  }
  const [tf, tmi] = first(tp.firstName)
  v['p1_first_name_p'] = upper(tf)
  if (tmi) v['p1_mi_p'] = upper(tmi)
  v['p1_last_name_p'] = upper(tp.lastName)
  v['p1_ssn_p'] = ssnFmt(tp.ssn)
  v['p1_name4_p'] = upper(tp.lastName).replace(/[^A-Z]/g, '').slice(0, 4)
  if (joint || fs === 'mfs') {
    const [sf, smi] = first(sp.firstName)
    if (joint) {
      v['p1_first_name_s'] = upper(sf)
      if (smi) v['p1_mi_s'] = upper(smi)
      v['p1_last_name_s'] = upper(sp.lastName)
      v['p1_name4_s'] = upper(sp.lastName).replace(/[^A-Z]/g, '').slice(0, 4)
    }
    v['p1_ssn_s'] = ssnFmt(sp.ssn)
  }
  v['p1_street_address'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['p1_city'] = upper(c.city)
  v['p1_state'] = upper(c.state).slice(0, 2)
  v['p1_zip'] = digits(c.zip).slice(0, 9)
  v[{ single: '1', mfj: '2', mfs: '3', hoh: '4', qss: '5' }[fs]] = true
  if (fs === 'mfs') v['3_name'] = upper(`${sp.firstName} ${sp.lastName}`)
  if (fs === 'hoh') {
    const q = ret.dependents.find((x) => !x.childRelationship) ?? null
    if (q) v['4_name'] = upper(q.name)
  }
  const ex = hi.exemptions
  if (ex.a > 0) v['6a_yourself'] = true
  if (ex.a > 1) v['6a_65plus'] = true
  if (joint) { v['6b_spouse'] = true; if (ex.b > 1) v['6b_65plus'] = true }
  v['6ab'] = String(ex.a + ex.b)
  ret.dependents.slice(0, 6).forEach((x, i) => {
    v[`dep_name${i + 1}`] = upper(x.name)
    v[`dep_ssn${i + 1}`] = ssnFmt(x.ssn)
    v[`dep_relation${i + 1}`] = upper(x.relationship)
  })
  if (ex.c) v['6c'] = String(ex.c)
  if (ex.d) v['6d'] = String(ex.d)
  v['6e'] = String(ex.e)

  // ── Pages 2–4 headers ──
  for (const p of ['p2', 'p3', 'p4']) {
    v[`${p}_ssn_p`] = ssnFmt(tp.ssn)
    if (joint) v[`${p}_ssn_s`] = ssnFmt(sp.ssn)
    v[`${p}_name_p`] = upper(`${tp.firstName} ${tp.lastName}`)
    if (joint) v[`${p}_name_s`] = upper(`${sp.firstName} ${sp.lastName}`)
  }

  // ── Page 2: lines 7–24 ──
  for (const k of ['7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21a', '21b', '21c', '21d', '21e', '21f', '22', '23', '24']) money(k, L[k], ALWAYS.has(k))
  if (hi.dependentBox) v['claimed_dep_box'] = true

  // ── Page 3: lines 25–45 ──
  if (d.disabled.taxpayer) v['25_yourself'] = true
  if (joint && d.disabled.spouse) v['25_spouse'] = true
  for (const k of ['25', '26', '27']) money(k, L[k], true)
  if (hi.capitalGains) { v['27_box4'] = true; money('27a', L['27a']) } else v['27_box1'] = true
  if (L['28'] > 0) { v['28_exemptions'] = String(L['28ex']); money('28', L['28']) }
  for (const k of ['29', '30', '31', '32', '33']) money(k, L[k])
  money('34', L['34'], true)
  money('35', L['35'])
  money('36', L['36'], true)
  for (const k of ['37', '38', '39', '40']) money(k, L[k])
  money('41', L['41'], true)
  money('42', L['42'])
  if (L['44'] > 0) {
    const owners = joint ? (['taxpayer', 'spouse'] as const) : (['taxpayer'] as const)
    const box = { taxpayer: 'yourself', spouse: 'spouse' }
    for (const o of owners) {
      if (d.schools[o]) v[`43a_${box[o]}`] = true
      if (d.libraries[o]) v[`43b_${box[o]}`] = true
      if (d.violence[o]) v[`43c_${box[o]}`] = true
    }
    v['44'] = String(L['44'])
  }
  money('45', L['45'])

  // ── Page 4: refund / amount owed, signature block ──
  money('46', L['46'])
  money('47a', L['47a'])
  if (L['47a'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      v['routing_number'] = digits(dep.routingNumber).slice(0, 9)
      v['account_number'] = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
      v[dep.accountType === 'savings' ? 'savings' : 'checking'] = true
    }
  }
  money('48', L['48'])
  money('49', L['49'])
  // Lines 51–53: Schedule C / E / F questions (Hawaii gross receipts and GE license are left for you).
  v[res.scheduleC.length ? '51_y' : '51_n'] = true
  v[ret.rentals.length ? '52_y' : '52_n'] = true
  v['53_n'] = true
  if (d.electionFund.taxpayer) v['election_fund_p'] = true
  if (joint && d.electionFund.spouse) v['election_fund_s'] = true
  v['occupation_p'] = upper(d.occupation.taxpayer || tp.occupation).slice(0, 24)
  if (joint) v['occupation_s'] = upper(d.occupation.spouse || sp.occupation).slice(0, 24)
  if (c.phone.trim()) v['phone_p'] = digits(c.phone).slice(-10)
  if (ret.usePaidPreparer && preparer) {
    v['ptin'] = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9)
    v['name_preparer'] = upper(preparer.name).slice(0, 35)
    v['fein_preparer'] = digits(preparer.firmEin).slice(0, 9)
    v['phone_preparer'] = digits(preparer.phone).slice(-10)
  }

  // ── Schedule X ──
  if (schX) {
    const names = upper(joint ? `${tp.firstName} ${tp.lastName} & ${sp.firstName} ${sp.lastName}` : `${tp.firstName} ${tp.lastName}`)
    v['SCHX-1P1'] = names; v['SCHX-1P2'] = names
    v['SCHX-2P1'] = ssnFmt(tp.ssn); v['SCHX-2P2'] = ssnFmt(tp.ssn)
    if (L['29'] > 0) {
      if (d.rentalAddress.trim()) v['SCHX-3'] = upper(d.rentalAddress)
      v['SCHX-6'] = String(X['5'])
      v['SCHX-9'] = String(X['5'])
      if (X['6']) v['SCHX-10'] = String(X['6'])
      v['SCHX-11'] = String(X['7'])
      v['SCHX-12'] = upper(`${tp.firstName} ${tp.lastName}`)
      if (joint) v['SCHX-13'] = upper(`${sp.firstName} ${sp.lastName}`)
      const slots: [string, string | null][] = [['SCHX-14', 'SCHX-15'], ['SCHX-16', 'SCHX-17'], ['SCHX-18', 'SCHX-19'], ['SCHX-20', 'SCHX-21']]
      ret.dependents.slice(0, 4).forEach((x, i) => {
        const [n, rel] = slots[i]
        v[n] = upper(x.name)
        if (rel) v[rel] = upper(x.relationship)
      })
      v['SCHX-22'] = String(X['8'])
      v['SCHX-23'] = String(X['9'])
      v['SCHX-24'] = String(X['10'])
      v['SCHX-25'] = String(X['11'])
      v['SCHX-26'] = String(X['12'])
    }
    if (L['30'] > 0) {
      const care = ret.dependentCare
      const provRows = [['SCHX-27', 'SCHX-29', 'SCHX-31', 'SCHX-33'], ['SCHX-34', 'SCHX-36', 'SCHX-38', 'SCHX-40']]
      care.providers.slice(0, 2).forEach((p, i) => {
        const [n, , t, amt] = provRows[i]
        v[n] = upper(p.name).slice(0, 40)
        const [a1, a2] = provRows[i][1] === 'SCHX-29' ? ['SCHX-29', 'SCHX-30'] : ['SCHX-36', 'SCHX-37']
        const comma = p.address.indexOf(',')
        v[a1] = upper(comma > 0 ? p.address.slice(0, comma) : p.address)
        if (comma > 0) v[a2] = upper(p.address.slice(comma + 1))
        const tin = digits(p.tin)
        v[t] = tin.length === 9 && !p.tin.includes('-') ? tin : p.tin
        v[amt] = String(Math.round(p.amountPaid))
      })
      if ('B2' in X) {
        const B: [string, string][] = [['B2', '41'], ['B5', '44'], ['B6', '50'], ['B7', '51'], ['B8', '52'], ['B9', '53'], ['B10', '54'], ['B11', '55'], ['B12', '56'], ['B13', '57'], ['B14', '58'], ['B15', '59'], ['B16', '60'], ['B17', '61'], ['B18', '62'], ['B19', '63'], ['B20', '64']]
        for (const [k, f] of B) v[`SCHX-${f}`] = String(X[k])
      }
      const persons = ret.dependents.filter(careQualifyingPerson).slice(0, 2)
      const per = persons.length ? Math.floor(X['21'] / persons.length) : 0
      const rows = [['SCHX-65a', 'SCHX-67', 'SCHX-68'], ['SCHX-69a', 'SCHX-71', 'SCHX-72']]
      persons.forEach((p, i) => {
        const [n, s, e] = rows[i]
        v[n] = upper(p.name)
        v[s] = ssnFmt(p.ssn)
        v[e] = String(i === persons.length - 1 ? X['21'] - per * (persons.length - 1) : per)
      })
      v['SCHX-73'] = String(X['22'])
      v['SCHX-74'] = String(X['23'])
      v['SCHX-75'] = String(X['24'])
      v['SCHX-76'] = String(X['25'])
      v['SCHX-77'] = String(X['26'])
      v['SCHX-78'] = X['27'].toFixed(2).replace(/^0/, '')
      v['SCHX-79'] = String(X['28'])
    }
  }
  // ── Schedule CR ──
  if (cr) {
    const names = upper(joint ? `${tp.firstName} ${tp.lastName} & ${sp.firstName} ${sp.lastName}` : `${tp.firstName} ${tp.lastName}`)
    for (const [n, s1, s2] of [['NAMECOPYCRP1', 'SSNCOPYCRP1', 'SSNCOPYCR1P1'], ['NAMECOPYP2', 'SSNCOPYCRP2', 'SSNCOPYCR1P2'], ['NAMECOPYP3', 'SSNCOPYCRP3', 'SSNCOPYCR1P3']]) {
      v[n] = names
      v[s1] = n === 'NAMECOPYP3' ? digits(tp.ssn) : ssnFmt(tp.ssn)
      if (joint) v[s2] = n === 'NAMECOPYP3' ? digits(sp.ssn) : ssnFmt(sp.ssn)
    }
    if (L['eitc'] > 0) v['CR8'] = String(L['eitc'])
    const C = hi.cr
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '9', '12', '13']) if (C[k] > 0) v[`CR${k}`] = String(C[k])
    if (C['10c'] > 0) { if (C['10a'] > 0) v['CR10A'] = String(C['10a']); if (C['10b'] > 0) v['CR10B'] = String(C['10b']); v['CR10C'] = String(C['10c']) }
    if (C['4'] > 0 && ret.hi.cr.energy) v[ret.hi.cr.energy === 'solar' ? 'CR3A' : 'CR3B'] = true
    for (const [k, c] of Object.entries(hi.crCarry)) {
      v[`CR${k}A`] = String(c.a)
      if (+k >= 25) v[`CR${k}B`] = String(c.b)
      v[`CR${k}C`] = String(c.c)
      if (k !== '24') v[`CR${k}D`] = String(c.d)
    }
    if (hi.crCarry['28'] && ret.hi.cr.energy28) v[ret.hi.cr.energy28 === 'solar' ? 'CR28solar' : 'CR28wind'] = true
    if (L['32'] > 0) v['CR11'] = String(L['32'])
    if (L['35'] > 0) v['CR33D'] = String(L['35'])
  }
  return { id: 'hin11', file: 'hi-n11.pdf', title: 'Hawaii Form N-11', values: v, pages }
}

export function buildHiPacket(ret: TaxReturnInput, res: TaxReturnResult, hi: HiResult, preparer?: PreparerInfo | null): FormPacket {
  const notIncluded = hi.attach.filter((x) => !x.startsWith('Schedule X') && !x.startsWith('Schedule CR'))
  return { forms: [formHiN11(ret, res, hi, preparer)], notIncluded }
}
