/**
 * Maine Form 1040ME (2025). Tax table rows from the 2025 Maine income tax table (all 1,000 rows were compared with the
 * rate schedules while building); other amounts worked by hand from the 2025 instructions and worksheets.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { MeInput, TaxReturnInput } from './model.ts'
import { computeMaine, meSalesTaxCredit, meTax } from './me2025.ts'
import { buildMePacket } from '../pdf/me2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kai Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'ME',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '24 State House Sta', city: 'Augusta', state: 'ME', zip: '04333', phone: '207-555-0100' },
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<MeInput> = {}) => {
  const r = { ...ret, me: { ...ret.me, ...x } }
  const res = computeReturn(r)
  return { me: computeMaine(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '99-1234567', stateId: '1234567', stateIncome: null, stateTax: tax } })

test('ME tax table and rate schedules', () => {
  // [row starts at, single/MFS, MFJ/QSS, HOH] from the 2025 tax table.
  const rows: [number, number, number, number][] = [[100, 9, 9, 9], [7000, 409, 409, 409], [26900, 1564, 1563, 1563], [27000, 1571, 1569, 1569], [28000, 1638, 1627, 1627], [35000, 2111, 2033, 2033], [42000, 2583, 2439, 2457], [47000, 2921, 2729, 2794]]
  for (const [x, s, j, h] of rows) {
    assert.equal(meTax(x, 'single'), s, `single ${x}`)
    assert.equal(meTax(x + 99, 'mfs'), s, `mfs ${x + 99}`)
    assert.equal(meTax(x, 'mfj'), j, `mfj ${x}`)
    assert.equal(meTax(x, 'hoh'), h, `hoh ${x}`)
  }
  assert.equal(meTax(30, 'single'), 0)
  assert.equal(meTax(75, 'single'), 3)
  assert.equal(meTax(100000, 'mfj'), 3109 + Math.round(46400 * 0.0675))
  assert.equal(meTax(200000, 'single'), Math.round(4028 + (200000 - 63450) * 0.0715))
})

test('ME sales tax fairness credit tables', () => {
  assert.equal(meSalesTaxCredit(25450, 'single', 0), 155)
  assert.equal(meSalesTaxCredit(27451, 'single', 0), 105)
  assert.equal(meSalesTaxCredit(32950, 'single', 0), 5)
  assert.equal(meSalesTaxCredit(32951, 'single', 0), 0)
  assert.equal(meSalesTaxCredit(59900, 'mfj', 3), 100) // the instructions’ example
  assert.equal(meSalesTaxCredit(50950, 'mfj', 1), 250)
  assert.equal(meSalesTaxCredit(63950, 'mfj', 2), 20)
  assert.equal(meSalesTaxCredit(47500, 'hoh', 1), 20)
  assert.equal(meSalesTaxCredit(47500, 'hoh', 2), 55)
  assert.equal(meSalesTaxCredit(47500, 'hoh', 3), 85)
  assert.equal(meSalesTaxCredit(51701, 'hoh', 3), 0)
  assert.equal(meSalesTaxCredit(20000, 'mfs', 0), 0)
})

test('ME single W-2', () => {
  const w = w2(60000)
  const { me } = run(base({ w2s: [w] }), { w2: withheld(w, 2500) })
  const L = me.lines
  assert.equal(L['16'], 60000)
  assert.equal(L['17'], 15000)
  assert.equal(L['18'], 5150)
  assert.equal(L['19'], 39850)
  assert.equal(L['20'], 2435) // 1,554 + 6.75% × (39,850 − 26,800)
  assert.equal(L['25e'], 0)
  assert.equal(L['34b'], 65)
})

test('ME family renting: dependent exemption, EITC, property and sales tax fairness credits', () => {
  const a = w2(25000)
  const b = w2(15000, 'spouse')
  const { me, res } = run(base({ filingStatus: 'mfj', w2s: [a, b], dependents: [kid(3), kid(8, 'Lei Doe')] }), { rentPaid: 12000, landlord: 'Main St Apts 207-555-0199' })
  const L = me.lines
  assert.equal(L['19'], 0)
  assert.equal(L['20'], 0)
  assert.equal(me.sa['1'], 915) // $610 under six + $305
  assert.ok(res.f1040['27a'] > 0)
  assert.equal(me.sa['4'], Math.round(res.f1040['27a'] * 0.25))
  assert.equal(me.ptfc['3'], 40000)
  assert.equal(me.ptfc['6'], 1800)
  assert.equal(me.ptfc['8'], 4050)
  assert.equal(me.ptfc['10'], 1600)
  assert.equal(me.ptfc['16'], 200)
  assert.equal(me.ptfc['17'], 280)
  assert.equal(L['34b'], me.sa['9'] + 200 + 280)
})

test('ME dependent exemption credit phase-out: $20 per $500 above $150,000 joint', () => {
  const { me } = run(base({ filingStatus: 'mfj', w2s: [w2(160000)], dependents: [kid(3), kid(8, 'Lei Doe')] }))
  assert.equal(me.lines['16'], 160000)
  assert.equal(me.sa['1'], 915 - 20 * 20)
})

test('ME retiree: Social Security subtraction and pension income deduction', () => {
  const p = { ...empty1099R(), payer: 'Pension Plan', grossDistribution: 30000, taxableAmount: 30000 }
  const ss = { ...emptySocialSecurity(), netBenefits: 20000 }
  const r0 = emptyReturn()
  const { me, res } = run(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p], socialSecurity: [ss] }), { pensionKind: { [p.id]: 'eligible' } })
  const P = me.pension.taxpayer
  assert.equal(P['P1'], 30000)
  assert.equal(P['P3'], 20000)
  assert.equal(P['P4'], 28216)
  assert.equal(P['P10'], 28216)
  assert.equal(me.s1s['3'], Math.round(res.f1040['6b']))
  assert.equal(me.s1s['27'], me.s1s['3'] + 28216)
  assert.equal(me.lines['17'], 17000)
})

test('ME military retirement is subtracted in full', () => {
  const p = { ...empty1099R(), payer: 'DFAS', grossDistribution: 40000, taxableAmount: 40000 }
  const { me } = run(base({ retirement: [p] }), { pensionKind: { [p.id]: 'military' } })
  assert.equal(me.s1s['4'], 40000)
  assert.equal(me.military, true)
})

test('ME Schedule 2 itemized deduction and the deduction phase-out', () => {
  const r0 = emptyReturn()
  const { me, res } = run(base({ w2s: [w2(150000)], itemized: { ...r0.itemized, mortgageInterest: 20000, stateLocalIncomeOrSalesTax: 9000, realEstateTax: 5000, charityCash: 5000 } }))
  assert.equal(res.deduction.used, 'itemized')
  const s2 = me.s2!
  assert.equal(s2['1'], 39000)
  assert.equal(s2['2a'], 14000)
  assert.equal(s2['3e'], 5000)
  assert.equal(s2['7'], 30000)
  assert.equal(me.itemize, true)
  assert.equal(me.deductionRatio, 0.6667)
  assert.equal(me.lines['17'], 30000 - 20001)
})

test('Form 1040ME with schedules: every value lands on one field and the PDF builds', async () => {
  const a = w2(25000)
  const b = w2(15000, 'spouse')
  const p = { ...empty1099R(), payer: 'Pension Plan', grossDistribution: 6000, taxableAmount: 6000 }
  const { me, res, ret } = run(base({ filingStatus: 'mfj', w2s: [a, b], dependents: [kid(3), kid(8, 'Lei Doe')], retirement: [p], refundDeposit: { ...emptyReturn().refundDeposit, routingNumber: '123456780', accountNumber: '000123456789', accountType: 'checking' } }), {
    w2: { ...withheld(a, 500), ...withheld(b, 200) }, pensionKind: { [p.id]: 'eligible' }, otherStateBondInterest: 100, rentPaid: 12000, rentIncludesUtilities: true,
    landlord: 'Main St Apts 207-555-0199', birthDates: { taxpayer: '01/02/1985', spouse: '3/4/1986' }, cleanElection: { taxpayer: true, spouse: false }, star5Expenses: 0
  })
  const packet = buildMePacket(ret, res, me)
  assert.deepEqual(packet.forms.map((f) => f.id), ['me1040', 'me1a', 'me1s', 'mescha', 'meptfc'])
  const v = packet.forms[0].values
  assert.equal(v['Form 1040ME Your social security number'], '123 45 6789')
  assert.equal(v['radStatus'], '#1')
  assert.equal(v['Form 1040ME Home phone number'], '555 0100')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 ME')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-ME.pdf`, bytes)
})
