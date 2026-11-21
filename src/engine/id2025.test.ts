/**
 * Idaho Form 40 (2025), worked by hand from the 2025 Form 40 / 39R instructions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { IdInput, TaxReturnInput } from './model.ts'
import { computeIdaho, idFilingThreshold, idTax } from './id2025.ts'
import { buildIdPacket } from '../pdf/id2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kai Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'ID',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '800 Park Blvd', city: 'Boise', state: 'ID', zip: '83712', phone: '208-555-0100' },
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<IdInput> = {}) => {
  const r = { ...ret, id: { ...ret.id, ...x } }
  const res = computeReturn(r)
  return { id: computeIdaho(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '99-1234567', stateId: '000123456', stateIncome: null, stateTax: tax } })

test('ID tax worksheet and filing thresholds', () => {
  assert.equal(idTax(4811, 'single'), 0)
  assert.equal(idTax(44250, 'single'), 2090) // (44,250 − 4,811) × 5.3% = 2,090.27
  assert.equal(idTax(48500, 'mfj'), 2061) // (48,500 − 9,622) × 5.3% = 2,060.53
  assert.equal(idTax(48500, 'hoh'), 2061)
  assert.equal(idTax(9000, 'mfs'), 222)
  assert.equal(idFilingThreshold('mfj', 1), 33100)
  assert.equal(idFilingThreshold('single', 1), 17750)
  assert.equal(idFilingThreshold('hoh', 0), 23625)
})

test('ID single W-2: standard deduction, $10 PBF, food tax credit', () => {
  const w = w2(60000)
  const { id } = run(base({ w2s: [w] }), { w2: withheld(w, 2500) })
  const L = id.lines
  assert.equal(L['11'], 60000)
  assert.equal(L['16'], 15750)
  assert.equal(L['19'], 44250)
  assert.equal(L['20'], 2090)
  assert.equal(L['31'], 10)
  assert.equal(L['32'], 2100)
  assert.equal(L['43'], 155)
  assert.equal(L['50'], 2655)
  assert.equal(L['56'], 555)
})

test('ID joint with two children: child tax credit and food credit for four', () => {
  const a = w2(50000)
  const b = w2(30000, 'spouse')
  const { id } = run(base({ filingStatus: 'mfj', w2s: [a, b], dependents: [kid(3), kid(8, 'Lei Doe')] }))
  const L = id.lines
  assert.equal(L['19'], 48500)
  assert.equal(L['20'], 2061)
  assert.equal(id.qualifyingChildren, 2)
  assert.equal(L['24'], 410)
  assert.equal(L['26'], 1651)
  assert.equal(L['32'], 1661)
  assert.equal(id.household.d, 4)
  assert.equal(L['43'], 620)
  assert.equal(L['54'], 1661 - 620)
})

test('ID retiree: Social Security out, military retirement deduction, 65+ standard deduction', () => {
  const p = { ...empty1099R(), payer: 'DFAS', grossDistribution: 30000, taxableAmount: 30000 }
  const ss = { ...emptySocialSecurity(), netBenefits: 20000 }
  const r0 = emptyReturn()
  const { id, res } = run(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 68, age65OrOlder: true }, retirement: [p], socialSecurity: [ss] }), { retirementKind: { [p.id]: 'military' } })
  const S = id.s39
  assert.equal(S['B7'], Math.round(res.f1040['6b']))
  assert.equal(S['B8a'], 48216)
  assert.equal(S['B8c'], 20000)
  assert.equal(S['B8d'], 28216)
  assert.equal(S['B8e'], 30000)
  assert.equal(S['B8f'], 28216)
  assert.equal(id.lines['16'], 17750)
  assert.equal(id.lines['10'], S['B7'] + 28216)
})

test('ID qualified civil service pension needs 65+ (or 62 and disabled)', () => {
  const p = { ...empty1099R(), payer: 'OPM CSRS', grossDistribution: 20000, taxableAmount: 20000 }
  const young = run(base({ retirement: [p] }), { retirementKind: { [p.id]: 'qualified' } })
  assert.equal(young.id.s39['B8f'], 0)
  const r0 = emptyReturn()
  const disabled = run(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 63 }, retirement: [p] }), { retirementKind: { [p.id]: 'qualified' }, disabled: { taxpayer: true, spouse: false } })
  assert.equal(disabled.id.s39['B8f'], 20000)
})

test('ID itemized: Schedule A total less state income tax (line 14)', () => {
  const a = w2(200000)
  const r0 = emptyReturn()
  const { id, res } = run(base({ filingStatus: 'mfj', w2s: [a], itemized: { ...r0.itemized, mortgageInterest: 25000, stateLocalIncomeOrSalesTax: 9000, realEstateTax: 6000, charityCash: 5000 } }))
  assert.equal(res.deduction.used, 'itemized')
  assert.equal(id.lines['13'], Math.round(res.scheduleA.total))
  assert.equal(id.lines['14'], 9000)
  assert.equal(id.lines['15'], id.lines['13'] - 9000)
  assert.equal(id.itemize, true)
})

test('ID child care subtraction is limited to $12,000', () => {
  const { id } = run(base({ filingStatus: 'hoh', w2s: [w2(50000)], dependents: [kid(4)], dependentCare: { expenses: 15000, employerBenefits: 0, providers: [] } }))
  assert.equal(id.s39['B6'], 12000)
  assert.equal(id.lines['16'], 23625)
})

test('ID dependent filer: limited standard deduction, no food credit, no PBF under the requirement', () => {
  const { id } = run(base({ canBeClaimedAsDependent: true, w2s: [w2(3000)] }))
  assert.equal(id.lines['16'], 3450)
  assert.equal(id.household.a, 0)
  assert.equal(id.lines['43'], 0)
  assert.equal(id.lines['31'], 0)
  assert.equal(id.pbfWaived, true)
})

test('ID credit for tax paid to another state and food credit donation', () => {
  const w = w2(80000)
  const { id } = run(base({ w2s: [w] }), { otherState: { name: 'Oregon', income: 20000, tax: 2000 }, donateFoodCredit: true, donations: { '39': 5 } })
  const S = id.s39
  assert.equal(S['C1'], id.lines['20'])
  assert.equal(S['C5'], Math.round(id.lines['20'] * 0.25))
  assert.equal(id.lines['21'], Math.min(S['C5'], 2000))
  assert.equal(id.lines['43'], 0)
  assert.equal(id.lines['43calc'], 155)
  assert.equal(id.lines['41'], id.lines['32'] + 5)
})

test('Form 40 and Form 39R: every value lands on one field and the PDF builds', async () => {
  const a = w2(50000)
  const b = w2(30000, 'spouse')
  const p = { ...empty1099R(), owner: 'spouse' as const, payer: 'DFAS', grossDistribution: 12000, taxableAmount: 12000 }
  const deps = [kid(3), kid(8, 'Lei Doe'), kid(10, 'Ana Doe'), kid(12, 'Bo Doe'), kid(14, 'Cy Doe')]
  const { id, res, ret } = run(base({ filingStatus: 'mfj', w2s: [a, b], dependents: deps, retirement: [p], refundDeposit: { ...emptyReturn().refundDeposit, routingNumber: '123456780', accountNumber: '000123456789', accountType: 'checking' } }), {
    w2: { ...withheld(a, 3000), ...withheld(b, 1500) }, retirementKind: { [p.id]: 'military' }, dependentBirthDates: Object.fromEntries(deps.map((x) => [x.id, '01/15/2015'])),
    otherStateBondInterest: 300, usObligationInterest: 200, collegeSavings: 2000, homeMembers: [{ name: 'Rosa Doe', ssn: '555667777', relationship: 'Mother', birthDate: '03/04/1950', disabled: false }],
    otherState: { name: 'Utah', income: 10000, tax: 400 }, donations: { '33': 10 }
  })
  const packet = buildIdPacket(ret, res, id)
  assert.deepEqual(packet.forms.map((f) => f.id), ['id40', 'id39r'])
  const v40 = packet.forms[0].values
  assert.equal(v40['6dTotalHousehold'], '7')
  assert.equal(v40['DirectDepositL57Route 2'], '1')
  assert.equal(v40['DirectDepositL57Acct13'], '9')
  const v39 = packet.forms[1].values
  assert.equal(v39['FR1FirstName'], 'CY')
  assert.equal(v39['EL4'], '100')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 ID')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-ID.pdf`, bytes)
})
