/**
 * Fills the official 2025 Maine Form 1040ME and its schedules (public/forms/2025/me-*.pdf: the Maine Revenue Services
 * fill-in PDFs with the Clear / Print buttons removed). Whole dollars: the cents are preprinted. Social Security
 * numbers are written with spaces, as the form asks.
 */
import type { Owner, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { MeResult } from '../engine/me2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const ssnFmt = (s: string): string => {
  const x = digits(s)
  return x.length === 9 ? `${x.slice(0, 3)} ${x.slice(3, 5)} ${x.slice(5)}` : x
}
const nameParts = (first: string): [string, string] => {
  const parts = first.trim().split(/\s+/)
  const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? parts.pop() ?? '' : ''
  return [parts.join(' '), mi.replace('.', '')]
}
const money = (v: Record<string, FieldValue>, name: string, n: number | undefined, always = false): void => {
  const x = Math.round(n ?? 0)
  if (x === 0 && !always) return
  v[name] = x < 0 ? `-${-x}` : String(x)
}
const header = (ret: TaxReturnInput): string => {
  const tp = ret.taxpayer
  const sp = ret.spouse
  return upper(ret.filingStatus === 'mfj' ? `${tp.firstName} ${tp.lastName} & ${sp.firstName} ${sp.lastName}` : `${tp.firstName} ${tp.lastName}`)
}

export function formMe1040(ret: TaxReturnInput, me: MeResult, preparer?: PreparerInfo | null): FormFill {
  const L = me.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const d = ret.me
  const tp = ret.taxpayer
  const sp = ret.spouse
  const v: Record<string, FieldValue> = {}

  // ── Page 1 ──
  const [tf, tmi] = nameParts(tp.firstName)
  v['Form 1040ME Your First Name'] = upper(tf)
  if (tmi) v['Form 1040ME Middle Initial'] = upper(tmi)
  v['Form 1040ME Last name'] = upper(tp.lastName)
  v['Form 1040ME Your social security number'] = ssnFmt(tp.ssn)
  if (joint || fs === 'mfs') {
    const [sf, smi] = nameParts(sp.firstName)
    v["Form 1040ME Spouse's first name"] = upper(sf)
    if (smi) v['Form 1040 S M I'] = upper(smi)
    v["Form 1040ME Spouse's last name"] = upper(sp.lastName)
    v["Form 1040ME Spouse's social security number"] = ssnFmt(sp.ssn)
  }
  v['Form 1040ME Current mailing address'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' ')).slice(0, 30)
  v['Form 1040ME City or town'] = upper(c.city).slice(0, 30)
  v['Form 1040ME State'] = upper(c.state).slice(0, 2)
  v['Form 1040ME Zip code'] = digits(c.zip).slice(0, 9)
  const phone = digits(c.phone).slice(-10)
  if (phone.length === 10) {
    v['Form 1040ME Home area code'] = phone.slice(0, 3)
    v['Form 1040ME Home phone number'] = `${phone.slice(3, 6)} ${phone.slice(6)}`
  }
  if (d.cleanElection.taxpayer) v['Form 1040ME Maine clean election fund (you)'] = true
  if (joint && d.cleanElection.spouse) v['Form 1040ME Spouse'] = true
  if (d.farmingFishing) v['Form 1040ME Check here if you were engaged in commercial farming or fishing during 2018'] = true
  v['radStatus'] = { single: '#0', mfj: '#1', mfs: '#2', hoh: '#3', qss: '#4' }[fs]
  v['Residency status'] = '#0'
  if (me.boxes.old.taxpayer) v['65 or over'] = true
  if (me.boxes.old.spouse) v['Spouse 65 or over'] = true
  if (me.boxes.blind.taxpayer) v['Blind'] = true
  if (me.boxes.blind.spouse) v['Spouse blind'] = true
  v['1040ME Total number of exemptions'] = String(L['13'])
  v['1040ME Total qualifying children and dependents'] = String(L['13a'])
  money(v, '1040ME Federal adjusted gross income', L['14'], true)
  money(v, '1040ME Income modifications additions', L['15a'])
  money(v, '1040ME Income modifications subtractions', L['15b'])
  money(v, '1040ME Maine adjusted gross income', L['16'], true)
  v['Type of filing'] = me.itemize ? '#1' : '#0'
  money(v, '1040ME Deduction', L['17'], true)
  if (me.s2) v['Line 17a'] = true

  // ── Page 2 ──
  money(v, '1040ME Exemption', L['18'], true)
  money(v, '1040ME Taxable income', L['19'], true)
  money(v, '1040ME Income tax', L['20'], true)
  // The field names on page 2 are shifted: line 22 is named “Tax credits”, line 23 “Nonresident credit”.
  money(v, '1040ME Tax credits', L['22'], true)
  money(v, '1040ME Nonresident credit', L['23'])
  money(v, '1040ME Net tax', L['24'], true)
  money(v, '1040ME Tax payments', L['25a'])
  money(v, '1040ME 2019 estimated payments and 2018 carry forwards, and real estate withholding payments', L['25b'])
  money(v, '1040ME Refunable tax credit', L['25c'])
  money(v, '1040ME Property tax fairness credit', L['25d'])
  money(v, '1040ME Sales tax fairness credit', L['25e'])
  money(v, '1040ME Total', L['25f'], true)
  money(v, '1040ME Line 25f minus line 26', L['27'], true)
  money(v, '1040ME Income tax overpaid', L['28'])
  money(v, '1040ME Income tax underpaid', L['29'])
  money(v, '1040ME Use tax (sales tax)', L['30'])
  money(v, '1040ME Charitable contributions and park passes', L['31'])
  money(v, 'Net overpayment', L['33'])
  money(v, '1040ME Amount to be credited to 2019 estimated tax', L['34a'])
  money(v, '1040ME Refund', L['34b'])

  // ── Page 3 ──
  v['1040ME First name last name'] = header(ret)
  v['1040ME Your social security number again'] = ssnFmt(tp.ssn)
  if (L['34b'] > 0) {
    const dep = ret.refundDeposit
    const route = digits(dep.routingNumber)
    const acct = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (route.length === 9 && acct && L['34b'] <= 20000) {
      v['Rounting Number'] = route
      v['Account Number'] = acct.slice(0, 17)
      v[dep.accountType === 'savings' ? 'Savings' : 'Checking'] = true
    }
  }
  money(v, 'Total amount due', L['35'])
  v['1040ME Your occupation'] = upper(d.occupation.taxpayer || tp.occupation).slice(0, 24)
  if (joint) v["1040ME Spouse's occupation"] = upper(d.occupation.spouse || sp.occupation).slice(0, 24)
  if (ret.usePaidPreparer && preparer) {
    v["1040ME Print preparer's name and name of business"] = upper([preparer.name, preparer.firmName].filter((x) => x.trim()).join(', '))
    v["1040ME Preparer's SS# or PTIN"] = preparer.ptin.toUpperCase().slice(0, 11)
    v["1040ME Preparer's phone number"] = preparer.phone.slice(0, 12)
  }
  return { id: 'me1040', file: 'me-1040.pdf', title: 'Maine Form 1040ME', values: v }
}

function formMe1A(ret: TaxReturnInput, me: MeResult): FormFill {
  const A = me.s1a
  const v: Record<string, FieldValue> = { '1040ME1 Names Shown on Form 1040ME': header(ret), '1040ME1 Your Social Security Number': ssnFmt(ret.taxpayer.ssn) }
  money(v, '1040ME1 Income from Municipal and State Bonds, other than Maine', A['1'])
  money(v, '1040ME1 MPERS Contributions', A['3'])
  money(v, 'Other- OBBBA R&E', A['10'])
  money(v, '1040ME1 Total Additions', A['11'], true)
  return { id: 'me1a', file: 'me-1a.pdf', title: 'Maine Schedule 1A', values: v }
}

function formMe1S(ret: TaxReturnInput, me: MeResult): FormFill {
  const S = me.s1s
  const v: Record<string, FieldValue> = { '1040ME1 Names Shown on Form 1040ME': header(ret), '1040ME1 Your Social Security Number': ssnFmt(ret.taxpayer.ssn) }
  money(v, '1040ME1 Subtraction from Federal Adjusted Gross Income', S['1'])
  money(v, '1040ME1 State Income Tax Refund', S['2'])
  money(v, '1040ME1 Social Security and Railroad Retirement Benefits', S['3'])
  money(v, '1040ME1 Pension Income Deduction', S['4'])
  if (me.military) v['1040ME1 Check here if amount includes Military Pay'] = true
  money(v, '1040ME1 MPERS Pick-Up Contributions Paid During 2018', S['7'])
  money(v, '1040ME1 529 Plans', S['8'])
  money(v, 'Interest Maine Municipal', S['18'])
  money(v, 'Other subtractions', S['26'])
  money(v, 'Total subtractions', S['27'], true)
  // Pension income deduction worksheet (page 2).
  if (S['4'] > 0) {
    const cols: [Owner, Record<string, string>, number][] = [
      ['taxpayer', { P1: '1040ME1 Taxpayer Total Non-Military Pension', P3: '1040ME1 Total SS', P4: '1040ME1 Subtract Line 3 from 2', P5: '1040ME1 Enter the Smaller of Line 1 or Line 4', P7: '1040ME1 Phaseout Amount', P8: '1040ME1 Non-military Deduction Amount', P9: '1040ME1 Total Military Retirement Pay', P10: '1040ME1 Add Line 8 and 9' }, 1],
      ['spouse', { P1: '1040ME1 Spouse Total Eligible Non Military Income', P3: '1040ME1 Spouse Total', P4: '1040ME1 Spouse', P5: '1040ME1 Spouse number', P7: '1040ME1 Spouse Phaseout Amount', P8: '1040ME1 Spouse Non-military Deduction Amount', P9: "1040ME1 Spouse's Total Pay", P10: '1040ME1 Spouse Add Line 8 and 9' }, 6]
    ]
    for (const [o, names, dec] of cols) {
      if (o === 'spouse' && ret.filingStatus !== 'mfj') continue
      const P = me.pension[o]
      if (!P || P['P10'] === 0) continue
      for (const k of ['P1', 'P3', 'P4', 'P5', 'P8', 'P9', 'P10']) money(v, names[k], P[k], k === 'P10')
      if (me.pensionRatio > 0) {
        const str = me.pensionRatio.toFixed(4)
        v[`1040ME1 Dec ${dec}`] = str[0]
        for (let i = 0; i < 4; i++) v[`1040ME1 Dec ${dec + 1 + i}`] = str[2 + i]
        money(v, names['P7'], P['P7'])
      }
    }
    if (me.pensionRatio > 0) {
      const fs = ret.filingStatus
      const thr = fs === 'mfs' || fs === 'single' ? 125000 : fs === 'hoh' ? 187500 : 250000
      v['2025 FAGI'] = String(me.lines['14'])
      v['2025 Filing Status'] = String(thr)
      v['2025 FS2'] = String(me.lines['14'] - thr)
      v['PO 3'] = String(fs === 'mfs' ? 50000 : 100000)
      v['1040ME1 Worksheet Phaseout Ratio'] = me.pensionRatio.toFixed(4)
    }
  }
  return { id: 'me1s', file: 'me-1s.pdf', title: 'Maine Schedule 1S', values: v }
}

function formMeSchA(ret: TaxReturnInput, me: MeResult): FormFill {
  const C = me.sa
  const v: Record<string, FieldValue> = { '1040MEA Name(s) as Shown on Form 1040ME': header(ret).slice(0, 30), '1040MEA Your Social Securtiy Number': ssnFmt(ret.taxpayer.ssn) }
  money(v, '1040MEA Refundable Dependent Exemption Tax Credit', C['1'])
  money(v, '1040MEA Child Care Credit', C['2'])
  money(v, '1040MEA Earned Income Credit', C['4'])
  money(v, '1040MEA Other Refundable Tax', C['8'])
  money(v, '1040MEA Total Refundable Credits', C['9'], true)
  money(v, '1040MEA Child Care Credit Total', C['11'])
  money(v, '1040MEA Credit for Income Tax Paid to Other', C['14'])
  money(v, '1040MEA Other Tax Credits', C['20'])
  money(v, '1040MEA Total Nonrefundable Credits', C['21'], true)
  money(v, '1040MEA Maine Income Tax', C['22'], true)
  money(v, '1040MEA Allowable Nonrefundable Credits', C['23'], true)
  return { id: 'mescha', file: 'me-scha.pdf', title: 'Maine Schedule A', values: v }
}

function formMeSch2(ret: TaxReturnInput, me: MeResult): FormFill {
  const s = me.s2 ?? {}
  const v: Record<string, FieldValue> = { '1040ME2 Name': header(ret), '1040ME2 Social Security Number': ssnFmt(ret.taxpayer.ssn) }
  money(v, '1040ME2 Itemized Deductions', s['1'], true)
  money(v, '1040ME2 Taxes Paid', s['2a'])
  money(v, '1040ME2 Medical and Dental Expenses', s['2d'])
  money(v, '1040ME2 Total of line 2a, 2b, 2c, 2d, and 2e', s['2f'], true)
  money(v, '1040ME State and local realestate taxes', s['3b'])
  money(v, '1040ME2 Personal property taxes', s['3c'])
  money(v, '1040ME2 Total of line 3a, 3b, 3c, and 3d', s['3e'], true)
  money(v, '1040ME2 Line 1 minus line 2f plus line 3e', s['4'], true)
  money(v, '1040ME2 Enter Smaller of Line 4 or 5', s['6'], true)
  money(v, '1040ME2 Add line 2d and line 6', s['7'], true)
  return { id: 'mesch2', file: 'me-sch2.pdf', title: 'Maine Schedule 2', values: v }
}

function formMePtfc(ret: TaxReturnInput, me: MeResult): FormFill {
  const P = me.ptfc
  const d = ret.me
  const v: Record<string, FieldValue> = { 'Sched PTFC/STFC Name': header(ret).slice(0, 45), 'Sched PTFC/STFC  ssn': ssnFmt(ret.taxpayer.ssn) }
  const dob = (s: string): string => {
    const m = s.trim().match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/)
    return m ? `${m[1].padStart(2, '0')}    ${m[2].padStart(2, '0')}    ${m[3]}` : s.trim()
  }
  if (d.birthDates.taxpayer.trim()) v['Sched PTFC/STFC dob'] = dob(d.birthDates.taxpayer)
  if (ret.filingStatus === 'mfj' && d.birthDates.spouse.trim()) v['Sched PTFC/STFC spouse dob'] = dob(d.birthDates.spouse)
  if (d.propertyLocation.trim()) v['Sched PTFC/STFC Location of Property'] = upper(d.propertyLocation).slice(0, 30)
  money(v, 'Sched PTFC/STFC 2a', P['2a'], true)
  money(v, 'Sched PTFC/STFC 2b', P['2b'])
  money(v, 'Sched PTFC/STFC 2c', P['2c'])
  money(v, 'Sched PTFC/STFC 2d', P['2d'])
  money(v, 'Sched PTFC/STFC 3', P['3'], true)
  if (P['16'] > 0) {
    money(v, 'Sched PTFC/STFC4', P['4'])
    if (P['5a'] > 0) {
      money(v, 'Sched PTFC STFC 5a', P['5a'])
      v['PTFC/STFC 5b'] = d.rentIncludesUtilities ? '#0' : '#1'
      money(v, 'Sched PTFC/STFC 5c', P['5c'], true)
      money(v, 'Sched PTFC/STFC 5d', P['5d'], true)
      money(v, 'Sched PTFC/STFC 5e', P['5e'], true)
      if (d.landlord.trim()) v['Sched PTFC/STFC 5f'] = upper(d.landlord).slice(0, 35)
    }
    money(v, 'Sched PTFC/STFC 6', P['6'], true)
    v['PTFC/STFC 11'] = P['7'] ? '#0' : '#1'
    money(v, 'Sched PTFC/STFC 9', P['8'], true)
    money(v, 'Sched PTFC/STFC 8', P['9'], true)
    money(v, 'Sched PTFC/STFC 10', P['10'], true)
    v['PTFC/STFC 10a'] = '#0'
    money(v, 'Sched PTFC/STFC 11', P['11'], true)
    money(v, 'Sched PTFC/STFC 12', P['12'], true)
    money(v, 'Sched PTFC/STFC 13', P['13'], true)
    v['PTFC/STFC 9999'] = P['14'] ? '#0' : '#1'
    money(v, 'Sched PTFC/STFC 14a', P['14a'], true)
    money(v, 'Sched PTFC/STFC 15', P['15'], true)
    money(v, 'Sched PTFC/STFC 16', P['16'], true)
  }
  money(v, 'Sched PTFC/STFC 17', P['17'], true)
  return { id: 'meptfc', file: 'me-ptfc.pdf', title: 'Maine Schedule PTFC/STFC', values: v }
}

export function buildMePacket(ret: TaxReturnInput, res: TaxReturnResult, me: MeResult, preparer?: PreparerInfo | null): FormPacket {
  const has = (s: string): boolean => me.attach.includes(s)
  const forms = [formMe1040(ret, me, preparer)]
  if (has('Schedule 1A')) forms.push(formMe1A(ret, me))
  if (has('Schedule 1S')) forms.push(formMe1S(ret, me))
  if (has('Schedule 2')) forms.push(formMeSch2(ret, me))
  if (has('Schedule A')) forms.push(formMeSchA(ret, me))
  if (has('Schedule PTFC/STFC')) forms.push(formMePtfc(ret, me))
  void res
  const notIncluded = me.attach.filter((x) => !['Schedule 1A', 'Schedule 1S', 'Schedule 2', 'Schedule A', 'Schedule PTFC/STFC'].includes(x))
  return { forms, notIncluded }
}
