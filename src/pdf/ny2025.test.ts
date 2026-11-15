/**
 * Fills the real 2025 New York Form IT-201, IT-213 and IT-215 and checks that every mapped key matches
 * exactly one field.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyProvider, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeNewYork } from '../engine/ny2025.ts'
import { buildNyPacket } from './ny2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))

const family = (): TaxReturnInput => {
  const r = emptyReturn()
  const kid = { ...emptyDependent(), name: 'Leo Rivera', relationship: 'Son', age: 3, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }
  return {
    ...r, filingStatus: 'hoh', residentState: 'NY',
    taxpayer: { ...r.taxpayer, firstName: 'Ana M', lastName: 'Rivera', ssn: '123456789', age: 30, occupation: 'Nurse aide' },
    contact: { ...r.contact, street: '200 W 100th St', apt: '5B', city: 'New York', state: 'NY', zip: '10025', phone: '212-555-0100', email: 'ana@example.com' },
    dependents: [kid],
    w2s: [{ ...emptyW2('taxpayer'), employer: 'Acme', wages: 24000, socialSecurityWages: 24000, medicareWages: 24000, socialSecurityWithheld: 1488, medicareWithheld: 348 }],
    dependentCare: { expenses: 3500, employerBenefits: 0, providers: [{ ...emptyProvider(), name: 'Little Steps Daycare', address: '10 W 104th St', tin: '13-1234567', amountPaid: 3500 }] },
    refundDeposit: { routingNumber: '021000021', accountNumber: '998877', accountType: 'checking' },
    ny: { ...r.ny, locality: 'nyc', county: 'New York', schoolDistrict: 'NYC', schoolDistrictCode: '441', birthDate: { taxpayer: '02/03/1995', spouse: '' }, withholding: 300, nycWithholding: 150, dependentBirthDates: { [kid.id]: '06/07/2022' } }
  }
}

test('IT-201, IT-213 and IT-215: every key matches exactly one field', async () => {
  const ret = family()
  const res = computeReturn(ret)
  const ny = computeNewYork(ret, res)
  const packet = buildNyPacket(ret, res, ny)
  assert.deepEqual(packet.forms.map((x) => x.id), ['nyit201', 'nyit213', 'nyit215', 'nyit216'])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const v = packet.forms[0].values
  assert.equal(v.TP_first_name, 'ANA')
  assert.equal(v.TP_MI, 'M')
  assert.equal(v.TP_DOB, '02031995')
  assert.equal(v.Filing_status, 'Head of Household (with qualifying person)')
  assert.equal(v.H_dependent_dob1, '06072022')
  assert.equal(v.Line33, String(ny.lines['33']))
  assert.equal(v.Line63, '1000')
  assert.equal(v.Line70, String(ny.lines['70']))
  assert.equal(v.Line78_refund, 'direct deposit')
  assert.ok(ny.lines['70'] > 0)
  const c = packet.forms[1].values
  assert.equal(c['Page 1 Zone 12'], '1')
  assert.equal(c['Page 1 Zone 47'], '1000')
  const e = packet.forms[2].values
  assert.equal(e['16 dollars15'], String(ny.lines['65']))
  assert.equal(e['27 dollars15'], String(ny.lines['70']))
  const k = packet.forms[3].values
  assert.equal(k['line 10'], '30')
  assert.equal(k['13 first number16'], '1.100')
  assert.equal(k['25 dollars16'], String(ny.lines['64']))
  assert.ok(ny.care.nycCredit > 0)
})

test('IT-270 and IT-196 fill', async () => {
  const r = family()
  const ret: TaxReturnInput = {
    ...r, w2s: [{ ...r.w2s[0], wages: 34000 }], dependentCare: { expenses: 0, employerBenefits: 0, providers: [] },
    dependents: [{ ...r.dependents[0], age: 10 }],
    itemized: { ...r.itemized, stateLocalIncomeOrSalesTax: 1500, realEstateTax: 9000, mortgageInterest: 9000, charityCash: 500 }
  }
  const res = computeReturn(ret)
  const ny = computeNewYork(ret, res)
  const packet = buildNyPacket(ret, res, ny)
  const ids = packet.forms.map((x) => x.id)
  assert.ok(ids.includes('nyit270'))
  assert.ok(ids.includes('nyit196'))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
})

test('the New York PDF builds', async () => {
  const ret = family()
  const res = computeReturn(ret)
  const { bytes, problems } = await buildPdf(lib, buildNyPacket(ret, res, computeNewYork(ret, res)).forms, load, '2025 New York Form IT-201')
  assert.deepEqual(problems, [])
  assert.equal((await lib.PDFDocument.load(bytes)).getPageCount(), 4 + 1 + 2 + 2)
  if (process.env.WRITE_PDF) await writeFile(process.env.WRITE_PDF, bytes)
})

test('married filing jointly: the filing status box whose state name has a curly apostrophe', async () => {
  const r = family()
  const ret: TaxReturnInput = { ...r, filingStatus: 'mfj', spouse: { ...r.taxpayer, firstName: 'Luis', ssn: '987654321' } }
  const res = computeReturn(ret)
  const problems: FillProblem[] = []
  const f = buildNyPacket(ret, res, computeNewYork(ret, res)).forms[0]
  await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
})
