/**
 * Fills the official 2025 Louisiana IT-540 (IT-540-WEB-BC, public/forms/2025/it540.pdf) from a computed return. The
 * file holds the four return pages, the schedules and the credit worksheets; only the pages that are used are kept.
 * Money boxes are whole dollars (the form prints the cents).
 */
import type { Owner, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { LaResult } from '../engine/la2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement, money0, statementForms } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const money = (n: number | undefined): string => {
  const v = Math.round(n ?? 0)
  return v > 0 ? String(v) : ''
}
const keep0 = (n: number | undefined): string => String(Math.max(0, Math.round(n ?? 0)))
/** MM/DD/YYYY or MMDDYYYY → MMDDYYYY. */
const dob8 = (s: string): string => {
  const x = digits(s)
  return x.length === 8 ? x : ''
}
const splitName = (name: string): [string, string] => {
  const parts = name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts.pop() ?? '' : ''
  return [parts.join(' '), last]
}

const PAGES = { schF: 9, schI: 10, schC: 5, schE: 7, schJ1: 11, schJ2: 12, careRefundable: 13, eic: 14, careNonrefundable: 15 }

export function formIt540(ret: TaxReturnInput, res: TaxReturnResult, la: LaResult, preparer?: PreparerInfo | null): FormFill {
  const L = la.lines
  const d = ret.la
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const v: Record<string, FieldValue> = {}
  const agi = Math.round(res.f1040['11a'])
  const pages = [1, 2, 3, 4]

  // ── Page 1 ──
  v['PRMFN'] = upper(ret.taxpayer.firstName)
  v['PRMLN'] = upper(ret.taxpayer.lastName)
  v['PRMSSN'] = digits(ret.taxpayer.ssn)
  v['LSTNAM'] = upper(ret.taxpayer.lastName).replace(/[^A-Z]/g, '').slice(0, 4)
  if (joint || fs === 'mfs') {
    v['SPOFN'] = upper(ret.spouse.firstName)
    v['SPOLN'] = upper(ret.spouse.lastName)
    v['SPOSSN'] = digits(ret.spouse.ssn)
  }
  v['STADDR'] = upper(c.street)
  if (c.apt.trim()) {
    const m = /^(APT|UNIT|STE|SUITE|FL|RM|#)?\.?\s*(.*)$/i.exec(c.apt.trim())
    v['UT'] = upper(m?.[1] ? (m[1] === '#' ? 'APT' : m[1].toUpperCase() === 'SUITE' ? 'STE' : m[1]) : 'APT')
    v['UN'] = upper(m?.[2] ?? c.apt)
  }
  v['CITY'] = upper(c.city)
  v['STATE'] = upper(c.state).slice(0, 2)
  v['ZIPCD'] = digits(c.zip).slice(0, 9)
  v['PHNNUM'] = digits(c.phone).slice(-10)
  v['YDOB'] = dob8(d.birthDate.taxpayer)
  if (joint) v['SDOB'] = dob8(d.birthDate.spouse)
  v['FILSTA'] = { single: '1', mfj: '2', mfs: '3', hoh: '4', qss: '5' }[fs]
  const is65 = (o: Owner): boolean => (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age65OrOlder || (o === 'taxpayer' ? ret.taxpayer : ret.spouse).age >= 65
  if (is65('taxpayer')) v['EXM65A'] = true
  if (joint && is65('spouse')) v['EXMBA'] = true
  v['EXMT6B'] = String(ret.dependents.length)
  ret.dependents.slice(0, 8).forEach((x, i) => {
    const [first, last] = splitName(x.name)
    v[`FN(6C).${i}`] = upper(first)
    v[`LN(6C).${i}`] = upper(last)
    v[`SSN(6C).${i}`] = digits(x.ssn)
    v[`Relationship(6C).${i}`] = upper(x.relationship)
    const b = d.dependentBirthDates[x.id] ?? ''
    if (dob8(b)) v[`BD(6C).${i}`] = `${dob8(b).slice(0, 2)}/${dob8(b).slice(2, 4)}/${dob8(b).slice(4)}`
  })

  // ── Page 2 ──
  if (la.usesScheduleE) v['SDE'] = true
  v['FEDAGI'] = keep0(L['7'])
  v['LASTDED'] = keep0(L['8'])
  if (L['9A'] > 0) {
    v['FEDITM'] = money(L['9A'])
    v['STDDED'] = keep0(L['9B'])
    v['EXCESS'] = keep0(L['9C'])
    v['FEDTAX'] = keep0(L['9D'])
  }
  v['LATXBL'] = keep0(L['10'])
  v['LATAX'] = keep0(L['11'])
  v['ONRP1CRS'] = money(L['12'])
  v['TLNRP1CRS'] = keep0(L['13'])
  v['RFCCC'] = money(L['14'])
  v['QRFCCC'] = money(L['14A'])
  v['RFCCCW6'] = money(L['14B'])
  v['LAEIC'] = money(L['16'])
  v['INSCRDREDUCED'] = money(L['17'])
  v['ORP2CRS'] = money(L['18'])
  v['TLRFP2CRS'] = keep0(L['19'])
  v['OPARP2C'] = money(L['20'])
  v['NRP3CRS'] = money(L['21'])
  v['ADLATX'] = keep0(L['22'])

  // ── Page 3 ──
  if (L['23A'] > 0) { v['22A_USE_YS'] = true; v['USETAX'] = money(L['23A']) } else v['22A_USE_NO'] = true
  if (L['23B'] > 0) { v['22B_USE_YS'] = true; v['E&HVRUFEE'] = money(L['23B']) } else v['22B_USE_NO'] = true
  v['INUSTX'] = keep0(L['24'])
  v['OPORP2C'] = money(L['25'])
  v['RFP4CRS'] = money(L['26'])
  v['TAXWTH'] = money(L['27'])
  v['AMTFWD'] = money(L['28'])
  v['ESTPAY'] = money(L['29'])
  v['EXTPAY'] = money(L['30'])
  v['TTLCR&PAY'] = keep0(L['31'])
  if (L['32'] > 0) {
    v['OPYMNT'] = money(L['32'])
    v['ADJOPT'] = money(L['34'])
    v['SUBTOT'] = money(L['36'])
    v['CRDFWD'] = money(L['37'])
    v['REFUND'] = money(L['38'])
    if (L['38'] > 0) {
      const dep = ret.refundDeposit
      if (dep.routingNumber && dep.accountNumber) {
        v['REFUNDOPT'] = '3'
        v[dep.accountType === 'savings' ? 'SAVINGS' : 'CHECKING'] = true
        v['BKROUTING'] = digits(dep.routingNumber).slice(0, 9)
        v['BKACCT'] = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
        v['OUTSIDEUS.N'] = true
      } else v['REFUNDOPT'] = '2'
    }
  }

  // ── Page 4 ──
  v['TAXDUE'] = money(L['39'])
  v['TTLDUE'] = money(L['47'])
  if (ret.usePaidPreparer && preparer) {
    v['PreparerName'] = upper(preparer.name)
    v['PAIDPREPID'] = preparer.ptin.toUpperCase()
    v['FIRMNAME'] = upper(preparer.firmName)
    v['FIRMFEIN'] = preparer.firmEin
    v['FIRMADDRS'] = upper(preparer.firmAddress)
    v['PAIDPREPTEL'] = preparer.phone
    if (preparer.selfEmployed) v['PPSELFEMP'] = true
  }
  v['NoBarcode'] = ''

  // ── Schedule C ──
  if (L['12'] > 0) {
    pages.push(PAGES.schC)
    v['SchCTotalTaxOtherState'] = money(L['1A'])
    v['SchCTaxCrOtherState'] = money(L['1B'])
    v['SchCTotalCredits'] = money(L['12'])
  }

  // ── Schedule E ──
  if (la.usesScheduleE) {
    pages.push(PAGES.schE)
    const E = la.schE
    if (E['1'] < 0) v['NEGAGI'] = true
    v['SchEFedAGI'] = String(Math.abs(E['1']))
    v['I&DOtherState'] = money(E['2A'])
    v['SchETtlIncome'] = keep0(E['3'])
    const rows = la.exempt.length > 7 ? [...la.exempt.slice(0, 6), { code: la.exempt[6].code, description: 'Other exempt income (see list)', amount: la.exempt.slice(6).reduce((s, x) => s + x.amount, 0) }] : la.exempt
    const letters = 'ABCDEFG'
    rows.forEach((x, i) => {
      v[`SDED${i + 1}`] = x.description.slice(0, 40)
      v[`SDEC${i + 1}`] = x.code
      v[`SDE4${letters[i]}`] = money(x.amount)
    })
    v['ExIncFedTax'] = keep0(E['4H'])
    v['LaAGI_IRC280C'] = keep0(E['5'])
    const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
    for (const code of ['02E', '03E', '04E', '05E'] as const) for (const o of owners) {
      const when = digits(d.retired[o])
      if (d.exemptRetirement[code][o] > 0 && when.length === 6) v[`${o === 'taxpayer' ? 'TDR' : 'SDR'} (${code})`] = when
    }
    if (la.exempt.some((x) => x.code === '05')) v['PNS (05E)'] = upper(d.otherRetirementSystem)
    if (la.exempt.some((x) => x.code === '06')) v['PNS (06E)'] = upper([...new Set(ret.retirement.filter((x) => owners.includes(x.owner) && x.taxableAmount > 0).map((x) => x.payer.trim()).filter(Boolean))].join(', ')).slice(0, 60)
  }

  // ── Schedule F (line 17) and Schedule I (line 26); the field numbers on Schedule F run one ahead of the line numbers ──
  const code2 = (s: string): string => s.toUpperCase().replace(/F$/, '').replace(/[^0-9A-Z]/g, '').slice(0, 2)
  const fRows = d.schF.filter((x) => x.amount > 0).slice(0, 5)
  const mRows = d.musical.filter((x) => x.amount > 0).slice(0, 3)
  if (L['17'] > 0 && fRows.length + mRows.length > 0) {
    pages.push(PAGES.schF)
    fRows.forEach((x, i) => { v[`SchFDescript${i + 2}`] = upper(x.description).slice(0, 50); v[`SchFCode${i + 2}`] = code2(x.code); v[`SchFCrAmt${i + 2}`] = money(x.amount) })
    if (fRows.some((x) => code2(x.code) === '66')) v['SchFSchReadinessLicenseNo'] = d.schoolReadinessLicense.replace(/[^0-9A-Za-z]/g, '').slice(0, 9)
    mRows.forEach((x, i) => { v[`SchFCrAmt${i + 7}`] = money(x.amount); v[`SchFCertNo${i + 7}A`] = upper(x.cert).replace(/[^0-9A-Z]/g, '').slice(0, 26) })
    v['SchFTotalCredits'] = keep0(L['17'])
  }
  const iRows = d.schI.filter((x) => x.amount > 0).slice(0, 5)
  if (L['26'] > 0 && iRows.length > 0) {
    pages.push(PAGES.schI)
    iRows.forEach((x, i) => { v[`SchIDescript${i + 1}`] = upper(x.description).slice(0, 50); v[`SchICode${i + 1}`] = code2(x.code); v[`SchICrAmt${i + 1}`] = money(x.amount) })
    v['SchITotalCredits'] = keep0(L['26'])
  }

  // ── Schedule J and the nonrefundable child care credit worksheet ──
  const J = la.schJ
  if (J['16'] > 0 || J['1'] > 0 && agi > 25000) {
    pages.push(PAGES.schJ1, PAGES.schJ2)
    v['FEDCCC'] = money(J['1'])
    v['NRCCC'] = keep0(J['2'])
    v['CCCFWD'] = money(J['3'])
    if (J['6'] > 0) {
      v['SchJDescript6'] = upper(d.otherCredit.description).slice(0, 40)
      v['SchJCode6'] = digits(d.otherCredit.code).slice(0, 3)
      v['SchJCrAmt6'] = money(J['6'])
    }
    v['SchJTotalCredits'] = keep0(J['16'])
  }
  if (J['1'] > 0 && agi > 25000) {
    pages.push(PAGES.careNonrefundable)
    const pct = agi <= 35000 ? 30 : 10
    v['WS.A.1'] = money(J['1'])
    v['WS.A.1A'] = String(pct)
    v['WS2'] = keep0(Math.round(J['1'] * pct / 100))
    if (agi > 60000) v['WS.A.2A'] = keep0(J['available'])
    const line3 = L['19']
    v['WS.A.3'] = keep0(line3)
    if (line3 > 0) {
      const cf = Math.round(Math.max(0, d.childCareCarryforward))
      const line7 = line3 - cf
      v['WS.A.5'] = keep0(line3)
      v['WS.A.6'] = keep0(cf)
      v['WS.A.7'] = String(line7)
      if (line7 <= 0) v['WS.A.8'] = keep0(cf - line3)
      else {
        v['WS.A.10'] = String(line7)
        v['WS.A.11'] = keep0(J['available'])
        v['WS.A.12'] = String(line7 - J['available'])
        if (line7 - J['available'] < 0) v['WS.A.15'] = keep0(J['available'] - line7)
      }
    }
  }

  // ── Refundable child care credit worksheet ──
  if (L['14'] > 0) {
    pages.push(PAGES.careRefundable)
    v['Your Name'] = upper(`${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)
    ret.dependentCare.providers.slice(0, 5).forEach((p, i) => {
      v[`Care providers nameRow${i + 1}`] = upper(p.name)
      v[`Address number street apartment number city state and ZIPRow${i + 1}`] = upper(p.address)
      v[`Identifying number SSN or EINRow${i + 1}`] = digits(p.tin)
      v[`Amount paid See instructionsRow${i + 1}`] = money(p.amountPaid)
    })
    const kids = ret.dependents.filter((x) => x.age < 13).slice(0, 5)
    const each = kids.length ? Math.min(3000, Math.floor(la.care.line3 / kids.length)) : 0
    kids.forEach((x, i) => {
      const [first, last] = splitName(x.name)
      v[`Qualifying persons name First LastRow${i + 1}`] = upper(first)
      v[`Qualifying persons name First LastRow${i + 1}_2`] = upper(last)
      v[`Qualifying persons Social Security NumberRow${i + 1}`] = digits(x.ssn)
      v[`Qualified expenses you incurred and paid in 2012 for the person listed in column ERow${i + 1}`] = money(i === kids.length - 1 ? la.care.line3 - each * (kids.length - 1) : each)
    })
    const earned = (o: Owner): number => Math.max(0, Math.round(ret.w2s.filter((w) => w.owner === o).reduce((s, w) => s + w.wages, 0)
      + res.scheduleC.filter((x) => x.owner === o).reduce((s, x) => s + x.netProfit, 0) - res.scheduleSE.filter((x) => x.owner === o).reduce((s, x) => s + x.total / 2, 0)))
    v['3'] = keep0(la.care.line3)
    v['4'] = keep0(earned('taxpayer'))
    v['5'] = keep0(joint ? earned('spouse') : earned('taxpayer'))
    v['6'] = keep0(la.care.line6)
    v['7_2'] = keep0(agi)
    v['8'] = String(Math.round(la.care.rate * 100))
    v['X 9'] = keep0(la.care.line9)
    v['X 5011'] = keep0(L['14'])
  }

  // ── Earned income credit worksheet ──
  if (L['16'] > 0) {
    pages.push(PAGES.eic)
    v['1_4'] = keep0(res.f1040['27a'])
    v['3_2'] = keep0(L['16'])
  }

  return { id: 'it540', file: 'it540.pdf', title: 'Louisiana Form IT-540', values: v, pages: [...new Set(pages)].sort((a, b) => a - b) }
}

export function buildLaPacket(ret: TaxReturnInput, res: TaxReturnResult, la: LaResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formIt540(ret, res, la, preparer)]
  const notIncluded = [...la.attach]
  if (ret.dependents.some((x) => !(ret.la.dependentBirthDates[x.id] ?? '').replace(/\D/g, ''))) notIncluded.push('Page 1: dependents’ dates of birth that were not entered')
  if (la.lines['17'] > 0 && !ret.la.schF.some((x) => x.amount > 0) && !ret.la.musical.some((x) => x.amount > 0)) notIncluded.push('Schedule F: list each credit in the Louisiana section to fill it in (only the line 17 total is entered)')
  if (la.lines['26'] > 0 && !ret.la.schI.some((x) => x.amount > 0)) notIncluded.push('Schedule I: list each credit in the Louisiana section to fill it in (only the line 26 total is entered)')
  if (la.lines['14'] > 0) notIncluded.push('Refundable child care worksheet: check the expenses split between children in column H')
  forms.push(...dependentsStatement(ret, 8, 'IT-540, Dependents (continued)', 'st-la-deps'))
  if (la.usesScheduleE && la.exempt.length > 7) {
    const rest = la.exempt.slice(6)
    forms.push(...statementForms(ret, {
      id: 'st-la-sche', attachTo: 'Schedule E, line 4G (continued)', title: 'Exempt income combined on line 4G',
      columns: [{ label: 'Code', width: 50 }, { label: 'Description', width: 340 }, { label: 'Amount', width: 110, right: true }],
      rows: rest.map((x) => [x.code, x.description, money0(x.amount)]),
      total: ['Total (line 4G)', '', money0(rest.reduce((s, x) => s + x.amount, 0))]
    }))
  }
  return { forms, notIncluded }
}
