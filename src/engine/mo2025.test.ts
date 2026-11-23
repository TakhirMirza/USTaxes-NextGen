/**
 * Missouri MO-1040 (2025), worked from the 2025 instructions: tax chart examples (page 21), the property tax credit
 * chart (pages 50–52) and MO-A Part 3.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyTransaction, emptyW2 } from './model.ts'
import type { MoInput, TaxReturnInput } from './model.ts'
import { computeMissouri, moPropertyTaxCredit, moTax } from './mo2025.ts'
import { buildMoPacket } from '../pdf/mo2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kai Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'MO',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '301 W High St', city: 'Jefferson City', state: 'MO', zip: '65101', phone: '573-555-0100' },
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<MoInput> = {}) => {
  const r = { ...ret, mo: { ...ret.mo, county: 'COLE', ...x } }
  const res = computeReturn(r)
  return { mo: computeMissouri(r, res), res, ret: r }
}

test('MO tax chart and property tax credit chart', () => {
  assert.equal(moTax(3090), 38)
  assert.equal(moTax(12000), 388)
  assert.equal(moTax(1313), 0)
  assert.equal(moPropertyTaxCredit(19360, 225), 8) // the chart’s worked example
  assert.equal(moPropertyTaxCredit(14450, 1100), 1078)
  assert.equal(moPropertyTaxCredit(23750, 1100), 613)
  assert.equal(moPropertyTaxCredit(28550, 1100), 231)
  assert.equal(moPropertyTaxCredit(12000, 600), 600)
  assert.equal(moPropertyTaxCredit(29000, 300), 0)
})

test('MO single W-2: federal tax deduction, standard deduction', () => {
  const w = w2(60000)
  const { mo, res } = run(base({ w2s: [w] }), { w2: { [w.id]: { ein: '43-1234567', stateId: '', stateIncome: null, stateTax: 1900 } } })
  const L = mo.lines
  assert.equal(L['6'], 60000)
  assert.equal(L['12'], 15)
  assert.equal(L['13'], Math.round(Math.round(res.f1040['22']) * 0.15))
  assert.equal(L['14'], 15750)
  assert.equal(mo.Y['30'], moTax(60000 - L['13'] - 15750))
  assert.equal(L['53'], 1900 - L['36'])
})

test('MO combined return: two columns taxed separately', () => {
  const { mo } = run(base({ filingStatus: 'mfj', w2s: [w2(70000), w2(30000, 'spouse')] }))
  assert.equal(mo.status, 'combined')
  assert.equal(mo.Y['1'], 70000)
  assert.equal(mo.S['1'], 30000)
  assert.equal(mo.Y['7'], 70)
  assert.equal(mo.S['7'], 30)
  assert.equal(mo.lines['14'], 31500)
  assert.equal(mo.Y['30'], moTax(mo.Y['29']))
  assert.equal(mo.lines['36'], mo.Y['35'] + mo.S['35'])
})

test('MO-A: capital gains subtracted, Social Security at 62, private pension', () => {
  const tx = { ...emptyTransaction(), term: 'long' as const, proceeds: 20000, costBasis: 5000 }
  const r0 = emptyReturn()
  const p = { ...empty1099R(), payer: 'Pension', grossDistribution: 9000, taxableAmount: 9000 }
  const ss = { ...emptySocialSecurity(), netBenefits: 24000 }
  const { mo, res } = run(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 66, age65OrOlder: true }, capitalTransactions: [tx], retirement: [p], socialSecurity: [ss] }))
  assert.equal(mo.a.Y['18'], 15000)
  assert.equal(mo.part3.C.Y['1'], Math.round(res.f1040['6b']))
  assert.equal(mo.part3.B['7Y'], 6000)
  assert.equal(mo.lines['8'], mo.part3.A.total + mo.part3.B['9'] + mo.part3.C.total)
})

test('MO-PTS renter and MO-WFTC', () => {
  const r0 = emptyReturn()
  const old = { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }
  const ss = { ...emptySocialSecurity(), netBenefits: 14000 }
  const { mo } = run(base({ taxpayer: old, socialSecurity: [ss] }), { pts: { ...r0.mo.pts, claim: true, qualification: 'A', owner: false, rent: 6000, rentPercent: 100 } })
  assert.equal(mo.crp!['9'], 1200)
  assert.equal(mo.pts!['12'], 750)
  assert.equal(mo.pts!['2'], 14000)
  assert.equal(mo.lines['43'], 750)
  const fam = run(base({ filingStatus: 'hoh', w2s: [w2(30000)], dependents: [kid(5)] }))
  assert.ok(fam.mo.wftc)
  assert.equal(fam.mo.lines['44'], Math.min(fam.mo.wftc!['6'], fam.mo.wftc!['9']))
})

test('MO-1040 packet: every value lands on one field and the PDF builds', async () => {
  const r0 = emptyReturn()
  const t = w2(70000)
  const tx = { ...emptyTransaction(), term: 'long' as const, proceeds: 12000, costBasis: 2000 }
  const { mo, res, ret } = run(base({ filingStatus: 'mfj', w2s: [t, w2(30000, 'spouse')], capitalTransactions: [tx], dependents: [kid(4)],
    refundDeposit: { ...r0.refundDeposit, routingNumber: '081000032', accountNumber: '123456789', accountType: 'checking' } }),
  { w2: { [t.id]: { ein: '43-1234567', stateId: '', stateIncome: null, stateTax: 5000 } }, tuition529: { taxpayer: 3000, spouse: 0 }, trustFunds: { a: 5, h: 2 },
    otherState: { state: 'KS', owner: 'spouse', income: 30000, tax: 900 }, birthDates: { taxpayer: '1/2/1985', spouse: '3/4/1986' } })
  const packet = buildMoPacket(ret, res, mo)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 4, 5, 6, 7, 11])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 MO')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-MO.pdf`, bytes)
})

test('MO-PTS packet with a renter fills MO-PTS and MO-CRP', async () => {
  const r0 = emptyReturn()
  const old = { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }
  const { mo, res, ret } = run(base({ taxpayer: old, socialSecurity: [{ ...emptySocialSecurity(), netBenefits: 14000 }], w2s: [w2(5000)] }),
    { pts: { ...r0.mo.pts, claim: true, qualification: 'A', owner: false, rent: 6000, rentPercent: 100, landlordName: 'Lee Apartments', landlordAddress: '1 Main St', landlordCity: 'Jefferson City', landlordState: 'MO', landlordZip: '65101', landlordPhone: '5735550199' } })
  const packet = buildMoPacket(ret, res, mo)
  assert.ok(packet.forms[0].pages!.includes(10))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await readFile(new URL(f.file, formsDir)), { ...f }, problems)
  assert.deepEqual(problems, [])
})

test('MO-TC: credits per column, limited to each person’s tax', async () => {
  const { mo, res, ret } = run(base({ filingStatus: 'mfj', w2s: [w2(70000), w2(30000, 'spouse')] }), {
    moTc: [
      { owner: 'taxpayer', benefit: 'ABC-2025-12345-123456', code: 'ATC', name: 'Adoption Tax Credit', amount: 500, refundable: false },
      { owner: 'spouse', benefit: '', code: 'NAC', name: 'Neighborhood Assistance', amount: 99999, refundable: false }
    ]
  })
  assert.equal(mo.moTc.line11[1], 500)
  assert.equal(mo.moTc.line12[2], mo.S['35'])
  assert.equal(mo.moTc.line13, Math.min(500, mo.Y['35']) + mo.S['35'])
  assert.equal(mo.lines['42'], mo.moTc.line13)
  const packet = buildMoPacket(ret, res, mo)
  const tc = packet.forms.find((f) => f.id === 'motc')!
  assert.equal(tc.values['Benefit Number1'], '123456')
  assert.equal(tc.values['Column 200'], '99999')
  const problems: FillProblem[] = []
  await fillForm(lib, await readFile(new URL('../../public/forms/2025/mo-tc.pdf', import.meta.url)), { ...tc }, problems)
  assert.deepEqual(problems, [])
  if (process.env.WRITE_PDF) {
    const { bytes } = await buildPdf(lib, [tc], (file: string) => readFile(new URL(`../../public/forms/2025/${file}`, import.meta.url)), '2025 MO-TC')
    await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-MOTC.pdf`, bytes)
  }
})
