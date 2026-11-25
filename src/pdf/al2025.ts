/**
 * Fills the official 2025 Alabama Form 40 (public/forms/2025/al40.pdf: Form 40 pages 1–2, Schedules A, B & DC,
 * DS & HOF, W-2, RS, D & E and the vehicle loan interest worksheet, taken from the ADOR 2025 Form 40 file with its
 * warning overlays and scripts removed). Only the pages that are used are kept. Whole dollars.
 */
import type { Owner, TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { AlResult, AlRetirementRow } from '../engine/al2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { dependentsStatement, money0, statementForms } from './statement.ts'

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

type Draw = NonNullable<FormFill['draw']>[number]
/** Schedules D & E have no form fields; `base` is the baseline measured from the top of the page. */
const sd = (page: number, x: number, base: number, text: string, o: { right?: boolean; size?: number } = {}): Draw => ({ page, x, y: 792 - base, text, right: o.right, size: o.size ?? 9 })
const amt = (n: number): string => (n < 0 ? `(${Math.abs(Math.round(n))})` : String(Math.round(n)))
const shortDate = (s: string): string => {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3].slice(-2)}` : upper(s).slice(0, 9)
}

/** Schedules D and E (Form 40), front and back. */
export function formAlSchDE(ret: TaxReturnInput, al: AlResult): FormFill | null {
  const hasD = al.schD.length > 0
  const hasE = al.schE.properties.length + al.schE.entities.length > 0
  if (!hasD && !hasE) return null
  const draw: Draw[] = []
  const joint = ret.filingStatus === 'mfj'
  const name = upper(joint ? `${ret.taxpayer.firstName} & ${ret.spouse.firstName} ${ret.taxpayer.lastName}` : `${ret.taxpayer.firstName} ${ret.taxpayer.lastName}`)
  const ssn = digits(ret.taxpayer.ssn).replace(/^(\d{3})(\d{2})(\d{4})$/, '$1-$2-$3')
  const pages: number[] = []
  if (hasD) {
    pages.push(0)
    draw.push(sd(0, 27, 108, name), sd(0, 540, 108, ssn))
    const rows = al.schD.length > 20 ? [...al.schD.slice(0, 19), { kind: `Others (${al.schD.length - 19}) — see attached statement`, acquired: '', sold: '', received: 0, depreciation: 0, basis: 0, improvements: 0, net: al.schD.slice(19).reduce((s, x) => s + x.net, 0) }] : al.schD
    rows.forEach((x, i) => {
      const base = 197 + i * 24
      draw.push(sd(0, 27, base, x.kind.slice(0, 38), { size: 7 }))
      if (x.acquired) draw.push(sd(0, 182, base, shortDate(x.acquired), { size: 6 }))
      if (x.sold) draw.push(sd(0, 218, base, shortDate(x.sold), { size: 6 }))
      if (x.received) draw.push(sd(0, 309, base, amt(x.received), { right: true, size: 8 }))
      if (x.depreciation) draw.push(sd(0, 369, base, amt(x.depreciation), { right: true, size: 8 }))
      if (x.basis) draw.push(sd(0, 429, base, amt(x.basis), { right: true, size: 8 }))
      if (x.improvements) draw.push(sd(0, 489, base, amt(x.improvements), { right: true, size: 8 }))
      draw.push(sd(0, 566, base, amt(x.net), { right: true, size: 8 }))
    })
    draw.push(sd(0, 566, 701, amt(al.partI['3']), { right: true }))
  }
  if (hasE) {
    pages.push(1)
    draw.push(sd(1, 27, 108, name), sd(1, 535, 108, ssn))
    const props = al.schE.properties.slice(0, 3)
    const colX = [300, 384, 468]
    props.forEach((p, i) => {
      const base = 157 + i * 24
      draw.push(sd(1, 40, base, upper(p.description).slice(0, 80), { size: 8 }))
      draw.push(sd(1, p.personalUse ? 557 : 577, base, 'X'))
    })
    const lineY: Record<string, number> = { '3': 252, '4': 264, '5': 288, '6': 300, '7': 312, '8': 324, '9': 336, '10': 348, '11': 360, '12': 372, '13': 384, '14': 396, '15': 408, '16': 420, '17': 432, '18': 444, '19': 504, '20': 516, '21': 528, '22': 552 }
    for (const [k, y] of Object.entries(lineY)) {
      props.forEach((p, i) => { if (p.lines[k] || ['19', '21', '22'].includes(k)) draw.push(sd(1, colX[i], y, amt(p.lines[k]), { right: true, size: 8 })) })
      if (['3', '4', '12', '19', '20'].includes(k)) {
        const total = props.reduce((s, p) => s + p.lines[k], 0)
        if (total || k === '3') draw.push(sd(1, 566, y, amt(total), { right: true, size: 8 }))
      }
    }
    if (props.some((p) => p.lines['18'])) draw.push(sd(1, 100, 444, 'OTHER EXPENSES', { size: 7 }))
    draw.push(sd(1, 566, 576, amt(al.schE.line23), { right: true }))
    al.schE.entities.slice(0, 4).forEach((e, i) => {
      const base = 635 + i * 24
      draw.push(sd(1, 30, base - 12, upper(e.name).slice(0, 60), { size: 8 }))
      draw.push(sd(1, e.kind === 'partnership' ? 373 : 407, base, 'X'))
      draw.push(sd(1, 428, base, e.ein.trim(), { size: 8 }))
      draw.push(sd(1, 566, base, amt(e.amount), { right: true, size: 8 }))
    })
    draw.push(sd(1, 566, 731, amt(al.schE.line24), { right: true }), sd(1, 566, 755, amt(al.schE.line25), { right: true }))
  }
  return { id: 'alschde', file: 'al-schde.pdf', title: 'Alabama Schedules D and E', values: {}, draw, pages }
}

export function buildAlPacket(ret: TaxReturnInput, res: TaxReturnResult, al: AlResult, preparer?: PreparerInfo | null): FormPacket {
  const forms: FormFill[] = [formAl40(ret, res, al, preparer)]
  const de = formAlSchDE(ret, al)
  if (de) forms.push(de)
  const notIncluded = [...al.attach]
  if (al.status === 'hof') notIncluded.push('Schedule HOF: answer whether you rent or own the home and the marriage question')
  if (al.lines['12'] > 0) notIncluded.push('Keep the Federal Income Tax Deduction Worksheet (Form 40 instructions) with your records')
  forms.push(...dependentsStatement(ret, 12, 'Schedule DS (continued)', 'st-al-deps'))
  forms.push(...alStatements(ret, al))
  return { forms, notIncluded }
}

/** Supporting statements for the rows that do not fit on the Alabama schedules. */
function alStatements(ret: TaxReturnInput, al: AlResult): FormFill[] {
  const out: FormFill[] = []
  const w2 = al.statements.slice(15)
  if (w2.length) {
    out.push(...statementForms(ret, {
      id: 'st-al-w2', attachTo: 'Schedule W-2 (continued)', title: 'Alabama withholding statements after the fifteenth',
      columns: [{ label: 'Employee SSN', width: 70 }, { label: 'Employer / payer', width: 130 }, { label: 'EIN', width: 62 }, { label: 'Alabama ID', width: 64 },
        { label: 'AL tax withheld', width: 68, right: true }, { label: 'Federal wages', width: 68, right: true }, { label: 'State wages', width: 70, right: true }],
      rows: w2.map((x) => [x.ssn, x.employer, x.ein, x.stateId, money0(x.tax), money0(x.federal), money0(x.state)]),
      total: ['Total', '', '', '', money0(w2.reduce((s, x) => s + x.tax, 0)), money0(w2.reduce((s, x) => s + x.federal, 0)), ''],
      note: 'These amounts are included in the Schedule W-2 total and Form 40 line 22.',
    }))
  }
  const ints = al.interestRows.slice(9)
  const divs = al.dividendRows.slice(9)
  if (ints.length || divs.length) {
    out.push(...statementForms(ret, {
      id: 'st-al-schb', attachTo: 'Schedule B (continued)', title: 'Interest and dividend payers after the ninth',
      columns: [{ label: 'Kind', width: 70 }, { label: 'Payer', width: 250 }, { label: 'Exempt interest', width: 100, right: true }, { label: 'Taxable amount', width: 100, right: true }],
      rows: [...ints.map((x) => ['Interest', x.payer, money0(x.exempt), money0(x.taxable)]), ...divs.map((x) => ['Dividends', x.payer, '', money0(x.amount)])],
      total: ['Total', '', money0(ints.reduce((s, x) => s + x.exempt, 0)), money0(ints.reduce((s, x) => s + x.taxable, 0) + divs.reduce((s, x) => s + x.amount, 0))],
      note: 'These payers are included in the Schedule B totals.',
    }))
  }
  if (al.schD.length > 20) {
    const rest = al.schD.slice(19)
    out.push(...statementForms(ret, {
      id: 'st-al-schd', attachTo: 'Schedule D, line 1 (continued)', title: 'Sales and exchanges after the nineteenth',
      columns: [{ label: 'Kind of property', width: 140 }, { label: 'Acquired', width: 52 }, { label: 'Sold', width: 52 }, { label: 'Sale price', width: 60, right: true },
        { label: 'Depreciation', width: 58, right: true }, { label: 'Basis', width: 56, right: true }, { label: 'Improvements', width: 54, right: true }, { label: 'Gain or loss', width: 60, right: true }],
      rows: rest.map((x) => [x.kind, x.acquired, x.sold, money0(x.received), money0(x.depreciation), money0(x.basis), money0(x.improvements), money0(x.net)]),
      total: ['Total (Schedule D line 1, last row)', '', '', '', '', '', '', money0(rest.reduce((s, x) => s + x.net, 0))],
    }))
  }
  const props = al.schE.properties.slice(3)
  if (props.length) {
    out.push(...statementForms(ret, {
      id: 'st-al-sche1', attachTo: 'Schedule E, Part I (continued)', title: 'Rental properties after the third',
      columns: [{ label: 'Property', width: 200 }, { label: 'Rents (line 3)', width: 80, right: true }, { label: 'Royalties (4)', width: 70, right: true },
        { label: 'Depreciation (20)', width: 80, right: true }, { label: 'Income or loss (22)', width: 90, right: true }],
      rows: props.map((p) => [p.description, money0((p.lines['3'] ?? 0)), money0((p.lines['4'] ?? 0)), money0((p.lines['20'] ?? 0)), money0((p.lines['22'] ?? 0))]),
      total: ['Total', money0(props.reduce((s, p) => s + (p.lines['3'] ?? 0), 0)), money0(props.reduce((s, p) => s + (p.lines['4'] ?? 0), 0)), money0(props.reduce((s, p) => s + (p.lines['20'] ?? 0), 0)), money0(props.reduce((s, p) => s + (p.lines['22'] ?? 0), 0))],
      note: 'Line 23 of Schedule E includes these properties; lines 3, 4, 12, 19 and 20 in the Totals column show the first three only.',
    }))
  }
  const ents = al.schE.entities.slice(4)
  if (ents.length) {
    out.push(...statementForms(ret, {
      id: 'st-al-sche2', attachTo: 'Schedule E, Part II (continued)', title: 'Pass-through entities after the fourth',
      columns: [{ label: 'Name', width: 240 }, { label: 'Type', width: 80 }, { label: 'EIN', width: 90 }, { label: 'Income or loss', width: 100, right: true }],
      rows: ents.map((e) => [e.name, e.kind === 'partnership' ? 'Partnership' : 'S corporation', e.ein, money0(e.amount)]),
      total: ['Total', '', '', money0(ents.reduce((s, e) => s + e.amount, 0))],
      note: 'Line 24 of Schedule E includes these entities.',
    }))
  }
  return out
}
