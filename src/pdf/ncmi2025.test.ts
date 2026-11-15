/**
 * Fills the real 2025 North Carolina (D-400, Schedule S) and Michigan (MI-1040, Schedule 1, Form 4884,
 * MI-1040CR) PDFs and checks that every mapped key matches exactly one field.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeNorthCarolina } from '../engine/nc2025.ts'
import { computeMichigan } from '../engine/mi2025.ts'
import { buildNcPacket } from './nc2025.ts'
import { buildMiPacket } from './mi2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))

const household = (state: string): TaxReturnInput => {
  const r = emptyReturn()
  const kid = { ...emptyDependent(), name: 'Ben Carter', relationship: 'Son', age: 9, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }
  return {
    ...r, filingStatus: 'mfj', residentState: state,
    taxpayer: { ...r.taxpayer, firstName: 'Ann L', lastName: 'Carter', ssn: '123456789', age: 66 },
    spouse: { ...r.taxpayer, firstName: 'Bob', lastName: 'Carter', ssn: '987654321', age: 64 },
    contact: { ...r.contact, street: '5 Oak Ave', city: state === 'NC' ? 'Durham' : 'Lansing', state, zip: state === 'NC' ? '27701' : '48933', phone: '919-555-0100' },
    dependents: [kid],
    w2s: [{ ...emptyW2('spouse'), employer: 'Acme', wages: 42000, socialSecurityWages: 42000, medicareWages: 42000, socialSecurityWithheld: 2604, medicareWithheld: 609 }],
    retirement: [{ id: 'r', owner: 'taxpayer', payer: 'State Pension Fund', grossDistribution: 18000, taxableAmount: 18000, federalWithholding: 0, code: '7', ira: false, earlyExceptionCode: '', earlyExceptionAmount: 0 }],
    refundDeposit: { routingNumber: '053000196', accountNumber: '998877', accountType: 'checking' },
    nc: { ...r.nc, county: 'Durham', withholding: { taxpayer: 0, spouse: 1600 }, usObligationInterest: 200 },
    mi: { ...r.mi, schoolDistrictCode: '33020', withholding: 1500, birthYear: { taxpayer: 1959, spouse: 1961 }, housing: 'rent', rentPaid: 9600 }
  }
}

test('D-400 and Schedule S: every key matches exactly one field', async () => {
  const ret = household('NC')
  const res = computeReturn(ret)
  const nc = computeNorthCarolina(ret, res)
  const packet = buildNcPacket(ret, res, nc)
  assert.deepEqual(packet.forms.map((x) => x.id), ['ncd400', 'ncd400s'])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  assert.equal(packet.forms[0].values.y_d400wf_county, 'DURHA')
})

test('MI-1040, Schedule 1, 4884 and MI-1040CR: every key matches exactly one field', async () => {
  const ret = household('MI')
  const res = computeReturn(ret)
  const mi = computeMichigan(ret, res)
  const packet = buildMiPacket(ret, res, mi)
  assert.deepEqual(packet.forms.map((x) => x.id), ['mi1040', 'mischedule1', 'mi4884', 'mi1040cr'])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  assert.equal(mi.retirement.section, 'D')
  assert.equal(mi.retirement.deduction, 18000)
})

test('the NC and MI PDFs build', async () => {
  for (const state of ['NC', 'MI'] as const) {
    const ret = household(state)
    const res = computeReturn(ret)
    const forms = state === 'NC' ? buildNcPacket(ret, res, computeNorthCarolina(ret, res)).forms : buildMiPacket(ret, res, computeMichigan(ret, res)).forms
    const { bytes, problems } = await buildPdf(lib, forms, load, `2025 ${state}`)
    assert.deepEqual(problems, [])
    if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-${state}.pdf`, bytes)
  }
})
