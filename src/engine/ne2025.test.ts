/**
 * Nebraska Form 1040N (2025). Expected values are worked by hand from the 2025 Tax Calculation Schedule and the 2025
 * Nebraska Individual Income Tax Booklet.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { NeInput, TaxReturnInput } from './model.ts'
import { computeNebraska, neCarePercent, neFederalCareDecimal, neRefundableCare, neTax } from './ne2025.ts'
import { buildNePacket } from '../pdf/ne2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'NE',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '301 Centennial Mall S', city: 'Lincoln', state: 'NE', zip: '68509', phone: '402-555-0100' },
    ...patch
  }
}
const ne = (ret: TaxReturnInput, x: Partial<NeInput> = {}) => {
  const r = { ...ret, ne: { ...ret.ne, ...x } }
  const res = computeReturn(r)
  return { ne: computeNebraska(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '47-1234567', stateId: '12345678', stateIncome: null, stateTax: tax } })

test('NE tax calculation schedule', () => {
  assert.equal(neTax(4030, 'single'), 99)
  assert.equal(neTax(24120, 'single'), 804)
  assert.equal(neTax(38870, 'single'), 1543)
  assert.equal(neTax(77730, 'mfj'), 3086)
  assert.equal(neTax(57630, 'hoh'), 2230)
  assert.equal(neTax(51400, 'single'), 2195)
})

test('NE Form 2441N decimals', () => {
  assert.equal(neFederalCareDecimal(15000), 0.35)
  assert.equal(neFederalCareDecimal(15001), 0.34)
  assert.equal(neFederalCareDecimal(23000), 0.31)
  assert.equal(neFederalCareDecimal(29000), 0.28)
  assert.equal(neCarePercent(22000), 1)
  assert.equal(neCarePercent(22500), 0.9)
  assert.equal(neCarePercent(25000), 0.7)
  assert.equal(neCarePercent(28001), 0.3)
  assert.equal(neCarePercent(29001), 0)
  assert.equal(neRefundableCare(3000, 20000), Math.round(3000 * 0.32))
  assert.equal(neRefundableCare(3000, 24500), Math.round(3000 * 0.30 * 0.7))
})

test('NE single W-2', () => {
  const w = w2(60000)
  const { ne: r } = ne(base({ w2s: [w] }), { w2: withheld(w, 2100) })
  assert.equal(r.lines['6'], 8600)
  assert.equal(r.lines['14'], 51400)
  assert.equal(r.lines['15'], 2195)
  assert.equal(r.lines['18'], 171)
  assert.equal(r.lines['35'], 2024)
  assert.equal(r.lines['63'], 76)
})

test('NE joint with two children; retiree with military retirement and Social Security', () => {
  const { ne: r } = ne(base({ filingStatus: 'mfj', w2s: [w2(90000)], dependents: [kid(3), kid(8, 'Amy Doe')] }))
  assert.equal(r.lines['14'], 72800)
  assert.equal(r.lines['15'], 2839)
  assert.equal(r.lines['18'], 684)
  assert.equal(r.lines['35'], 2155)
  const p = { ...empty1099R(), id: 'm', owner: 'taxpayer' as const, payer: 'DFAS', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const old = ne(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p], socialSecurity: [ss] }), { retirementKind: { m: 'military' } })
  assert.equal(old.ne.lines['6'], 10600)
  assert.equal(old.ne.scheduleI['32'], 30000)
  assert.equal(old.ne.scheduleI['31'], Math.round(old.res.f1040['6b']))
  assert.equal(old.ne.lines['14'], 0)
})

test('NE earned income credit is 10% of the federal credit', () => {
  const { ne: r, res } = ne(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(6)] }))
  assert.equal(r.lines['44'], Math.round(res.f1040['27a'] * 0.1))
  assert.equal(r.qualifyingChildren, 1)
  assert.ok(r.lines['63'] >= r.lines['44'])
})

test('1040N and Schedule I: every value lands on one field and the PDF builds', async () => {
  const w = w2(45000)
  const { ne: r, res, ret } = ne(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(4)], refundDeposit: { routingNumber: '104000016', accountNumber: '5551212', accountType: 'checking' } }), { w2: withheld(w, 1500), usObligationInterest: 40, schoolDistrictCode: '55-0001', wildlife: 2 })
  const packet = buildNePacket(ret, res, r)
  assert.deepEqual(packet.forms.map((f) => f.id), ['ne1040n', 'neschi'])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 NE')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-NE.pdf`, bytes)
})
