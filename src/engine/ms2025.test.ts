/**
 * Mississippi Form 80-105 (2025). Expected values are worked by hand from the 2025 Form 80-100 instructions: 0% on the
 * first $10,000 of each column, 4.4% above; $2,300 / $4,600 standard deduction; $6,000 / $12,000 exemptions plus
 * $1,500 per dependent; retirement income and Social Security exempt.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099Int, empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { MsInput, TaxReturnInput } from './model.ts'
import { computeMississippi, msTax } from './ms2025.ts'
import { buildMsPacket } from '../pdf/ms2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'MS',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '500 Clinton Center Dr', city: 'Clinton', state: 'MS', zip: '39056', phone: '601-555-0100' },
    ...patch
  }
}
const ms = (ret: TaxReturnInput, x: Partial<MsInput> = {}) => {
  const r = { ...ret, ms: { ...ret.ms, ...x } }
  const res = computeReturn(r)
  return { ms: computeMississippi(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '64-1234567', stateId: '123456789', stateIncome: null, stateTax: tax } })

test('MS tax: 0% on the first $10,000, 4.4% above', () => {
  assert.equal(msTax(10000), 0)
  assert.equal(msTax(41700), 1395)
  assert.equal(msTax(-500), 0)
})

test('MS single W-2', () => {
  const w = w2(50000)
  const { ms: r } = ms(base({ w2s: [w] }), { w2: withheld(w, 1500) })
  assert.equal(r.lines['13A'], 50000)
  assert.equal(r.lines['14A'] + r.lines['15A'], 8300)
  assert.equal(r.lines['16A'], 41700)
  assert.equal(r.lines['17'], 1395)
  assert.equal(r.lines['34'], 105)
  assert.equal(r.statements.length, 1)
})

test('MS joint: two columns, deductions and exemptions divided to use both $10,000 bands', () => {
  const { ms: r } = ms(base({ filingStatus: 'mfj', w2s: [w2(40000), w2(20000, 'spouse')], dependents: [kid(3), kid(8, 'Amy Doe')] }))
  assert.equal(r.lines['12'], 15000)
  assert.equal(r.lines['16A'], 20400)
  assert.equal(r.lines['16B'], 20000)
  assert.equal(r.lines['17'], 458 + 440)
})

test('MS retiree: pension and Social Security are exempt; early distributions are taxed', () => {
  const p = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'PERS', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const { ms: r } = ms(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 68, age65OrOlder: true }, retirement: [p], socialSecurity: [ss] }))
  assert.equal(r.lines['49A'], 0)
  assert.equal(r.lines['17'], 0)
  assert.equal(r.lines['10'], 1500)
  const e = ms(base({ retirement: [{ ...p, code: '1', taxableAmount: 20000 }] })).ms
  assert.equal(e.lines['46A'], 20000)
})

test('80-105, 80-107 and 80-108: every value lands on one field and the PDF builds', async () => {
  const w = w2(45000)
  const { ms: r, res, ret } = ms(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(4)], interest: [{ ...empty1099Int(), payer: 'Bank', interest: 300 }], refundDeposit: { routingNumber: '065305436', accountNumber: '5551212', accountType: 'checking' } }), { w2: withheld(w, 1500), usObligationInterest: 40, countyCode: '25', contributions: { education: 5 } })
  const packet = buildMsPacket(ret, res, r)
  assert.deepEqual(packet.forms.map((f) => f.id), ['ms80105', 'ms80107', 'ms80108'])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 MS')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-MS.pdf`, bytes)
})

test('MS Form 80-160 and Form 80-401', async () => {
  const { ms: x, res, ret } = ms(base({ w2s: [w2(70000)] }), {
    otherStates: [{ state: 'AL', income: 30000, deduction: 3000, exemption: 1500, tax: 1000 }],
    credits401: [{ code: '25', earned: 500, passThrough: 0, carryover: 0, expired: 0 }], adopteeSsns: '111-22-3333'
  })
  assert.equal(x.lines['17'], 2275)
  const f = x.f160!
  assert.equal(f.total4, 25500); assert.equal(f.a7, 15500); assert.equal(f.b7, 682)
  assert.equal(f.cols[0]['5'], 100); assert.equal(f.cols[0]['10'], 682)
  assert.equal(x.lines['18'], 682)
  assert.equal(x.f401[0].E, 500); assert.equal(x.lines['19'], 500)
  assert.equal(x.lines['20'], 2275 - 682 - 500)
  const packet = buildMsPacket(ret, res, x)
  const p401 = packet.forms.find((y) => y.id === 'ms80401')!
  assert.equal(p401.values.AdopteeSSN1, '111223333')
  assert.equal(packet.forms.find((y) => y.id === 'ms80160')!.values['3-5'], '100.00')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const g of packet.forms) await fillForm(lib, await load(g.file), { ...g }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 MS')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-MSS.pdf`, bytes)
})
