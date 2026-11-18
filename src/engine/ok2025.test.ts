/**
 * Oklahoma Form 511 (2025). The engine's tax matches all 2,000 rows of the 2025 tax table and both worksheets
 * ($100,000: $4,562 single, $4,373 joint); other expected values are worked by hand from the 2025 Form 511 packet.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { OkInput, TaxReturnInput } from './model.ts'
import { computeOklahoma, okTax } from './ok2025.ts'
import { buildOkPacket } from '../pdf/ok2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'OK',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '2501 N Lincoln Blvd', city: 'Oklahoma City', state: 'OK', zip: '73194', phone: '405-555-0100' },
    ...patch
  }
}
const ok = (ret: TaxReturnInput, x: Partial<OkInput> = {}) => {
  const r = { ...ret, ok: { ...ret.ok, county: 'Oklahoma', ...x } }
  const res = computeReturn(r)
  return { ok: computeOklahoma(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '73-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('OK tax table and worksheets', () => {
  assert.equal(okTax(14793, true), 325) // the packet's example
  assert.equal(okTax(14793, false), 513)
  assert.equal(okTax(225, false), 1)
  assert.equal(okTax(99000, false), 4513 + 2)
  assert.equal(okTax(100000, false), 4562)
  assert.equal(okTax(100000, true), 4373)
  assert.equal(okTax(110000, false), 4562 + 475)
})

test('OK single W-2: standard deduction and one exemption', () => {
  const w = w2(60000)
  const { ok: r } = ok(base({ w2s: [w] }), { w2: withheld(w, 2000) })
  assert.equal(r.lines['10'], 6350)
  assert.equal(r.lines['11'], 1000)
  assert.equal(r.lines['13'], 52650)
  assert.equal(r.lines['14'], 2314) // row 52,650–52,700
  assert.equal(r.lines['39'], 314)
})

test('OK retiree: Social Security and the $10,000 retirement exclusion (government first)', () => {
  const ira = { ...empty1099R(), id: 'ira', owner: 'taxpayer' as const, payer: 'Broker', grossDistribution: 15000, taxableAmount: 15000, code: '7', ira: true }
  const ops = { ...empty1099R(), id: 'opers', owner: 'taxpayer' as const, payer: 'OPERS', grossDistribution: 8000, taxableAmount: 8000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 20000 }
  const { ok: r, res } = ok(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [ira, ops], socialSecurity: [ss] }), { retirementKind: { opers: 'okgov' } })
  assert.equal(r.schA['5'], 8000)
  assert.equal(r.schA['6'], 2000)
  assert.equal(r.schA['2'], Math.round(res.f1040['6b']))
  assert.equal(r.lines['7'], Math.round(res.f1040['11a']) - 10000 - r.schA['2'])
  const military = ok(base({ retirement: [{ ...ops, payer: 'DFAS' }] }), { retirementKind: { opers: 'military' } }).ok
  assert.equal(military.schA['4'], 8000)
})

test('OK credits: 5% of the child tax credit, 5% of EIC prorated', () => {
  const { ok: r, res } = ok(base({ filingStatus: 'mfj', w2s: [w2(50000)], dependents: [kid(5), kid(8, 'Amy Doe')] }))
  assert.equal(r.schF['3'], 4400)
  assert.equal(r.lines['15'], 220)
  const low = ok(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(4)] })).ok
  assert.ok(low.schG['1'] > 0)
  assert.equal(low.lines['28'], Math.round(low.schG['1'] * 0.05))
  void res
})

test('OK itemized: state income tax removed, $17,000 limit apart from medical and gifts', () => {
  const b0 = emptyReturn()
  const { ok: r, res } = ok(base({ w2s: [w2(200000)], itemized: { ...b0.itemized, stateLocalIncomeOrSalesTax: 6000, realEstateTax: 3000, mortgageInterest: 18000, charityCash: 5000 } }))
  assert.equal(res.deduction.used, 'itemized')
  const D = r.schD!
  assert.equal(D['2'], 6000)
  assert.equal(D['6'], D['3'] - D['5'])
  assert.equal(D['limited'], 1)
  assert.equal(r.lines['10'], 17000 + 5000)
})

test('Form 511: every value lands on one field and the PDF builds', async () => {
  const w = w2(45000)
  const ira = { ...empty1099R(), id: 'ira', owner: 'spouse' as const, payer: 'Broker', grossDistribution: 4000, taxableAmount: 4000, code: '7', ira: true }
  const { ok: r, res, ret } = ok(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(5)], retirement: [ira],
    refundDeposit: { routingNumber: '103000648', accountNumber: '5551212', accountType: 'checking' } }),
  { w2: withheld(w, 2500), usObligationInterest: 60, dependentBirthDates: {} })
  const packet = buildOkPacket(ret, res, r)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 5, 6]) // U.S. interest makes Oklahoma AGI smaller: 511-F and 511-G prorate
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 OK')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-OK.pdf`, bytes)
})
