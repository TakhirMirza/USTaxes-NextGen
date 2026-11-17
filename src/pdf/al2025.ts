/**
 * Fills the official 2025 Alabama Form 40 (public/forms/2025/al40.pdf: Form 40 pages 1–2, Schedules A, B & DC,
 * DS & HOF, W-2, RS, D & E and the vehicle loan interest worksheet, taken from the ADOR 2025 Form 40 file with its
 * warning overlays and scripts removed). Only the pages that are used are kept. Whole dollars.
 */
import type { Owner, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { AlResult, AlRetirementRow } from '../engine/al2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const money = (n: number | undefined): string => {
  const v = Math.round(n ?? 0)
  return v === 0 ? '' : String(v)
}
const keep0 = (n: number | undefined): string => String(Math.round(n ?? 0))
const date = (s: string): string => {
  const x = digits(s)
  return x.length === 8 ? `${x.slice(0, 2)}/${x.slice(2, 4)}/${x.slice(4)}` : ''
}
const splitName = (name: string): [string, string] => {
  const parts = name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts.pop() ?? '' : ''
  return [parts.join(' '), last]
}
const PAGES = { schA: 2, schB: 3, ds: 4, hof: 5, w2: 6, rs1: 7, rs2: 8 }

export function formAl40(ret: TaxReturnInput, res: TaxReturnResult, al: AlResult, preparer?: PreparerInfo | null): FormFill {
  const L = al.lines
  const d = ret.al
  const c = ret.contact
  const joint = al.status === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const v: Record<string, FieldValue> = {}
  const pages = [0, 1]
  const names = upper([ret.taxpayer.firstName, ret.taxpayer.lastName].join(' ') + (joint ? ` & ${ret.spouse.firstName} ${ret.spouse.lastName}` : ''))

  // ── Page 1 ──
  v['SSSN'] = digits(ret.taxpayer.ssn)
  v['FIRSTNAME'] = upper(ret.taxpayer.firstName)
  v['LASTNAME'] = upper(ret.taxpayer.lastName)
  if (joint) {
    v['SPSSN'] = digits(ret.spouse.ssn)
    v['SPOUSEFIRSTNAME'] = upper(ret.spouse.firstName)
    v['SPOUSELASTNAME'] = upper(ret.spouse.lastName)
  }
  if (al.status === 'mfs') v['SPQUSSN'] = digits(ret.spouse.ssn)
  v['ADDRESS'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['CITY'] = upper(c.city)
  v['STATE'] = upper(c.state).slice(0, 2)
  v['ZIP'] = digits(c.zip).slice(0, 9)
  v[{ single: 'S', mfj: 'MFJ', mfs: 'MFS', hof: 'HOF' }[al.status]] = true
  v['ALTXWH'] = money(L['5a'])
  v['WAGESINC'] = money(L['5b'])
  v['INTDIVINC'] = money(L['6'])
  v['TOTOTHERINC'] = money(L['7'])
  v['TOTALINC'] = keep0(L['8'])
  v['TOTADJINC'] = money(L['9'])
  v['ADJGRSINC'] = keep0(L['10'])
  v[al.itemize ? 'CHKITMDED' : 'CHKSTDDED'] = true
  v['ITMSTDDED'] = keep0(L['11'])
  v['FEDTXLIABDED'] = money(L['12'])
  v['PERSEXEMP'] = keep0(L['13'])
  v['DEPEXMPTION'] = money(L['14'])
  v['TOTDED'] = keep0(L['15'])
  v['TAXINC'] = keep0(L['16'])
  v['TAXDUE'] = keep0(L['17'])
  if (L['18'] !== L['17']) v['CHKOC'] = true
  v['NETTAXDUE'] = keep0(L['18'])
  v['ADDTAX'] = money(L['19'])
  v['TOTTAXLIB'] = keep0(L['21'])
  v['TOTALWH'] = money(L['22'])
  v['ESTMEXTSIONPMT'] = money(L['23'])
  v['REFUNDABLERC'] = money(L['25'])
  v['TOTPMT'] = keep0(L['27'])
  v['ADJUSTEDTOTALPAYMENTS'] = keep0(L['29'])
  v['AMTOWE'] = money(L['30'])
  v['OVERPAID'] = money(L['32'])
  v['PG1LINE33'] = money(L['33'])
  v['REFTOYOU'] = money(L['35'])

  // ── Page 2 ──
  const P1 = al.partI
  v['BUSINC'] = money(P1['2'])
  v['SCHEDULEDTOT'] = money(P1['3'])
  v['TAXIRADIST'] = money(P1['4'])
  v['TOTSCHE'] = money(P1['5'])
  v['OTHERINCOME'] = money(P1['7'])
  if (P1['7']) v['OTHERINCEXP#1'] = 'OTHER INCOME (FEDERAL SCHEDULE 1)'
  v['TOTOTHERINCPG2'] = money(P1['8'])
  const P2 = al.partII
  const adjFields: [string, string][] = [['1a', 'IRADED'], ['1b', 'SPIRADED'], ['7', 'SELFEMPHLTDED'], ['8', 'PACTPROGRAM'], ['9', 'HEALTHINSURANCE'], ['10', 'HOMEUPGRADECOST'],
    ['11', 'CATASTROPHESAVING'], ['12', 'CONHEALTHACCT'], ['13', 'HOMEBUYERSAVING'], ['14', 'FIREFIGHTERINS'], ['15', 'ABLESAVING'], ['16', 'TOTADJINCPG2']]
  for (const [k, name] of adjFields) v[name] = money(P2[k])
  if (ret.dependents.length) {
    v['TOTALDS'] = String(ret.dependents.length)
    v['TOTDEPAMT'] = money(L['14'])
  }
  v['CHKFULLYRRES'] = true
  v['FEDAGI'] = keep0(res.f1040['11a'])
  v['FEDTXINC'] = keep0(res.f1040['15'])
  const notReported = Math.round(res.f1040['6b'] + res.schedule1.unemployment + al.rsExempt.reduce((s, x) => s + x.taxable, 0))
  v[notReported > 0 ? 'CHKYESFEDINCNOAL' : 'CHKFEDNOALNO'] = true
  if (notReported > 0) {
    const items: [string, number][] = [['SOCIAL SECURITY', Math.round(res.f1040['6b'])], ['EXEMPT RETIREMENT', al.rsExempt.reduce((s, x) => s + x.taxable, 0)], ['UNEMPLOYMENT', Math.round(res.schedule1.unemployment)]]
    items.filter(([, n]) => n > 0).slice(0, 2).forEach(([what, n], i) => {
      v[`NONTAXINC#${i + 1}`] = what
      v[i === 0 ? 'AMTNONTXINC1' : 'AMTNONTAXINC2'] = money(n)
    })
  }
  if (L['35'] > 0) {
    const dep = ret.refundDeposit
    if (dep.routingNumber && dep.accountNumber) {
      v['CHKDIRECTDEPOSIT'] = true
      v['RouteNumber'] = digits(dep.routingNumber).slice(0, 9)
      v['AccNumber'] = dep.accountNumber.replace(/[^0-9A-Za-z]/g, '').slice(0, 17)
      v[dep.accountType === 'savings' ? 'DIRECTDEPSAVINGS' : 'DIRECTDEPCHECK'] = true
      v['CHKNOOUTSIDE'] = true
    }
  }
  const lic = (o: Owner, suffix: string, short: string): void => {
    const x = d.license[o]
    v[`DOB${suffix}`] = date(d.birthDate[o])
    if (x.number.trim()) {
      v[`DLState${suffix}`] = upper(x.state).slice(0, 2)
      v[`DLNumber${suffix}`] = upper(x.number).slice(0, 11)
      v[`IssDate${suffix}`] = date(x.issued)
      v[`ExpDate${suffix}`] = date(x.expires)
    } else v[short] = true
  }
  lic('taxpayer', '', 'NDL')
  if (joint) lic('spouse', 'Sp', 'SPNDL')
  const phone = digits(c.phone).slice(-10)
  if (phone.length === 10) { v['PHONENUMBER'] = phone.slice(0, 3); v['PHONENUMBERb'] = `${phone.slice(3, 6)}-${phone.slice(6)}` }
  if (ret.usePaidPreparer && preparer) {
    v['PREPSSN'] = preparer.ptin.toUpperCase().slice(0, 9)
    v['PREPEIN'] = digits(preparer.firmEin).slice(0, 9)
    v['PREPFIRMNAME'] = upper(preparer.firmName || preparer.name)
    v['PREPADDRESS'] = upper(preparer.firmAddress)
    if (preparer.selfEmployed) v['CHKPREPSELFEMP'] = true
  }

  // ── Schedule A ──
  if (al.itemize) {
    pages.push(PAGES.schA)
    const A = al.schA
    v['SCHANAME'] = names
    v['SCHASSN'] = digits(ret.taxpayer.ssn)
    const aFields: [string, string][] = [['1', 'TOTMEDEXP'], ['3', 'MEDEXPLIMIT'], ['4', 'ALLMEDEXP'], ['5', 'REALESTATETAXES'], ['6', 'FICA'], ['8', 'OTHERTAXES'], ['9', 'TOTALTAXES'],
      ['10a', '1098MTGINT'], ['14', 'TOTALINTEREST'], ['15', 'CASHCONTRIBUTIONS'], ['16', 'OTHERCONTRIBUTIONS'], ['18', 'TOTALCONTRIBUTIONS'], ['25', 'OTHERMISCDEDUCTIONS'], ['27', 'TOTALITZDED']]
    for (const [k, name] of aFields) v[name] = money(A[k])
    if (A['8']) v['OTHTAXDESC1'] = 'PERSONAL PROPERTY TAX'
    if (A['25']) v['OTHMISCDEDEXP1'] = 'OTHER (FEDERAL SCHEDULE A LINE 16)'
    if (A['11a'] > 0) {
      v['VEHICLEDate'] = date(d.vehiclePurchaseDate)
      v['VEHICLEVIN1'] = upper(ret.schedule1A.vehicleVin).slice(0, 17)
      v['VEHICLEVINAMT1'] = money(A['11a'])
      v['VEHICLEVIN'] = keep0(A['11c'])
    }
  }

  // ── Schedule B ──
  const intTotal = al.interestRows.reduce((s, x) => s + x.exempt + x.taxable, 0) + al.dividendRows.reduce((s, x) => s + x.amount, 0)
  if (intTotal > 1500) {
    pages.push(PAGES.schB)
    v['NAME2A'] = names
    v['SSSNB2A'] = digits(ret.taxpayer.ssn)
    al.interestRows.slice(0, 9).forEach((x, i) => {
      v[`INTPAYER#${i + 1}`] = upper(x.payer)
      v[`EXMPINT#${i + 1}`] = money(x.exempt)
      v[`TAXINT#${i + 1}`] = money(x.taxable)
    })
    al.dividendRows.slice(0, 9).forEach((x, i) => {
      v[`DIVPAYER#${i + 1}`] = upper(x.payer)
      v[`TAXDIV#${i + 1}`] = money(x.amount)
    })
    v['TOTALINTDIV'] = keep0(L['6'])
  }

  // ── Schedules DS and HOF ──
  if (ret.dependents.length) {
    pages.push(PAGES.ds)
    v['SCHDSNAME'] = names
    v['SCHDSSSN'] = digits(ret.taxpayer.ssn)
    if (joint) v['SCHDSSPSSN'] = digits(ret.spouse.ssn)
    const sp = (n: number): string => (n === 1 || n === 3 || n === 5 || n === 7 || n === 9 || n === 11 ? ' ' : '')
    ret.dependents.slice(0, 12).forEach((x, i) => {
      const n = i + 1
      const [first, last] = splitName(x.name)
      v[`DEP${n}FIRST${sp(n)}NAME`] = upper(first)
      v[`DEP${n}LAST${n === 1 || n === 5 || n === 9 ? ' ' : ''}NAME`] = upper(last)
      v[`DEP${n}SSN`] = digits(x.ssn)
      v[`DEP${n}REL`] = upper(x.relationship)
      v[`DEP${n}SUPPORT`] = 'YES'
    })
    v['NOOFDEP'] = String(ret.dependents.length)
  }
  if (al.status === 'hof' && ret.dependents.length) {
    pages.push(PAGES.hof)
    const q = ret.dependents[0]
    v['SCHHOFNAME'] = names
    v['SCHHOFSSN'] = digits(ret.taxpayer.ssn)
    v['SCHJHOFDEPNAME'] = upper(q.name)
    v['SCHHOFDEPSSN'] = digits(q.ssn)
    v['SCHHOFDEPRE'] = upper(q.relationship)
    v['CHKHOFY2'] = true
    v['CHKHOFY3'] = true
  }

  // ── Schedule W-2 ──
  if (al.statements.length || L['22'] > 0) {
    pages.push(PAGES.w2)
    v['SCHW2NAME'] = names
    v['SCHW2SSN'] = digits(ret.taxpayer.ssn)
    if (joint) v['SCHW2SPSSN'] = digits(ret.spouse.ssn)
    al.statements.slice(0, 15).forEach((x, i) => {
      const n = i + 1
      v[`SCHW2ALN${n}`] = digits(x.ssn)
      v[`SCHW2BLN${n}`] = digits(x.ein)
      v[`SCHW2E${n}`] = 'AL'
      v[`SCHW2FLN${n}`] = digits(x.stateId).slice(0, 10)
      v[`SCHW2GLN${n}`] = keep0(x.tax)
      v[`SCHW2HLN${n}`] = keep0(x.federal)
      v[`SCHW2ILN${n}`] = keep0(x.state)
    })
    const w2Tax = al.statements.reduce((s, x) => s + x.tax, 0)
    v['SCHW2LN16'] = keep0(w2Tax)
    v['SCHW2LN17'] = money(L['22'] - w2Tax)
    v['SCHW2TOTALG'] = keep0(L['22'])
    v['SCHW2TOTALH'] = keep0(al.statements.reduce((s, x) => s + x.federal, 0))
    v['SCHW2TOTALI'] = keep0(L['5b'])
  }

  // ── Schedule RS ──
  if (al.rsExempt.length || al.rsTaxable.taxpayer.length || al.rsTaxable.spouse.length) {
    pages.push(PAGES.rs1, PAGES.rs2)
    v['SCHRSNAME'] = names
    v['SCHRSSSN'] = digits(ret.taxpayer.ssn)
    if (joint) v['SCHRSSPSSN'] = digits(ret.spouse.ssn)
    const row = (prefix: string, colI: string, x: AlRetirementRow, n: number, last: string): void => {
      v[`${prefix}ALN${n}`] = digits(x.fein)
      if (x.ira) v[`${prefix}B${n}`] = true
      v[`${prefix}C${n}`] = upper(x.code).slice(0, 2)
      v[`${prefix}ELN${n}`] = keep0(x.gross)
      if (x.stateTax) { v[`${prefix}F${n}`] = 'AL'; v[`${prefix}GLN${n}`] = digits(x.stateId).slice(0, 10) }
      v[`${prefix}HLN${n}`] = money(x.stateTax)
      v[`${colI}LN${n}`] = last
    }
    al.rsExempt.slice(0, 7).forEach((x, i) => row('SCHRS', 'SCHRSI', x, i + 1, upper(x.reason || 'DEFINED BENEFIT PLAN').slice(0, 30)))
    v['SCHRSLN8'] = money(al.rsExempt.reduce((s, x) => s + x.stateTax, 0))
    al.rsTaxable.taxpayer.slice(0, 7).forEach((x, i) => row('SCHRSPTII', 'SCHRSPTIII', x, i + 1, keep0(x.taxable)))
    const rsT = al.rs.taxpayer
    if (al.rsTaxable.taxpayer.length) {
      v['SCHRSPTIILN8'] = money(rsT.withheld)
      v['SCHRSPTIILN9'] = keep0(rsT.taxable)
      v[rsT.exclusion > 0 ? 'SCHRSYES' : 'SCHRSNO'] = true
      v['SCHRSPTIILN10'] = money(rsT.exclusion)
      v['SCHRSPTIILN11'] = keep0(rsT.net)
    }
    if (joint && al.rsTaxable.spouse.length) {
      const rsS = al.rs.spouse
      al.rsTaxable.spouse.slice(0, 7).forEach((x, i) => row('SCHRSPTIII', 'SCHRSPTIIII', x, i + 1, keep0(x.taxable)))
      v['SCHRSPTIIILN8'] = money(rsS.withheld)
      v['SCHRSPTIIILN9'] = keep0(rsS.taxable)
      v[rsS.exclusion > 0 ? 'SCHRSYES2' : 'SCHRSNO2'] = true
      v['SCHRSPTIIILN10'] = money(rsS.exclusion)
      v['SCHRSPTIIILN11'] = keep0(rsS.net)
    }
    v['SCHRSPTIVLN1'] = keep0(rsT.net)
    v['SCHRSPTIVLN2'] = joint ? keep0(al.rs.spouse.net) : ''
    v['SCHRSPTIVLN3'] = keep0(al.partI['4'])
    const exW = al.rsExempt.reduce((s, x) => s + x.stateTax, 0)
    v['SCHRSPTVLN1'] = money(exW)
    v['SCHRSPTVLN2'] = money(rsT.withheld)
    v['SCHRSPTVLN3'] = joint ? money(al.rs.spouse.withheld) : ''
    v['SCHRSPTVLN4'] = money(exW + rsT.withheld + (joint ? al.rs.spouse.withheld : 0))
  }
  void owners
  return { id: 'al40', file: 'al40.pdf', title: 'Alabama Form 40', values: v, pages: [...new Set(pages)].sort((a, b) => a - b) }
}

export function buildAlPacket(ret: TaxReturnInput, res: TaxReturnResult, al: AlResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formAl40(ret, res, al, preparer)]
  const notIncluded = [...al.attach]
  if (al.status === 'hof') notIncluded.push('Schedule HOF: answer whether you rent or own the home and the marriage question')
  if (ret.dependents.length > 12) notIncluded.push('Schedule DS: dependents after the twelfth on an attached list')
  if (al.statements.length > 15) notIncluded.push('Schedule W-2: W-2s after the fifteenth on another Schedule W-2')
  if (al.interestRows.length > 9 || al.dividendRows.length > 9) notIncluded.push('Schedule B: payers after the ninth on an attached list')
  if (al.lines['12'] > 0) notIncluded.push('Keep the Federal Income Tax Deduction Worksheet (Form 40 instructions) with your records')
  return { forms, notIncluded }
}
