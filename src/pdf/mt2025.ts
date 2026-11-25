/**
 * Fills the official 2025 Montana Form 2 (public/forms/2025/mt-form2.pdf: the Department of Revenue’s fill-in Form 2,
 * 10 pages with Schedules I–V and 2EC, the Clear Form button removed). Whole dollars: the cents are preprinted.
 * Only the pages that are used are printed.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MtResult } from '../engine/mt2025.ts'
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

export function formMt2(ret: TaxReturnInput, mt: MtResult, preparer?: PreparerInfo | null): FormFill {
  const L = mt.lines
  const P = mt.p2
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const d = ret.mt
  const tp = ret.taxpayer
  const sp = ret.spouse
  const v: Record<string, FieldValue> = {}
  const money = (name: string, n: number | undefined, always = false): void => {
    const x = Math.round(n ?? 0)
    if (x === 0 && !always) return
    v[name] = x < 0 ? `-${-x}` : String(x)
  }

  // ── Page 1 ──
  const [tf, tmi] = nameParts(tp.firstName)
  v["Primary Taxpayer's First Name"] = upper(tf)
  if (tmi) v["Primary Taxpayer's Middle Initial"] = upper(tmi)
  v["Primary Taxpayer's Last Name"] = upper(tp.lastName)
  v["Primary Taxpayer's SSN"] = digits(tp.ssn)
  if (joint || fs === 'mfs') {
    const [sf, smi] = nameParts(sp.firstName)
    v["Spouse's First Name"] = upper(sf)
    if (smi) v["Spouse's Middle Initial"] = upper(smi)
    v["Spouse's Last Name"] = upper(sp.lastName)
    v["Spouse's SSN"] = digits(sp.ssn)
  }
  v['Mailing Address'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['City'] = upper(c.city)
  v['State'] = upper(c.state).slice(0, 2)
  v['Zip+4 Code'] = digits(c.zip).slice(0, 9)
  v['Filing Status'] = { single: 'Single', mfj: '2a', mfs: 'Married Filing Separately', qss: 'Qualifying Surviving Spouse', hoh: 'Head of Household' }[fs]
  v['Residency Status'] = 'Resident'
  money('Page 1 Line 1', L['1'], true)
  money('Page 1 Line 2', L['2'], true)
  money('Page 1 Line 3', L['3'], true)
  money('Page 1 Line 4', L['4'])
  money('Page 1 Line 5', L['5'])
  money('Page 1 Line 6', L['6'])
  money('Page 1 Line 7', L['7'], true)
  money('Page 1 Line 8', L['8'], true)
  money('Page 1 Line 9', L['9'])
  money('Page 1 Line 10', L['10'], true)
  money('Page 1 Line 11a', L['11a'])
  money('Page 1 Line 11b', L['11b'])
  money('Page 1 Line 11c', L['11c'])
  money('Page 1 Line 11d', L['11d'])
  money('Page 1 Line 11', L['11'])
  money('Page 1 Line 12', L['12'])
  money('Page 1 Line 13', L['13'])
  money('Page 1 Line 14', L['14'])
  if (L['15'] > 0) { money('Page 1 Line 15 EIC', L['15eic']); money('Page 1 Line 15', L['15']) }
  money('Page 1 Line 16', L['16'])
  money('Page 1 Line 17', L['17'])
  money('Page 1 Line 19', L['19'])
  money('Page 1 Line 21', L['21'], true)
  money('Page 1 Line 22', L['22'])
  money('Page 1 Line 23', L['23'])
  money('Page 1 Line 24', L['24'])
  money('Page 1 Line 26', L['26'])

  // ── Page 2 ──
  money('Page 2 Line 1', P['1'], true)
  if ((P['2'] ?? 0) > 0) {
    for (const k of ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11']) money(`Page 2 Line ${k}`, P[k], ['2', '3', '4', '5', '11'].includes(k))
  } else v['Page 2 Line 11'] = '0'
  money('Page 2 Line 12', P['12'], true)
  money('Page 2 Line 13', P['13'], true)
  if (L['26'] > 0) {
    const dep = ret.refundDeposit
    const route = digits(dep.routingNumber)
    const acct = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (route.length === 9 && acct) {
      v['Bank Routing Number'] = route
      v['Bank Account Number'] = acct.slice(0, 17)
      v['Bank Account Type'] = dep.accountType === 'savings' ? 'Savings' : 'Checking'
    }
  }
  if (d.birthDates.taxpayer.trim()) v['Taxpayer Date of Birth'] = mmddyyyy(d.birthDates.taxpayer)
  if (c.phone.trim()) v['Taxpayer daytime telephone number'] = digits(c.phone).slice(-10)
  if (joint && d.birthDates.spouse.trim()) v["Spouse's Date of Birth"] = mmddyyyy(d.birthDates.spouse)
  if (ret.usePaidPreparer && preparer) {
    v['Tax Preparer Printed Name'] = upper(preparer.name).slice(0, 55)
    v['Preparer daytime telephone number'] = digits(preparer.phone).slice(-10)
    v["Preparer's PTIN"] = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9)
  }

  const pages = [0, 1]
  // ── Schedule I ──
  const S1 = mt.s1
  if (S1['7'] + S1['24'] > 0) {
    pages.push(2)
    for (const k of ['1', '4', '6']) money(`Schedule I, Part I, Line ${k}`, S1[k])
    if (S1['6'] > 0 && d.otherAdditionsCode.trim()) v['Schedule I, Part I, Line 6 Code 1'] = upper(d.otherAdditionsCode).slice(0, 2)
    money('Schedule I, Part I, Line 7', S1['7'], true)
    for (const k of ['8', '9', '12', '13', '16', '17', '21', '22', '23']) money(`Schedule I, Part I, Line ${k}`, S1[k])
    if (S1['21'] > 0 && d.otherSubtractionsCode.trim()) v['Schedule I, Part I, Line 21 Code 1'] = upper(d.otherSubtractionsCode).slice(0, 2)
    money('Schedule I, Part I, Line 24', S1['24'], true)
  }
  // ── Schedule III ──
  const S3 = mt.s3
  if (S3['14'] + S3['17'] > 0) {
    pages.push(5)
    money('Schedule III Part I Line 1', S3['1'])
    money('Schedule III Part I Line 13', S3['13'])
    money('Schedule III Part I Line 14', S3['14'], true)
    money('Schedule III Part I Line 17', S3['17'])
  }
  if (mt.s3p2) { pages.push(6); Object.assign(v, partIIValues(mt.s3p2, d.otherStateCredit.state)) }
  // ── Schedule IV ──
  const S4 = mt.s4
  if (S4['8'] > 0) {
    pages.push(7)
    for (const k of ['1a', '1b', '1c', '1d']) {
      const n = S4[k]
      if (!n) continue
      if ([5, 10, 20].includes(n)) v[`Schedule IV Line ${k}`] = String(n)
      else v[`Schedule IV Line ${k} Other Amount`] = String(n)
    }
    money('Schedule IV Line 1', S4['1'], true)
    money('Schedule IV Line 8', S4['8'], true)
  }
  // ── Schedule 2EC ──
  const ec = mt.ec
  if (ec && L['16'] > 0) {
    pages.push(9)
    const claimant = tp.age >= 62 || !joint ? tp : sp
    const [cf, cmi] = nameParts(claimant.firstName)
    v["2EC Eligible Taxpayer's First Name"] = upper(cf)
    if (cmi) v["2EC Eligible Taxpayer's Middle Initial"] = upper(cmi)
    v["2EC Eligible Taxpayer's Last Name"] = upper(claimant.lastName)
    v["2EC Eligible Taxpayer's SSN"] = digits(claimant.ssn)
    if (d.elderly.physicalAddress.trim()) v['Physical Address'] = upper(d.elderly.physicalAddress)
    for (const k of ['Age 62', '9 Months', '6 months', 'Household Income', 'Only claimant']) v[k] = true
    v['Household Occupants'] = String(Math.max(1, Math.round(d.elderly.householdSize)))
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '14', '15', '16', '17']) money(`2EC Line ${k}`, ec[k])
    money('2EC Line 18', ec['18'], true)
    money('2EC Line 20', ec['20'], true)
    v['2EC Line 21'] = ec['21'] === 0 ? '0' : ec['21'].toFixed(3).replace(/^0/, '')
    money('2EC Line 22', ec['22'], true)
    money('2EC Line 23', ec['23'])
    money('2EC Line 24', ec['24'])
    money('2EC Line 25', ec['25'])
    money('2EC Line 26', ec['26'], true)
    money('2EC Line 27', ec['27'], true)
    money('2EC Line 28', ec['28'], true)
    v['2EC Line 29'] = ec['29'].toFixed(2).replace(/^0/, '')
    money('2EC Line 30', ec['30'], true)
  }
  return { id: 'mt2', file: 'mt-form2.pdf', title: 'Montana Form 2', values: v, pages }
}

/** Schedule III Part II values for one state or country. */
function partIIValues(Q: Record<string, number>, state: string): Record<string, FieldValue> {
  const v: Record<string, FieldValue> = {}
  const money = (name: string, n: number | undefined, always = false): void => {
    const x = Math.round(n ?? 0)
    if (x === 0 && !always) return
    v[name] = x < 0 ? `-${-x}` : String(x)
  }
  const st = upper(state).replace(/[^A-Z]/g, '').slice(0, 2)
  for (const k of ['1', '2', '3a', '3b', '3', '4', '5', '7', '9', '10']) money(`Schedule III Part II Line ${k}`, Q[k], ['3', '10'].includes(k))
  v['Schedule III Part II Line 6'] = Q['6'].toFixed(6)
  v['Schedule III Part II Line 8'] = Q['8'].toFixed(6)
  if (st) v['Schedule III, Part II, Line 2, State'] = st
  if (Q['11'] > 0) {
    for (const k of ['11', '12', '13', '14', '15', '17', '19', '20']) money(`Schedule III Part II Line ${k}`, Q[k], k === '20')
    v['Schedule III Part II Line 16'] = Q['16'].toFixed(6)
    v['Schedule III Part II Line 18'] = Q['18'].toFixed(6)
    if (st) v['Schedule III, Part II, Line 12, State'] = st
  }
  money('Schedule III Part II Line 21', Q['21'], true)
  return v
}

export function buildMtPacket(ret: TaxReturnInput, res: TaxReturnResult, mt: MtResult, preparer?: PreparerInfo | null): FormPacket {
  void res
  const main = formMt2(ret, mt, preparer)
  // Schedule III Part II for each further state: another copy of page 7 with that state's figures.
  const isPartII = (k: string): boolean => k.startsWith('Schedule III Part II') || k.startsWith('Schedule III, Part II')
  const extra = mt.s3p2More.map((x, i): FormFill => {
    const values: Record<string, FieldValue> = Object.fromEntries(Object.entries(main.values).filter(([k]) => !isPartII(k)))
    Object.assign(values, partIIValues(x.lines, x.state))
    return { id: `mt2-p2-${i + 2}`, file: 'mt-form2.pdf', title: `Montana Schedule III Part II (${x.state.toUpperCase() || `state ${i + 2}`})`, values, pages: [6] }
  })
  return { forms: [main, ...extra], notIncluded: mt.attach }
}
