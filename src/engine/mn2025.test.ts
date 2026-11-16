/**
 * Minnesota Form M1 (2025). Expected values are worked by hand from the 2025 M1 instructions (tax table and rate
 * schedules, standard deduction table and worksheets, line 5 worksheet), Schedule M1M (Social Security worksheet)
 * and Schedule M1CWFC. The engine's tax also matches all 869 parsed rows of the printed tax table in all four columns.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { MnInput, TaxReturnInput } from './model.ts'
import { computeMinnesota, mnChildWorkingFamily, mnExemptions, mnStandardLimit, mnTax } from './mn2025.ts'
import { buildMnPacket } from '../pdf/mn2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe', more = {}) => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true, ...more })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'MN',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1 Lake St', city: 'Duluth', state: 'MN', zip: '55802' },
    ...patch
  }
}
const mn = (ret: TaxReturnInput, m: Partial<MnInput> = {}) => {
  const x = { ...ret, mn: { ...ret.mn, ...m } }
  const res = computeReturn(x)
  return { mn: computeMinnesota(x, res), res, ret: x }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '41-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('MN tax table and rate schedules', () => {
  assert.equal(mnTax(10, 'single'), 0)
  assert.equal(mnTax(50, 'single'), 3)
  assert.equal(mnTax(6150, 'mfj'), 329)
  assert.equal(mnTax(45050, 'single'), 2591)
  assert.equal(mnTax(100000, 'single'), 6328) // 1,742.50 + 6.8% × 67,430
  assert.equal(mnTax(400000, 'mfj'), 30115) // 23,260.31 + 9.85% × 69,590
})

test('MN standard deduction limitation and dependent exemption phaseout', () => {
  assert.equal(mnStandardLimit(14950, 200000, 'single'), 14950)
  assert.equal(mnStandardLimit(14950, 300000, 'single'), 13119) // 3% × 61,050 = 1,831.50
  assert.equal(mnStandardLimit(29900, 2000000, 'mfj'), 5980) // 80% cut
  assert.equal(mnExemptions(2, 200000, 'single'), 10400)
  assert.equal(mnExemptions(1, 250000, 'single'), 4680) // 10,950 over → 5 steps → 10%
  assert.equal(mnExemptions(1, 500000, 'single'), 0)
})

test('MN single W-2', () => {
  const w = w2(60000)
  const { mn: r } = mn(base({ w2s: [w] }), { w2: withheld(w, 2500) })
  assert.equal(r.lines['4'], 14950)
  assert.equal(r.lines['9'], 45050)
  assert.equal(r.lines['10'], 2591)
  assert.equal(r.lines['22'], 0)
  assert.equal(r.lines['26'], 91)
})

test('MN family: exemptions and Child and Working Family Credits', () => {
  const { mn: r } = mn(base({ filingStatus: 'mfj', w2s: [w2(30000)], dependents: [kid(5), kid(10, 'Amy Doe')] }))
  assert.equal(r.lines['5'], 10400)
  assert.equal(r.lines['9'], 0)
  assert.equal(r.cwfc['4'], 379)
  assert.equal(r.cwfc['8'], 3500)
  assert.equal(r.cwfc['15'], 3879)
  assert.equal(r.ref['2a'], 2)
  assert.equal(r.lines['24'], 3879)
})

test('MN qualifying older child: $1,000 and the 9% reduction', () => {
  const { mn: r } = mn(base({ filingStatus: 'mfj', w2s: [w2(40000)], dependents: [kid(19, 'Ann Doe', { student: true })] }))
  assert.equal(r.dependents.older, 1)
  assert.equal(r.cwfc['5'], 1000)
  assert.equal(r.cwfc['13'], 0.09)
  assert.equal(r.cwfc['15'], 379 + 1000 - 188) // 9% × 2,090
  assert.deepEqual(mnChildWorkingFamily(20000, 20000, 0, 0, false)['15'], 379)
})

test('MN Social Security subtraction: full below the limit, simplified method above', () => {
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 30000 }
  const pension = (n: number) => ({ ...empty1099R(), owner: 'taxpayer' as const, payer: 'Plan', grossDistribution: n, taxableAmount: n, code: '7' })
  const old = { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 67, age65OrOlder: true }
  const low = mn(base({ taxpayer: old, socialSecurity: [ss], retirement: [pension(20000)] }))
  assert.equal(low.mn.m['12'], Math.round(low.res.f1040['6b']))
  const high = mn(base({ taxpayer: old, socialSecurity: [ss], retirement: [pension(80000)] }))
  assert.equal(high.res.f1040['6b'], 25500)
  assert.equal(high.mn.m['12'], 10200) // AGI 105,500: 6 steps of $4,000 → 60% cut
  assert.equal(high.mn.lines['4'], 16950) // one box: 65 or older
})

test('MN forms: every value lands on one field and the PDF builds', async () => {
  const w = w2(30000, 'spouse')
  const { mn: r, res, ret } = mn(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(5), kid(19, 'Ann Doe', { student: true })], itemized: { ...emptyReturn().itemized, charityCash: 1500 },
    refundDeposit: { routingNumber: '091000019', accountNumber: '12345', accountType: 'checking' } }),
  { w2: withheld(w, 900), birthDate: { taxpayer: '01/02/1985', spouse: '03/04/1986' }, county: 'St. Louis', campaignCode: { taxpayer: '99', spouse: '' }, usObligationInterest: 50 })
  const packet = buildMnPacket(ret, res, r)
  assert.deepEqual(packet.forms.map((x) => x.id), ['mnm1', 'mnm1m', 'mnm1ref', 'mnm1cwfc', 'mnm1dqc1', 'mnm1w'])
  assert.equal(r.m['11'], 500) // half of (1,500 − 500)
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes, problems: p2 } = await buildPdf(lib, packet.forms, load, '2025 MN')
  assert.deepEqual(p2, [])
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-MN.pdf`, bytes)
})
