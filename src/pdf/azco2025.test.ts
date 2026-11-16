/**
 * Arizona Form 140 and Colorado DR 0104 packets: every value lands on exactly one field of the official PDFs.
 * WRITE_PDF=/tmp/x npm test writes the filled PDFs for a visual check.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeArizona } from '../engine/az2025.ts'
import { computeColorado } from '../engine/co2025.ts'
import { buildAzPacket } from './az2025.ts'
import { buildCoPacket } from './co2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))

const household = (state: 'AZ' | 'CO'): TaxReturnInput => {
  const r = emptyReturn()
  const kids = [
    { ...emptyDependent(), name: 'Ben Carter', relationship: 'Son', age: 4, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true },
    { ...emptyDependent(), name: 'Amy Carter', relationship: 'Daughter', age: 9, ssn: '111223334', monthsLivedWithYou: 12, childRelationship: true },
    { ...emptyDependent(), name: 'Cal Carter', relationship: 'Son', age: 12, ssn: '111223335', monthsLivedWithYou: 12, childRelationship: true },
    { ...emptyDependent(), name: 'Dee Carter', relationship: 'Daughter', age: 18, ssn: '111223336', monthsLivedWithYou: 12, childRelationship: true, student: true }
  ]
  const w2 = { ...emptyW2('spouse'), employer: 'Acme', wages: 52000, federalWithholding: 2100, socialSecurityWages: 52000, medicareWages: 52000, socialSecurityWithheld: 3224, medicareWithheld: 754 }
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'State Pension Fund', grossDistribution: 18000, taxableAmount: 18000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 14000 }
  const base: TaxReturnInput = {
    ...r, filingStatus: 'mfj', residentState: state,
    taxpayer: { ...r.taxpayer, firstName: 'Ann L', lastName: 'Carter', ssn: '123456789', age: 66, age65OrOlder: true },
    spouse: { ...r.taxpayer, firstName: 'Bob', lastName: 'Carter', ssn: '987654321', age: 50 },
    contact: { ...r.contact, street: '5 Oak Ave', apt: '2', city: state === 'AZ' ? 'Tempe' : 'Denver', state, zip: state === 'AZ' ? '85281' : '80202', phone: '480-555-0100' },
    dependents: kids, w2s: [w2], retirement: [pension], socialSecurity: [ss],
    itemized: { ...r.itemized, charityCash: 900 },
    dependentCare: { expenses: 2500, employerBenefits: 0, providers: [] },
    refundDeposit: { routingNumber: '061000104', accountNumber: '998877', accountType: 'checking' }
  }
  const stmt = { [w2.id]: { ein: '12-3456789', stateId: '', stateIncome: null, stateTax: 1500 } }
  if (state === 'AZ') return { ...base, az: { ...base.az, w2: stmt, governmentPension: { taxpayer: 18000, spouse: 0 }, contributions529: 3000, otherSubtractions: 200, donations: { '65': 10 } } }
  return { ...base, co: { ...base.co, w2: stmt, birthDate: { taxpayer: '02/14/1959', spouse: '06/30/1975' }, idState: { taxpayer: 'CO', spouse: 'CO' }, idLast4: { taxpayer: '1234', spouse: '5678' }, idIssued: { taxpayer: '01/02/2022', spouse: '03/04/2023' }, collegeInvest: 1000, usObligationInterest: 120 } }
}

const run = (state: 'AZ' | 'CO') => {
  const ret = household(state)
  const res = computeReturn(ret)
  return state === 'AZ' ? { ret, res, packet: buildAzPacket(ret, res, computeArizona(ret, res)) } : { ret, res, packet: buildCoPacket(ret, res, computeColorado(ret, res)) }
}

test('Arizona Form 140: every key matches exactly one field', async () => {
  const { packet } = run('AZ')
  assert.deepEqual(packet.forms.map((x) => x.id), ['az140'])
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 5])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  assert.equal(packet.forms[0].values['Filing Status'], 'Married Filing Joint Return')
  assert.equal(packet.forms[0].values['Dependents Under age of 17'], '3')
  assert.equal(packet.forms[0].values['Dependents Age 17 and over'], '1')
  assert.equal(packet.forms[0].values['10f_10b check box'], true)
})

test('Colorado DR 0104, 0104AD and 0104CR: every key matches exactly one field', async () => {
  const { packet } = run('CO')
  assert.deepEqual(packet.forms.map((x) => x.id), ['co104', 'co104ad', 'co104cr', 'co104cn'])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  assert.equal(packet.forms[0].values['C6 - Qualifying Child 1'], true)
  assert.equal(packet.forms[0].values['C6 - Qualifying Child 4'], false)
  assert.equal(packet.forms[0].values['Year of Birth Dependent 1'], '2021')
})

test('the AZ and CO PDFs build', async () => {
  for (const state of ['AZ', 'CO'] as const) {
    const { packet } = run(state)
    const { bytes, problems } = await buildPdf(lib, packet.forms, load, `2025 ${state}`)
    assert.deepEqual(problems, [])
    if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-${state}.pdf`, bytes)
  }
})

test('Colorado DR 0347 is filled when AGI is $60,000 or less', async () => {
  const r = household('CO')
  const ret: TaxReturnInput = { ...r, retirement: [], socialSecurity: [], w2s: [{ ...r.w2s[0], wages: 30000, socialSecurityWages: 30000, medicareWages: 30000 }, { ...emptyW2('taxpayer'), employer: 'Shop', wages: 15000, socialSecurityWages: 15000, medicareWages: 15000 }],
    taxpayer: { ...r.taxpayer, age: 40, age65OrOlder: false },
    dependentCare: { expenses: 2500, employerBenefits: 0, providers: [{ id: 'p1', name: 'Little Sprouts LLC', address: '9 Elm St, Denver CO 80202', tin: '841234567', householdEmployee: false, amountPaid: 2500 }] } }
  const res = computeReturn(ret)
  const co = computeColorado(ret, res)
  const packet = buildCoPacket(ret, res, co)
  assert.ok(packet.forms.some((x) => x.id === 'co0347'))
  assert.equal(co.cr['2'], Math.round(res.schedule3.dependentCare * 0.5))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 CO care')
  if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-CO-care.pdf`, bytes)
})
