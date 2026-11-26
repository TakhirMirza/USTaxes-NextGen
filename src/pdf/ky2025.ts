/**
 * Fills the official 2025 Kentucky Form 740 (42A740, public/forms/2025/ky740.pdf) and Schedules M, A and ITC from a
 * computed return. Two
 * columns on page 1: A for the spouse on a combined return (status 2), B for yourself or a joint return. Whole
 * dollars; the form prints the cents.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { KyResult } from '../engine/ky2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'
import { explainStatement, money0, statementForms } from './statement.ts'

const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const money = (n: number | undefined): string => {
  const v = Math.round(n ?? 0)
  return v === 0 ? '' : String(v)
}
const keep0 = (n: number | undefined): string => String(Math.round(n ?? 0))

export function formKy740(ret: TaxReturnInput, res: TaxReturnResult, ky: KyResult, preparer?: PreparerInfo | null): FormFill {
  const L = ky.lines
  const A = ky.colA
  const B = ky.colB
  const c = ret.contact
  const married = ret.filingStatus === 'mfj'
  const two = ky.status === 'combined'
  const v: Record<string, FieldValue> = {}
  v['740PrimarySSN'] = digits(ret.taxpayer.ssn)
  if (married || ky.status === 'separate') v['740SpouseSSN'] = digits(ret.spouse.ssn)
  const name = (p: { firstName: string; lastName: string }): string => upper(`${p.lastName}, ${p.firstName}`)
  v['740Name'] = married ? `${name(ret.taxpayer)} & ${upper(ret.spouse.lastName) === upper(ret.taxpayer.lastName) ? upper(ret.spouse.firstName) : name(ret.spouse)}` : name(ret.taxpayer)
  v['740StreetAddress2'] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v['740City'] = upper(c.city)
  v['740State'] = upper(c.state).slice(0, 2)
  v['740Zip'] = digits(c.zip).length === 9 ? `${digits(c.zip).slice(0, 5)}-${digits(c.zip).slice(5)}` : digits(c.zip).slice(0, 5)
  v['740PolPartyTP'] = false
  v['740PolPartySpouse'] = false
  v['740FilingStatus'] = { single: 'Single', combined: 'Combined', joint: 'Joint', separate: 'Separate' }[ky.status]
  if (ky.status === 'separate') v['740SFS4SpouseName'] = upper(`${ret.spouse.firstName} ${ret.spouse.lastName}`)
  for (const k of ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18']) {
    const always = ['5', '7', '9', '10', '11', '12', '14', '16', '18'].includes(k)
    v[`740Line${k}B`] = always ? keep0(B[k]) : money(B[k])
    if (two) v[`740Line${k}A`] = always ? keep0(A[k]) : money(A[k])
  }
  v['740Line19'] = keep0(L['19'])
  v['740FSCheckbox'] = String(ky.familySize)
  if (L['21'] > 0) {
    v['740Line21FSTCdecimal'] = ky.familyRate >= 1 ? '1.00' : `.${String(Math.round(ky.familyRate * 100)).padStart(2, '0')}`
    v['740Line21FSTCPercentage'] = String(Math.round(ky.familyRate * 100))
  }
  v['740Line21'] = money(L['21'])
  v['740Line22'] = keep0(L['22'])
  v['740Line23'] = money(L['23'])
  if (L['24'] > 0) {
    v['740Line24 from federal form 2441-K, line 11'] = keep0(res.schedule3.dependentCare)
    v['740Line24'] = money(L['24'])
  }
  v['740Line26'] = keep0(L['26'])
  v['740Line27'] = money(L['27'])
  v['740Line28'] = keep0(L['28'])
  v['740Line30'] = keep0(L['30'])
  v['740Line31a'] = money(L['31a'])
  v['740Line31b'] = money(L['31b'])
  v['740Line32'] = keep0(L['32'])
  v['740Line33'] = money(L['33'])
  v['740Line36'] = money(L['36'])
  v['740Line37'] = money(L['37'])
  v['740Line40'] = money(L['40'])
  v['740Line41'] = money(L['41'])
  v['740DriversLic-TP'] = upper(ret.ky.license.taxpayer)
  if (married) v['740DriversLic-SP'] = upper(ret.ky.license.spouse)
  const ph = digits(c.phone).slice(-10)
  if (ph.length === 10) v['740DaytimePhoneNum'] = `(${ph.slice(0, 3)}) ${ph.slice(3, 6)}-${ph.slice(6)}`
  if (ret.businesses.length === 0 && ret.rentals.length === 0) v['740Enclose1040Checkbox'] = true
  if (ret.usePaidPreparer && preparer) {
    v['740FirmName'] = upper(preparer.firmName || preparer.name)
    v['740PreparerID'] = preparer.ptin.toUpperCase()
    v['740PreparerPhoneNum'] = preparer.phone
  }
  return { id: 'ky740', file: 'ky740.pdf', title: 'Kentucky Form 740', values: v, pages: [0, 1, 2] }
}

const shortName = (ret: TaxReturnInput): string => {
  const t = ret.taxpayer
  const s = ret.spouse
  if (ret.filingStatus !== 'mfj') return upper(`${t.firstName} ${t.lastName}`)
  return upper(upper(s.lastName) === upper(t.lastName) ? `${t.firstName} & ${s.firstName} ${t.lastName}` : `${t.firstName} ${t.lastName} & ${s.firstName} ${s.lastName}`)
}

/** Schedule M, with the Pension Income Exclusion Worksheet (page 2 of this copy) when there is retirement income. */
export function formKySchM(ret: TaxReturnInput, ky: KyResult): FormFill | null {
  const two = ky.status === 'combined'
  const M = ky.schM
  const any = (['A', 'B'] as const).some((c) => (M[c]['6'] ?? 0) + (M[c]['17'] ?? 0) > 0)
  if (!any) return null
  const v: Record<string, FieldValue> = { SchMTPName: shortName(ret), SchMTPSSN: digits(ret.taxpayer.ssn) }
  const lines = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17']
  for (const c of (two ? ['A', 'B'] : ['B']) as ('A' | 'B')[]) {
    for (const k of lines) v[`SchMLine${k}${c}`] = ['6', '15', '17'].includes(k) ? keep0(M[c][k]) : money(M[c][k])
  }
  if ((M.A['5'] ?? 0) + (M.B['5'] ?? 0) > 0) v['SchMLine5(a)Text'] = upper(ret.ky.otherAdditionsText)
  if ((M.A['14'] ?? 0) + (M.B['14'] ?? 0) > 0) v['SchMLine14(a)Text'] = upper(ret.ky.otherSubtractionsText)
  const pension = (M.A['9'] ?? 0) + (M.B['9'] ?? 0) > 0
  if (pension) {
    for (const c of (two ? ['A', 'B'] : ['B']) as ('A' | 'B')[]) {
      const total = ky.pensionWs[c]
      if (!total) continue
      v[`SchMWkstCol${c}(a)`] = keep0(total)
      v[`SchMWkstCol${c}(d)`] = keep0(total)
      if (total > 31110) v[`SchMWkstCol ${c} YES-NO`] = '#1'
    }
  }
  return { id: 'ky-schm', file: 'ky-schm.pdf', title: 'Kentucky Schedule M', values: v, pages: pension ? [0, 1] : [0] }
}

export function formKySchA(ret: TaxReturnInput, ky: KyResult): FormFill | null {
  if (!ky.itemize) return null
  const S = ky.schA
  const sa = ret.ky.schA
  const v: Record<string, FieldValue> = { '740ATPName': shortName(ret), '740ATPSSN': digits(ret.taxpayer.ssn) }
  for (const k of ['1', '2', '3', '5', '7', '8', '9', '10', '12', '13']) v[`740ALine${k}`] = money(S[k])
  for (const k of ['6', '11', '14', '15']) v[`740ALine${k}`] = keep0(S[k])
  if (S['2'] > 0) v.SchALine2Text1 = upper(sa.individualInfo)
  if (S['13'] > 0) v['740ALine13Desc'] = upper(sa.otherText || 'OTHER')
  if (S['16'] !== undefined) {
    v['740ALine16'] = keep0(S['16'])
    v['740ALine17'] = S['17'].toFixed(2)
    v['740ALine18'] = S['18'].toFixed(2)
    v['740ALine19'] = keep0(S['19'])
    v['740ALine20'] = keep0(S['20'])
  }
  return { id: 'ky-scha', file: 'ky-scha.pdf', title: 'Kentucky Schedule A', values: v }
}

/** Schedule ITC: Section A (page 1), Sections B and C (page 2), Worksheet A (page 3) and the MGI worksheet (page 4) of this copy. */
export function formKyItc(ret: TaxReturnInput, res: TaxReturnResult, ky: KyResult): FormFill | null {
  const L = ky.lines
  const A = ky.colA
  const B = ky.colB
  const two = ky.status === 'combined'
  const married = ret.filingStatus === 'mfj'
  const secA = (ky.itc.E['25'] ?? 0) + (ky.itc.F['25'] ?? 0) > 0
  const personal = (B['17'] ?? 0) + (A['17'] ?? 0) > 0
  const family = L['21'] > 0
  if (!secA && !personal && !family) return null
  const v: Record<string, FieldValue> = { SchITCTPName: shortName(ret), SchITCTPSSN: digits(ret.taxpayer.ssn) }
  for (let i = 1; i <= 25; i++) {
    const k = String(i)
    if (two) v[`SchITCSecALine${k}E`] = k === '25' ? (secA ? keep0(ky.itc.E['25']) : '') : money(ky.itc.E[k])
    v[`SchITCSecALine${k}F`] = k === '25' ? (secA ? keep0(ky.itc.F['25']) : '') : money(ky.itc.F[k])
  }
  // Section B
  const pc = (o: 'taxpayer' | 'spouse'): [number, number, number] => {
    const p = o === 'taxpayer' ? ret.taxpayer : ret.spouse
    return [(p.age65OrOlder || p.age >= 65) ? 40 : 0, p.blind ? 40 : 0, ret.ky.nationalGuard[o] ? 20 : 0]
  }
  const [t1, t2, t3] = pc('taxpayer')
  v.SchITCSecBTPDOB = ret.ky.birthDate.taxpayer.trim()
  v.SchITCSecBLine1 = money(t1); v.SchITCSecBLine2 = money(t2); v.SchITCSecBLine3 = money(t3); v.SchITCSecBLine4 = keep0(t1 + t2 + t3)
  if (married) {
    const [s1, s2, s3] = pc('spouse')
    v.SchITCSecBSpouseDOB = ret.ky.birthDate.spouse.trim()
    v.SchITCSecBLine5 = money(s1); v.SchITCSecBLine6 = money(s2); v.SchITCSecBLine7 = money(s3); v.SchITCSecBLine8 = keep0(s1 + s2 + s3)
    if (two) { v.SchITCSecBLine10 = keep0(B['17']); v.SchITCSecBLine11 = keep0(A['17']) } else v.SchITCSecBLine12 = keep0(B['17'])
  } else v.SchITCSecBLine9 = keep0(B['17'])
  // Section C
  const kids = ret.dependents.filter((x) => x.childRelationship && (x.age < 19 || (x.student && x.age < 24) || x.disabled))
  kids.slice(0, 3).forEach((x, i) => {
    v[`SchITCDepenentName${i + 1}`] = upper(x.name)
    v[`SchITCSecBDepSSN${i + 1}`] = digits(x.ssn)
    v[`SchITCSecBDepRelationship${i + 1}`] = upper(x.relationship)
    v[`SchITCSecBQualChildCheckbox${i + 1}`] = true
  })
  const pages = [0, 1]
  const w = ky.wsA
  if (w) {
    v.SchITCWkstAState = upper(ret.ky.otherState.state)
    for (let i = 1; i <= 12; i++) v[`SchITCWkstALine${i}`] = keep0(w[String(i)])
    pages.push(2)
  }
  if (family) {
    const agi = Math.max(0, Math.round(res.f1040['11a']))
    const muni = Math.max(0, Math.round(res.f1040['2a']))
    const kyAgi = (two ? Math.max(0, A['9']) : 0) + Math.max(0, B['9'])
    v['SchITCMGIWkst(a)'] = keep0(agi); v['SchITCMGIWkst(c)'] = money(muni); v['SchITCMGIWkst(e)'] = keep0(agi + muni)
    v['SchITCMGIWkst(f)'] = keep0(kyAgi); v['SchITCMGIWkst(i)'] = keep0(kyAgi); v['SchITCMGIWkst(j)'] = keep0(ky.mgi)
    pages.push(3)
  }
  return { id: 'ky-itc', file: 'ky-itc.pdf', title: 'Kentucky Schedule ITC', values: v, pages }
}

/**
 * Schedule KW-2 (42A740-KW2, 10-25): every W-2 (Part I, ten rows) and 1099/W-2G (Part II, five rows) with Kentucky
 * withholding; more statements continue on more KW-2s. Lines 11 and 17 total each sheet; line 18 (all sheets) is on the first.
 */
export function formsKyKw2(ret: TaxReturnInput, ky: KyResult): FormFill[] {
  const owners = ret.filingStatus === 'mfj' ? ['taxpayer', 'spouse'] : ['taxpayer']
  const person = (o: string) => (o === 'spouse' ? ret.spouse : ret.taxpayer)
  const w2 = ret.w2s.filter((w) => owners.includes(w.owner) && (ret.ky.w2[w.id]?.stateTax ?? 0) > 0).map((w) => {
    const st = ret.ky.w2[w.id]!
    return { ssn: person(w.owner).ssn, ein: st.ein, state: 'KY', id: st.stateId, income: Math.round(st.stateIncome ?? w.wages), tax: Math.round(st.stateTax) }
  })
  const other = (ret.withholdingLists?.['ky.withholdingOther'] ?? []).filter((x) => x.tax > 0 && owners.includes(x.owner)).map((x) => ({ ssn: person(x.owner).ssn, ein: x.payerId, state: 'KY', id: x.stateId, income: Math.round(x.income), tax: Math.round(x.tax) }))
  if (!w2.length && !other.length) return []
  const n = Math.max(1, Math.ceil(w2.length / 10), Math.ceil(other.length / 5))
  const out: FormFill[] = []
  for (let k = 0; k < n; k++) {
    const v: Record<string, FieldValue> = { 'KW2-NameOnReturn': shortName(ret), KW2PrimarySSN: digits(ret.taxpayer.ssn) }
    if (ret.filingStatus === 'mfj') v.KW2SecondarySSN = digits(ret.spouse.ssn)
    const rows = (list: typeof w2, from: number, count: number, part: string, first: number): number => {
      const slice = list.slice(k * count, k * count + count)
      slice.forEach((x, i) => {
        const line = first + i
        const c = part === 'II' && line === 13 ? 'c' : 'C'
        v[`KW2Part${part}Line${line}A`] = digits(x.ssn)
        v[`KW2Part${part}Line${line}B`] = digits(x.ein).slice(0, 9)
        v[`KW2Part${part}Line${line}${c}`] = x.state
        v[`KW2Part${part}Line${line}D`] = digits(x.id).slice(0, 9)
        v[`KW2Part${part}Line${line}E`] = String(x.income)
        v[`KW2Part${part}Line${line}F`] = String(x.tax)
      })
      void from
      return slice.reduce((s, x) => s + x.tax, 0)
    }
    const t1 = rows(w2, 0, 10, 'I', 1)
    const t2 = rows(other, 0, 5, 'II', 12)
    if (t1) { v.KW2PartILine11F = String(t1); v.KW2PartILine11E = String(w2.slice(k * 10, k * 10 + 10).reduce((s, x) => s + x.income, 0)) }
    if (t2) { v.KW2PartIILine17F = String(t2); v.KW2PartIILine17E = String(other.slice(k * 5, k * 5 + 5).reduce((s, x) => s + x.income, 0)) }
    if (k === 0) v.KW2PartIIILine18F = String(w2.reduce((s, x) => s + x.tax, 0) + other.reduce((s, x) => s + x.tax, 0))
    out.push({ id: k ? `kykw2-${k + 1}` : 'kykw2', file: 'ky-kw2.pdf', title: k ? `Kentucky Schedule KW-2 (sheet ${k + 1})` : 'Kentucky Schedule KW-2', values: v })
  }
  void ky
  return out
}

export function buildKyPacket(ret: TaxReturnInput, res: TaxReturnResult, ky: KyResult, preparer?: PreparerInfo | null): FormPacket {
  const forms = [formKy740(ret, res, ky, preparer), formKySchM(ret, ky), formKySchA(ret, ky), formKyItc(ret, res, ky)]
  const out = forms.filter((x): x is FormFill => x !== null)
  const kw2 = formsKyKw2(ret, ky)
  out.push(...kw2)
  const M = ky.schM
  const add = (M.A['5'] ?? 0) + (M.B['5'] ?? 0)
  const sub = (M.A['14'] ?? 0) + (M.B['14'] ?? 0)
  const one = (key: string, amount: number, text: string, line: string): FormFill[] => {
    const st = explainStatement(ret, key, amount, { id: `st-${key.replace('.', '-')}`, attachTo: `Schedule M, line ${line}`, title: line === '5' ? 'Other additions' : 'Other subtractions' })
    if (st.length || !(amount > 0) || !text.trim()) return st
    return statementForms(ret, { id: `st-${key.replace('.', '-')}`, attachTo: `Schedule M, line ${line}`, title: line === '5' ? 'Other additions' : 'Other subtractions', columns: [{ label: 'Description', width: 400 }, { label: 'Amount', width: 110, right: true }], rows: [[text.trim(), money0(amount)]] })
  }
  const st = [...one('ky.otherAdditions', add, ret.ky.otherAdditionsText, '5'), ...one('ky.otherSubtractions', sub, ret.ky.otherSubtractionsText, '14')]
  out.push(...st)
  const missing = (add > 0 && !st.some((f) => f.id.startsWith('st-ky-otherAdditions'))) || (sub > 0 && !st.some((f) => f.id.startsWith('st-ky-otherSubtractions')))
  const otherListed = (ret.withholdingLists?.['ky.withholdingOther'] ?? []).some((x) => x.tax > 0)
  const notIncluded = ky.attach.filter((a) => (missing || !a.startsWith('A statement explaining the other additions')) && !(kw2.length && a.startsWith('Schedule KW-2')))
  if (kw2.length) notIncluded.push('Your W-2s, 1099s and W-2Gs with Kentucky withholding (keep them with your records; Schedule KW-2 lists them)')
  if (ret.ky.withholdingOther > 0 && !otherListed) notIncluded.push('Schedule KW-2 Part II: list each 1099 or W-2G with Kentucky withholding in the Kentucky section')
  return { forms: out, notIncluded }
}
