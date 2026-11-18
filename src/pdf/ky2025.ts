/**
 * Fills the official 2025 Kentucky Form 740 (42A740, public/forms/2025/ky740.pdf) from a computed return. Two
 * columns on page 1: A for the spouse on a combined return (status 2), B for yourself or a joint return. Whole
 * dollars; the form prints the cents.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { KyResult } from '../engine/ky2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

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

export function buildKyPacket(ret: TaxReturnInput, res: TaxReturnResult, ky: KyResult, preparer?: PreparerInfo | null): FormPacket {
  return { forms: [formKy740(ret, res, ky, preparer)], notIncluded: [...ky.attach] }
}
