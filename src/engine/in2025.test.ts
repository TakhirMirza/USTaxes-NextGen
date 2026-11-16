/**
 * Indiana Form IT-40 (2025). Expected values are worked by hand from the 2025 IT-40 booklet (12-25): 3% state tax,
 * county tax at the January 1 county rate (2025 county rate chart), Schedules 2 and 3, the unified tax credit for
 * the elderly (Tables A and B) and Indiana EIC (10% of the federal credit).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { InInput, TaxReturnInput } from './model.ts'
import { computeIndiana, inCountyRate, inElderlyCredit } from './in2025.ts'
import { IN_COUNTIES } from './inCounties2025.ts'
import { buildInPacket } from '../pdf/in2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'IN',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1 Monument Cir', city: 'Indianapolis', state: 'IN', zip: '46204', phone: '317-555-0100' },
    ...patch
  }
}
const ind = (ret: TaxReturnInput, i: Partial<InInput> = {}) => {
  const x = { ...ret, in: { ...ret.in, ...i } }
  const res = computeReturn(x)
  return { it: computeIndiana(x, res), res, ret: x }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '35-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('IN county chart: 92 counties; spot rates', () => {
  assert.equal(Object.keys(IN_COUNTIES).length, 92)
  assert.equal(inCountyRate('49'), 0.0202) // Marion
  assert.equal(inCountyRate('29'), 0.011) // Hamilton
  assert.equal(inCountyRate('64'), 0.005) // Porter
  assert.equal(inCountyRate('99'), undefined)
})

test('IN single renter in Marion County', () => {
  const w = w2(50000)
  const { it } = ind(base({ w2s: [w] }), { w2: withheld(w, 1400), countyWithheld: 1000, countyLived: { taxpayer: '49', spouse: '' }, countyWorked: { taxpayer: '49', spouse: '' }, rentPaid: 6000 })
  assert.equal(it.s2['1'], 3000)
  assert.equal(it.lines['6'], 1000)
  assert.equal(it.lines['7'], 46000)
  assert.equal(it.lines['8'], 1380)
  assert.equal(it.lines['9'], 929) // 46,000 × 2.02%
  assert.equal(it.lines['12'], 2400)
  assert.equal(it.lines['21'], 2400 - 1380 - 929)
})

test('IN family in Hamilton County: dependent child exemptions and property tax deduction', () => {
  const { it } = ind(base({ filingStatus: 'mfj', w2s: [w2(80000)], dependents: [kid(5), kid(10, 'Amy Doe')] }), { countyLived: { taxpayer: '29', spouse: '29' }, propertyTax: 3000, firstTimeChildren: 1 })
  assert.equal(it.s2['2'], 2500)
  assert.equal(it.s3['box5'], 2)
  assert.equal(it.s3['box6'], 3) // two dependent children plus one first-time box
  assert.equal(it.s3['7'], 2000 + 2000 + 3 * 1500)
  assert.equal(it.lines['7'], 80000 - 2500 - 8500)
  assert.equal(it.lines['8'], Math.round(69000 * 0.03))
  assert.equal(it.lines['9'], Math.round(69000 * 0.011))
})

test('IN elderly: Social Security deduction, 65 exemptions and the unified credit', () => {
  assert.equal(inElderlyCredit(500, true), 140)
  assert.equal(inElderlyCredit(2000, false), 50)
  assert.equal(inElderlyCredit(10000, true), 0)
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'Plan', grossDistribution: 5000, taxableAmount: 5000, code: '7' }
  const { it } = ind(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [pension] }), { countyLived: { taxpayer: '49', spouse: '' } })
  assert.equal(it.s3['4'], 1000)
  assert.equal(it.s3['5'], 500) // income under $40,000
  assert.equal(it.s5['5'], 40)
  assert.equal(it.lines['7'], 5000 - 2500)
})

test('IN earned income credit is 10% of the federal credit; IN-EIC is filled', async () => {
  const { it, res, ret } = ind(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(4)] }), { countyLived: { taxpayer: '49', spouse: '' } })
  assert.ok(res.f1040['27a'] > 0)
  assert.equal(it.s5['6'], Math.round(res.f1040['27a'] * 0.1))
  const packet = buildInPacket(ret, res, it)
  const eic = packet.forms.find((x) => x.id === 'ineic')
  assert.ok(eic)
  assert.equal(eic.values['Age 1'], 'A')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await readFile(new URL(f.file, formsDir)), { ...f }, problems)
  assert.deepEqual(problems, [])
})

test('IN forms: every value lands on one field and the PDF builds', async () => {
  const w = w2(60000)
  const { it, res, ret } = ind(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(5), kid(19, 'Ann Doe')],
    refundDeposit: { routingNumber: '074000010', accountNumber: '5551212', accountType: 'checking' } }),
  { w2: withheld(w, 1700), countyWithheld: 1100, countyLived: { taxpayer: '49', spouse: '49' }, countyWorked: { taxpayer: '49', spouse: '49' }, rentPaid: 9000, landlord: 'Main St Apartments, Indianapolis', usObligationInterest: 50, donations: 5, otherStateCredit: 100 })
  const packet = buildInPacket(ret, res, it)
  assert.deepEqual(packet.forms.map((x) => x.id), ['init40', 'ins2', 'ins3', 'indep1', 'ins5', 'ins6', 'ins7', 'inct40'])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 IN')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-IN.pdf`, bytes)
})
