/**
 * Fills the real 2025 Georgia (Form 500, Schedule 1, IND-CR) and Ohio (IT 1040 and its schedules) PDFs and
 * checks that every mapped key matches exactly one field.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { empty1099R, emptyDependent, emptyK1, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeGeorgia } from '../engine/ga2025.ts'
import { computeOhio } from '../engine/oh2025.ts'
import { buildGaPacket } from './ga2025.ts'
import { buildOhPacket } from './oh2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))

const household = (state: 'GA' | 'OH'): TaxReturnInput => {
  const r = emptyReturn()
  const kid = { ...emptyDependent(), name: 'Ben Carter', relationship: 'Son', age: 9, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }
  const w2 = { ...emptyW2('spouse'), employer: 'Acme', wages: 42000, federalWithholding: 3100, socialSecurityWages: 42000, medicareWages: 42000, socialSecurityWithheld: 2604, medicareWithheld: 609 }
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'State Pension Fund', grossDistribution: 18000, taxableAmount: 18000, code: '7' }
  const k1 = { ...emptyK1('taxpayer'), kind: 'scorp' as const, entityName: 'Carter Design Inc', ein: '987654321', ordinary: 12000, materialParticipation: true }
  const base: TaxReturnInput = {
    ...r, filingStatus: 'mfj', residentState: state,
    taxpayer: { ...r.taxpayer, firstName: 'Ann L', lastName: 'Carter', ssn: '123456789', age: 66, age65OrOlder: true },
    spouse: { ...r.taxpayer, firstName: 'Bob', lastName: 'Carter', ssn: '987654321', age: 64 },
    contact: { ...r.contact, street: '5 Oak Ave', city: state === 'GA' ? 'Athens' : 'Columbus', state, zip: state === 'GA' ? '30601' : '43215', phone: '706-555-0100' },
    dependents: [kid], w2s: [w2], retirement: [pension], k1s: state === 'OH' ? [k1] : [],
    refundDeposit: { routingNumber: '061000104', accountNumber: '998877', accountType: 'checking' }
  }
  if (state === 'GA') return { ...base, ga: { ...base.ga, birthDate: { taxpayer: '02/14/1959', spouse: '06/30/1961' }, w2: { [w2.id]: { ein: '12-3456789', stateId: '1234567AB', stateIncome: null, stateTax: 1900 } }, usObligationInterest: 150, driversLicense: '123456789', driversLicenseState: 'GA', donations: { '32': 5 } } }
  return { ...base, oh: { ...base.oh, schoolDistrict: '2503', county: 'Franklin', w2: { [w2.id]: { ein: '12-3456789', stateId: '12345678', stateIncome: null, stateTax: 900 } }, r1099: { [pension.id]: { ein: '111111111', stateId: '22222222', stateIncome: null, stateTax: 300 } }, dependentBirthDates: { [kid.id]: '04/02/2016' }, contributions529: 2000, donations: { b: 10 } } }
}

const run = (state: 'GA' | 'OH') => {
  const ret = household(state)
  const res = computeReturn(ret)
  return state === 'GA' ? { ret, res, packet: buildGaPacket(ret, res, computeGeorgia(ret, res)) } : { ret, res, packet: buildOhPacket(ret, res, computeOhio(ret, res)) }
}

test('Georgia Form 500, Schedule 1 and IND-CR: every key matches exactly one field', async () => {
  const { packet } = run('GA')
  assert.deepEqual(packet.forms.map((x) => x.id), ['ga500', 'ga500s1'])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  assert.equal(packet.forms[0].values.L5_FILING_STATUS, 'B')
  assert.equal(packet.forms[0].values.TP_SSN, '123-45-6789')
})

test('Ohio IT 1040 and schedules: every key matches exactly one field', async () => {
  const { packet } = run('OH')
  assert.deepEqual(packet.forms.map((x) => x.id), ['oh1040', 'ohadj', 'ohbus', 'ohcred', 'ohdep', 'ohwh'])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  assert.equal(packet.forms[0].values.COUNTY, 'FRAN')
})

test('the GA and OH PDFs build', async () => {
  for (const state of ['GA', 'OH'] as const) {
    const { packet } = run(state)
    const { bytes, problems } = await buildPdf(lib, packet.forms, load, `2025 ${state}`)
    assert.deepEqual(problems, [])
    if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-${state}.pdf`, bytes)
  }
})
