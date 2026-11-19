/**
 * Utah TC-40 (2025). Expected values are worked by hand from the 2025 TC-40 instructions: 4.5% tax, the taxpayer tax
 * credit (6% of $2,111 exemptions plus the federal deduction, less 1.3% above the base phase-out amount), the
 * qualified exempt taxpayer worksheet and the TC-40A Part 3 credit worksheets.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { TaxReturnInput, UtInput } from './model.ts'
import { computeUtah } from './ut2025.ts'
import { buildUtPacket } from '../pdf/ut2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'UT',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '210 N 1950 W', city: 'Salt Lake City', state: 'UT', zip: '84134', phone: '801-555-0100' },
    ...patch
  }
}
const ut = (ret: TaxReturnInput, x: Partial<UtInput> = {}) => {
  const r = { ...ret, ut: { ...ret.ut, ...x } }
  const res = computeReturn(r)
  return { ut: computeUtah(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '87-1234567', stateId: '12345678901WTH', stateIncome: null, stateTax: tax } })

test('UT single W-2: 4.5% less the taxpayer tax credit', () => {
  const w = w2(60000)
  const { ut: r } = ut(base({ w2s: [w] }), { w2: withheld(w, 2500) })
  assert.equal(r.lines['10'], 2700)
  assert.equal(r.lines['16'], 945)
  assert.equal(r.lines['19'], 543)
  assert.equal(r.lines['20'], 402)
  assert.equal(r.lines['22'], 2298)
  assert.equal(r.lines['42'], 202)
})

test('UT family: personal exemptions and the child tax credit for a child 5 or younger', () => {
  const { ut: r } = ut(base({ filingStatus: 'mfj', w2s: [w2(50000)], dependents: [kid(3), kid(8, 'Amy Doe')] }))
  assert.deepEqual(r.dependents, { a: 2, b: 0, c: 0, d: 2 })
  assert.equal(r.lines['11'], 4222)
  assert.equal(r.lines['20'], 2143 - 176)
  assert.equal(r.lines['22'], 2250 - 1967)
  assert.equal(r.apportionable.find((x) => x.code === 'AT')?.amount, 1000)
  assert.equal(r.lines['27'], 0)
})

test('UT retiree: Social Security benefits credit; qualified exempt taxpayer', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'Plan', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const { ut: r, res } = ut(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 68, age65OrOlder: true }, retirement: [pension], socialSecurity: [ss] }))
  assert.ok(res.f1040['11a'] < 54000)
  assert.equal(r.apportionable.find((x) => x.code === 'AH')?.amount, Math.round(Math.round(res.f1040['6b']) * 0.045))
  const low = ut(base({ w2s: [w2(15000)] })).ut
  assert.equal(low.exempt, true)
  assert.equal(low.lines['22'], 0)
})

test('TC-40: every value lands on one field and the PDF builds', async () => {
  const w = w2(45000)
  const { ut: r, res, ret } = ut(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(4)], refundDeposit: { routingNumber: '124000054', accountNumber: '5551212', accountType: 'checking' } }), { w2: withheld(w, 1500), usObligationInterest: 40 })
  const packet = buildUtPacket(ret, res, r)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 3, 7])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 UT')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-UT.pdf`, bytes)
})
