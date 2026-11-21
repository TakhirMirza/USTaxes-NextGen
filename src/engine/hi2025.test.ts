/**
 * Hawaii N-11 (2025). Tax table rows checked against the 2025 N-11 instructions (all 2,000 rows were compared while
 * building); credits worked by hand from HRS §235-55.85 (food/excise), Schedule X and HRS §235-55.75 (EITC, 40%).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyProvider, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { HiInput, TaxReturnInput } from './model.ts'
import { computeHawaii, hiCareDecimal, hiFoodCreditPer, hiTax } from './hi2025.ts'
import { buildHiPacket } from '../pdf/hi2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kai Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'HI',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '830 Punchbowl St', city: 'Honolulu', state: 'HI', zip: '96813', phone: '808-555-0100' },
    ...patch
  }
}
const hi = (ret: TaxReturnInput, x: Partial<HiInput> = {}) => {
  const r = { ...ret, hi: { ...ret.hi, ...x } }
  const res = computeReturn(r)
  return { hi: computeHawaii(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '99-1234567', stateId: 'WH-123-456-7890-01', stateIncome: null, stateTax: tax } })

test('HI tax table rows from the 2025 instructions', () => {
  // [row starts at, single/MFS, MFJ/QSS, HOH]
  const rows: [number, number, number, number][] = [[0, 0, 0, 0], [50, 1, 1, 1], [9600, 135, 135, 135], [24000, 861, 423, 565], [36000, 1677, 973, 1291], [48000, 2541, 1720, 2107], [61250, 3548, 2621, 3037], [99950, 6489, 5380, 5935]]
  for (const [x, s, j, h] of rows) {
    assert.equal(hiTax(x, 'single'), s, `single ${x}`)
    assert.equal(hiTax(x + 49, 'mfs'), s, `mfs ${x + 49}`)
    assert.equal(hiTax(x, 'mfj'), j, `mfj ${x}`)
    assert.equal(hiTax(x, 'hoh'), h, `hoh ${x}`)
  }
  // Rate schedule I above the table: $8,391 + 7.9% over $125,000.
  assert.equal(hiTax(150000, 'single'), Math.round(8391 + 25000 * 0.079))
})

test('HI credit tables', () => {
  assert.equal(hiFoodCreditPer(14999, 'single'), 220)
  assert.equal(hiFoodCreditPer(29999, 'mfj'), 140)
  assert.equal(hiFoodCreditPer(39999, 'single'), 110)
  assert.equal(hiFoodCreditPer(40000, 'single'), 0)
  assert.equal(hiFoodCreditPer(45000, 'hoh'), 90)
  assert.equal(hiFoodCreditPer(59999, 'mfj'), 70)
  assert.equal(hiFoodCreditPer(60000, 'mfj'), 0)
  assert.equal(hiCareDecimal(25000), 0.25)
  assert.equal(hiCareDecimal(25001), 0.24)
  assert.equal(hiCareDecimal(40000), 0.22)
  assert.equal(hiCareDecimal(50000), 0.2)
  assert.equal(hiCareDecimal(50001), 0.15)
})

test('HI single W-2', () => {
  const w = w2(60000)
  const { hi: r } = hi(base({ w2s: [w] }), { w2: withheld(w, 3000) })
  assert.equal(r.lines['20'], 60000)
  assert.equal(r.lines['23'], 4400)
  assert.equal(r.lines['25'], 1144)
  assert.equal(r.lines['26'], 54456)
  assert.equal(r.lines['27'], 3031) // row 54,450–54,500: 2,539 + 7.6% × 6,475
  assert.equal(r.lines['28'], 0)
  assert.equal(r.lines['36'], 3031)
  assert.equal(r.lines['49'], 31)
})

test('HI low-income family: food/excise, renters, child care and earned income credits', () => {
  const a = w2(15000)
  const b = w2(10000, 'spouse')
  const { hi: r, res } = hi(base({ filingStatus: 'mfj', w2s: [a, b], dependents: [kid(3), kid(8, 'Lei Doe')], dependentCare: { expenses: 4000, employerBenefits: 0, providers: [{ ...emptyProvider(), name: 'Keiki Care', address: '1 Main St, Honolulu HI 96813', tin: '991234567', amountPaid: 4000 }] } }), { rentPaid: 12000, rentExclusions: 600, w2: { ...withheld(a, 300), ...withheld(b, 100) } })
  assert.equal(r.lines['20'], 25000)
  assert.equal(r.lines['25'], 4 * 1144)
  assert.equal(r.lines['28ex'], 4)
  assert.equal(r.lines['28'], 4 * 140)
  assert.equal(r.x['7'], 11400)
  assert.equal(r.x['11'], 4)
  assert.equal(r.lines['29'], 200)
  assert.equal(r.x['22'], 4000)
  assert.equal(r.x['25'], 4000)
  assert.equal(r.x['27'], 0.25)
  assert.equal(r.lines['30'], 1000)
  assert.ok(res.f1040['27a'] > 0)
  assert.equal(r.lines['eitc'], Math.round(res.f1040['27a'] * 0.4))
  assert.equal(r.lines['33'], 560 + 200 + 1000 + r.lines['eitc'])
  assert.equal(r.lines['47a'], r.lines['41'] - r.lines['36'])
})

test('HI child care with dependent care benefits (Section B)', () => {
  const a = w2(70000)
  const { hi: r } = hi(base({ filingStatus: 'hoh', w2s: [a], dependents: [kid(4)], dependentCare: { expenses: 9000, employerBenefits: 3000, providers: [] } }))
  assert.equal(r.x['B15'], 3000)
  assert.equal(r.x['B19'], 7000)
  assert.equal(r.x['B20'], 6000)
  assert.equal(r.x['22'], 6000)
  assert.equal(r.x['27'], 0.15)
  assert.equal(r.lines['30'], 900)
})

test('HI retiree: Social Security and an employer pension are subtracted; 65+ exemptions', () => {
  const p = { ...empty1099R(), payer: 'ERS of Hawaii', grossDistribution: 30000, taxableAmount: 30000 }
  const ira = { ...empty1099R(), payer: 'Broker', grossDistribution: 10000, taxableAmount: 10000, ira: true }
  const ss = { ...emptySocialSecurity(), netBenefits: 24000 }
  const r0 = emptyReturn()
  const { hi: r, res } = hi(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p, ira], socialSecurity: [ss] }), { retirementKind: { [p.id]: 'employer' } })
  assert.equal(r.lines['13'], 30000)
  assert.equal(r.lines['14'], Math.round(res.f1040['6b']))
  assert.equal(r.lines['20'], r.lines['7'] - 30000 - r.lines['14'])
  assert.equal(r.exemptions.e, 2)
  assert.equal(r.lines['25'], 2288)
})

test('HI disability exemption and contributions', () => {
  const w = w2(40000)
  const { hi: r } = hi(base({ w2s: [w] }), { w2: withheld(w, 3000), disabled: { taxpayer: true, spouse: false }, schools: { taxpayer: true, spouse: false }, libraries: { taxpayer: true, spouse: false } })
  assert.equal(r.lines['25'], 7000)
  assert.equal(r.lines['44'], 7)
  assert.equal(r.lines['45'], r.lines['42'] - 7)
})

test('HI dependent filer: no exemption, limited standard deduction, no food credit', () => {
  const { hi: r } = hi(base({ canBeClaimedAsDependent: true, w2s: [w2(3000)] }))
  assert.equal(r.lines['23'], 3000)
  assert.equal(r.lines['25'], 0)
  assert.equal(r.lines['28'], 0)
  assert.equal(r.dependentBox, true)
})

test('N-11 with Schedules CR and X: every value lands on one field and the PDF builds', async () => {
  const a = w2(15000)
  const b = w2(10000, 'spouse')
  const { hi: r, res, ret } = hi(base({ filingStatus: 'mfj', w2s: [a, b], dependents: [kid(3), kid(8, 'Lei Doe')], dependentCare: { expenses: 4000, employerBenefits: 0, providers: [{ ...emptyProvider(), name: 'Keiki Care', address: '1 Main St, Honolulu HI 96813', tin: '991234567', amountPaid: 4000 }] } }), { rentPaid: 12000, rentExclusions: 600, rentalAddress: '830 Punchbowl St Apt 5', w2: { ...withheld(a, 300), ...withheld(b, 100) }, carSeats: 1, violence: { taxpayer: true, spouse: false }, electionFund: { taxpayer: true, spouse: true }, occupation: { taxpayer: 'Teacher', spouse: 'Nurse' } })
  const packet = buildHiPacket(ret, res, r)
  assert.deepEqual(packet.forms.map((f) => f.id), ['hin11'])
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 4, 7, 8])
  assert.equal(packet.forms[0].values['SCHX-26'], '200')
  assert.equal(packet.forms[0].values['SCHX-78'], '.25')
  assert.equal(packet.forms[0].values['CR8'], String(r.lines['eitc']))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 HI')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-HI.pdf`, bytes)
})

test('N-11 negative AGI goes in the minus box', () => {
  const { hi: r, res, ret } = hi(base({ w2s: [w2(5000)] }), { wageDifference: -8000 })
  assert.equal(r.lines['20'], -3000)
  const v = buildHiPacket(ret, res, r).forms[0].values
  assert.equal(v['20_neg'], '-')
  assert.equal(v['20'], '3000')
})
