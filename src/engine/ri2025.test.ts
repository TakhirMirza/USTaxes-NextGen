/**
 * Rhode Island RI-1040 (2025). Tax table rows from the 2025 RI tax table (all rows were compared with the rate schedule
 * while building); other amounts worked by hand from the 2025 instructions and worksheets.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { RiInput, TaxReturnInput } from './model.ts'
import { computeRhodeIsland, riFullRetirementAge, riPhaseout, riReliefPercent, riTax } from './ri2025.ts'
import { buildRiPacket } from '../pdf/ri2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kai Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'RI',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1 Capitol Hill', city: 'Providence', state: 'RI', zip: '02908', phone: '401-555-0100' },
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<RiInput> = {}) => {
  const r = { ...ret, ri: { ...ret.ri, ...x } }
  const res = computeReturn(r)
  return { ri: computeRhodeIsland(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '99-1234567', stateId: '123456789', stateIncome: null, stateTax: tax } })

test('RI tax table and computation worksheet', () => {
  assert.equal(riTax(25300), 950) // the table’s own example
  assert.equal(riTax(44000), 1651)
  assert.equal(riTax(30), 0)
  assert.equal(riTax(150000), 6326)
  assert.equal(riTax(200000), 8928.54)
})

test('RI standard deduction / exemption phase-out and other tables', () => {
  assert.equal(riPhaseout(254250), 1)
  assert.equal(riPhaseout(254251), 0.8)
  assert.equal(riPhaseout(254250 + 14500), 0.6)
  assert.equal(riPhaseout(254250 + 29000), 0.2)
  assert.equal(riPhaseout(254250 + 29001), 0)
  assert.equal(riReliefPercent(6990, 1), 0.03)
  assert.equal(riReliefPercent(15000, 1), 0.06)
  assert.equal(riReliefPercent(15000, 2), 0.05)
  assert.equal(riFullRetirementAge('03/01/1959', 66), true)
  assert.equal(riFullRetirementAge('03/02/1959', 66), false)
})

test('RI single W-2', () => {
  const w = w2(60000)
  const { ri } = run(base({ w2s: [w] }), { w2: withheld(w, 2000) })
  const L = ri.lines
  assert.equal(L['3'], 60000)
  assert.equal(L['4'], 10900)
  assert.equal(L['6'], 5100)
  assert.equal(L['7'], 44000)
  assert.equal(L['8'], 1651)
  assert.equal(L['17'], 349)
})

test('RI family: exemptions, 25% of the federal care credit, 16% EIC', () => {
  const { ri, res } = run(base({ filingStatus: 'mfj', w2s: [w2(25000), w2(15000, 'spouse')], dependents: [kid(3), kid(8, 'Lei Doe')], dependentCare: { expenses: 3000, employerBenefits: 0, providers: [] } }))
  const L = ri.lines
  assert.equal(ri.exemptions, 4)
  assert.equal(L['7'], 0) // 40,000 − 21,800 − 4 × 5,100 is below zero
  assert.equal(L['8'], 0)
  assert.ok(res.f1040['27a'] > 0)
  assert.equal(L['14d'], Math.round(res.f1040['27a'] * 16) / 100)
})

test('RI Schedule M: Social Security and up to $50,000 of pension at full retirement age', () => {
  const p = { ...empty1099R(), payer: 'Pension', grossDistribution: 60000, taxableAmount: 60000 }
  const ss = { ...emptySocialSecurity(), netBenefits: 30000 }
  const r0 = emptyReturn()
  const { ri, res } = run(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p], socialSecurity: [ss] }), { birthDates: { taxpayer: '05/06/1955', spouse: '' }, pensionKind: { [p.id]: 'pension' } })
  assert.ok(res.f1040['11a'] <= 107000)
  assert.equal(ri.m['1s'], Math.round(res.f1040['6b'] * 100) / 100)
  assert.equal(ri.m['1t'], 50000)
  assert.equal(ri.lines['2'], -(ri.m['1s'] + 50000))
})

test('RI Schedule II credit for tax paid to another state', () => {
  const { ri } = run(base({ w2s: [w2(80000)] }), { otherState: { state: 'MA', income: 20000, tax: 1500 } })
  const L = ri.lines
  assert.equal(L['26'], 0.25)
  assert.equal(L['27'], Math.round(L['23'] * 0.25 * 100) / 100)
  assert.equal(L['29'], Math.min(L['23'], L['27'], 1500))
})

test('RI-1040H property tax relief for a renter 65 or older', () => {
  const ss = { ...emptySocialSecurity(), netBenefits: 18000 }
  const r0 = emptyReturn()
  const { ri } = run(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, socialSecurity: [ss] }),
    { relief: { claim: true, owner: false, propertyTax: 0, rent: 9600, householdSize: 1, dependentsUnder18: 0, publicAssistance: 0, otherNontaxable: 0, disabled: false, landlord: '' } })
  const H = ri.h!
  assert.equal(H['32'], 18000)
  assert.equal(H['8'], 1920)
  assert.equal(H['10'], 1080)
  assert.equal(H['13'], 700)
  assert.equal(ri.lines['14c'], 700)
})

test('RI-1040 with Schedules W, E and M: every value lands on one field and the PDF builds', async () => {
  const a = w2(40000)
  const b = w2(30000, 'spouse')
  const deps = [kid(3), kid(8, 'Lei Doe')]
  const { ri, res, ret } = run(base({ filingStatus: 'mfj', w2s: [a, b], dependents: deps }), {
    w2: { ...withheld(a, 1200), ...withheld(b, 800) }, usObligationInterest: 150, tuition529: 2000, otherStateBondInterest: 75.5,
    dependentBirthDates: { [deps[0].id]: '1/2/2022', [deps[1].id]: '03/04/2017' }, checkoffs: { '34': 5 }, otherCredits: 100, driversLicense: { taxpayer: '1234567', spouse: '' }
  })
  const packet = buildRiPacket(ret, res, ri)
  assert.deepEqual(packet.forms.map((f) => f.id), ['ri1040', 'rischm', 'rischcr'])
  const v = packet.forms[0].values
  assert.equal(v['topmostSubform[0].Page1[0].StateFilingStatus_J[0]'], true)
  assert.equal(v['topmostSubform[0].Page5[0].SummaryLine5[0]'], '4')
  assert.equal(v['topmostSubform[0].Page5[0].DOB-1[0]'], '01/02/2022')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 RI')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-RI.pdf`, bytes)
})
