/**
 * North Dakota ND-1 (2025), worked by hand from the 2025 booklet (tax table, rate schedules on page 27, the capital
 * gain and marriage penalty worksheets on pages 14–15).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { emptyReturn, emptySocialSecurity, emptyTransaction, emptyW2 } from './model.ts'
import type { NdInput, TaxReturnInput } from './model.ts'
import { computeNorthDakota, ndTax } from './nd2025.ts'
import { buildNdPacket } from '../pdf/nd2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'ND',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '600 E Boulevard Ave', city: 'Bismarck', state: 'ND', zip: '58505', phone: '701-555-0100' },
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<NdInput> = {}) => {
  const r = { ...ret, nd: { ...ret.nd, schoolCode: '08001', incomeSourceCode: '7', ...x } }
  const res = computeReturn(r)
  return { nd: computeNorthDakota(r, res), res, ret: r }
}

test('ND tax table rows and rate schedules', () => {
  // Rows from the 2025 tax table: the $91,900–$91,950 joint example is $214.
  assert.equal(ndTax(91925, 'mfj'), 214)
  assert.equal(ndTax(75020, 'single'), 518)
  assert.equal(ndTax(81070, 'mfj'), 2)
  assert.equal(ndTax(99960, 'single'), 1004)
  assert.equal(ndTax(99960, 'mfs'), 1160)
  assert.equal(ndTax(99960, 'hoh'), 683)
  assert.equal(ndTax(48000, 'single'), 0)
  assert.equal(ndTax(300000, 'single'), Math.round(3828.83 + (300000 - 244825) * 0.025))
})

test('ND single W-2: federal taxable income, zero bracket', () => {
  const w = w2(80000)
  const { nd } = run(base({ w2s: [w] }), { w2: { [w.id]: { ein: '45-1234567', stateId: '', stateIncome: null, stateTax: 400 } } })
  assert.equal(nd.lines['1b'], 64250)
  assert.equal(nd.lines['18'], 64250)
  assert.equal(nd.lines['20'], 308)
  assert.equal(nd.lines['32'], 92)
})

test('ND subtractions: 40% of long-term gains and qualified dividends, Social Security', () => {
  const tx = { ...emptyTransaction(), term: 'long' as const, proceeds: 30000, costBasis: 10000 }
  const ss = { ...emptySocialSecurity(), netBenefits: 24000 }
  const { nd, res } = run(base({ w2s: [w2(70000)], capitalTransactions: [tx], socialSecurity: [ss] }))
  assert.equal(nd.lines['6'], 8000)
  assert.equal(nd.lines['15'], Math.round(res.f1040['6b']))
})

test('ND marriage penalty credit', () => {
  const { nd } = run(base({ filingStatus: 'mfj', w2s: [w2(120000), w2(100000, 'spouse')] }))
  assert.equal(nd.lines['18'], 188500)
  assert.equal(nd.lines['20'], 2097)
  const m = nd.marriage!
  assert.equal(m['6'], 84250)
  assert.equal(m['7'], 698)
  assert.equal(m['9'], 1088)
  assert.equal(m['10'], 2097)
  assert.equal(nd.lines['22'], 311)
})

test('ND-1: every value lands on one field and the PDF builds', async () => {
  const r0 = emptyReturn()
  const t = w2(120000)
  const { nd, res, ret } = run(base({ filingStatus: 'mfj', w2s: [t, w2(100000, 'spouse')], refundDeposit: { ...r0.refundDeposit, routingNumber: '091300010', accountNumber: '12345678', accountType: 'savings' } }),
    { w2: { [t.id]: { ein: '45-1234567', stateId: '', stateIncome: null, stateTax: 3000 } }, collegeSave: 2000, contributions: { trees: 5 }, consent1099g: true })
  const packet = buildNdPacket(ret, res, nd)
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  assert.equal(packet.forms[0].values['B-1'], '08')
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 ND')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-ND.pdf`, bytes)
})
