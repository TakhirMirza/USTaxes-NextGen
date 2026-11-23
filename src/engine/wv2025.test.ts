/**
 * West Virginia IT-140 (2025). Tax table rows checked against the 2025 tax table; returns worked by hand from the 2025
 * forms and instructions booklet.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { TaxReturnInput, WvInput } from './model.ts'
import { computeWestVirginia, wvFamilyCreditPercent, wvTax } from './wv2025.ts'
import { buildWvPacket } from '../pdf/wv2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'WV',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1001 Lee St E', city: 'Charleston', state: 'WV', zip: '25301', phone: '304-555-0100' },
    ...patch
  }
}
const wv = (ret: TaxReturnInput, x: Partial<WvInput> = {}) => {
  const r = { ...ret, wv: { ...ret.wv, ...x } }
  const res = computeReturn(r)
  return { wv: computeWestVirginia(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '55-1234567', stateId: '123456789', stateIncome: null, stateTax: tax } })

test('WV tax table rows and rate schedules', () => {
  assert.equal(wvTax(24, false).tax, 0)
  assert.equal(wvTax(25, false).tax, 1)
  assert.equal(wvTax(99, false).tax, 2)
  assert.equal(wvTax(150, false).tax, 3)
  assert.equal(wvTax(15000, false).tax, 371)
  assert.equal(wvTax(24999, false).tax, 665)
  assert.equal(wvTax(25059, false).tax, 667)
  assert.equal(wvTax(39999, false).tax, 1165)
  assert.equal(wvTax(46000, false).tax, 1433)
  assert.equal(wvTax(58000, false).tax, 1966)
  assert.equal(wvTax(99999, false).tax, 3980)
  assert.equal(wvTax(117635, false).tax, 4832)
  assert.equal(wvTax(118460, true).tax, 5291)
})

test('WV Family Tax Credit percentages', () => {
  assert.equal(wvFamilyCreditPercent(1, 15650, false), 1)
  assert.equal(wvFamilyCreditPercent(1, 15651, false), 0.9)
  assert.equal(wvFamilyCreditPercent(3, 27000, false), 0.8)
  assert.equal(wvFamilyCreditPercent(8, 56851, false), 0)
  assert.equal(wvFamilyCreditPercent(10, 54150, false), 1)
  assert.equal(wvFamilyCreditPercent(1, 7976, true), 0.8)
})

test('WV single W-2', () => {
  const w = w2(60000)
  const { wv: r } = wv(base({ w2s: [w] }), { w2: withheld(w, 2000) })
  assert.equal(r.lines['6'], 2000)
  assert.equal(r.lines['7'], 58000)
  assert.equal(r.lines['8'], 1966)
  assert.equal(r.lines['28'], 34)
})

test('WV family: Family Tax Credit wipes out the tax at low income', () => {
  const { wv: r } = wv(base({ filingStatus: 'mfj', w2s: [w2(25000)], dependents: [kid(3), kid(8, 'Amy Doe')] }))
  assert.equal(r.lines['6'], 8000)
  assert.equal(r.lines['7'], 17000)
  assert.equal(r.ftc['6'], 1)
  assert.equal(r.lines['9'], r.lines['8'])
  assert.equal(r.lines['10'], 0)
})

test('WV retiree: Social Security, military retirement and the senior deduction', () => {
  const p = { ...empty1099R(), id: 'm', owner: 'taxpayer' as const, payer: 'DFAS', grossDistribution: 20000, taxableAmount: 20000, code: '7' }
  const q = { ...empty1099R(), id: 'q', owner: 'taxpayer' as const, payer: 'Plan', grossDistribution: 15000, taxableAmount: 15000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const { wv: r, res } = wv(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p, q], socialSecurity: [ss] }), { retirementKind: { m: 'military' }, birthYear: { taxpayer: '1955', spouse: '' } })
  assert.equal(r.m.A['32'], 20000)
  assert.ok(res.f1040['11a'] > 50000)
  assert.equal(r.m.A['34'], Math.round(Math.round(res.f1040['6b']) * 0.65))
  assert.equal(r.m.A['47'], Math.max(0, 8000 - 20000 - r.m.A['34']))
  assert.equal(r.lines['4'], Math.round(res.f1040['11a']) - r.lines['3'])
})

test('IT-140 with Schedule M, RECAP and FTC-1: the PDF builds', async () => {
  const w = w2(22000)
  const k = kid(4)
  const { wv: r, res, ret } = wv(base({ filingStatus: 'mfj', w2s: [w], dependents: [k], refundDeposit: { routingNumber: '051900366', accountNumber: '5551212', accountType: 'checking' } }), { w2: withheld(w, 500), usObligationInterest: 40, dependentBirthDate: { [k.id]: '04 15 2021' }, motorVehicleCredit: 120, donations: { A: 5, B: 0, C: 0 } })
  const packet = buildWvPacket(ret, res, r)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 4, 5, 6])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 WV')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-WV.pdf`, bytes)
})

test('WV Schedule E credit for tax paid to another state', async () => {
  const { wv: w, res, ret } = wv(base({ w2s: [w2(70000)] }), { otherStates: [{ state: 'va', tax: 900, income: 20000 }] })
  const e = w.schE[0].lines
  assert.equal(e['2'], w.lines['8'])
  assert.equal(e['5'], Math.round(e['2'] * 20000 / w.lines['4']))
  assert.equal(e['7'], wvTax(w.lines['7'] - 20000, false).tax)
  assert.equal(e['10'], Math.min(e['1'], e['2'], e['5'], e['8'], e['9']))
  assert.equal(w.recap['1'], e['10'])
  const packet = buildWvPacket(ret, res, w)
  assert.ok(packet.forms.some((f) => f.id === 'wvsche1'))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms.filter((f) => f.id === 'wvsche1'), load, '2025 WV Sch E')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-WVE.pdf`, bytes)
})
