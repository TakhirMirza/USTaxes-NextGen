/**
 * Fills the real 2025 California Form 540, Schedule CA (540), FTB 3514 and FTB 3506 and checks that
 * every mapped key matches exactly one field.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyProvider, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeCalifornia } from '../engine/ca2025.ts'
import { buildCaPacket } from './ca2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))

const family = (): TaxReturnInput => {
  const r = emptyReturn()
  const kid = { ...emptyDependent(), name: 'Mia Lopez', relationship: 'Daughter', age: 4, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }
  return {
    ...r, filingStatus: 'hoh', residentState: 'CA', unemployment: 1200,
    taxpayer: { ...r.taxpayer, firstName: 'Rosa M', lastName: 'Lopez', ssn: '123456789', age: 31 },
    contact: { ...r.contact, street: '1200 Main St', apt: 'Apt 4', city: 'Fresno', state: 'CA', zip: '937211234', phone: '559-555-0100', email: 'rosa@example.com' },
    dependents: [kid],
    w2s: [{ ...emptyW2('taxpayer'), employer: 'Acme', wages: 28800, socialSecurityWages: 28800, medicareWages: 28800, socialSecurityWithheld: 1786, medicareWithheld: 418 }],
    dependentCare: { expenses: 2500, employerBenefits: 0, providers: [{ ...emptyProvider(), name: 'Sunny Daycare', address: '50 Oak St, Fresno CA 93721', tin: '94-1234567', amountPaid: 2500 }] },
    refundDeposit: { routingNumber: '121000358', accountNumber: '998877', accountType: 'checking' },
    ca: { ...r.ca, birthDate: { taxpayer: '02/03/1994', spouse: '' }, county: 'Fresno', withholding: 300, rentedHome: true, stateRefundInFagi: 0, dependentBirthDates: { [kid.id]: '06/07/2021' } }
  }
}

test('Form 540, Schedule CA, FTB 3514 and FTB 3506: every key matches exactly one field', async () => {
  const ret = family()
  const res = computeReturn(ret)
  const ca = computeCalifornia(ret, res)
  const packet = buildCaPacket(ret, res, ca)
  assert.deepEqual(packet.forms.map((x) => x.id), ['ca540', 'ca540ca', 'ca3514', 'ca3506'])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const v = packet.forms[0].values
  assert.equal(v['540_form_1003'], 'ROSA')
  assert.equal(v['540_form_1004'], 'M')
  assert.equal(v['540_form_1024'], '02/03/1994')
  assert.equal(v['540_form_1020'], '93721-1234')
  assert.equal(v['540_form_1028'], 'FRESNO')
  assert.equal(v['540_form_2003'], 'MIA')
  assert.equal(v['540_form_2020'], '1200')
  assert.equal(v['540_form_3015'], String(ca.lines['75']))
  assert.equal(v['540_form_3016'], String(ca.lines['76']))
  assert.equal(v['540_form_3020 RB'], 'No use tax is owed.')
  assert.equal(v['540_form_5007'], String(ca.lines['115']))
  assert.equal(v['540_form_5009A CB'], true)
  const s = packet.forms[1].values
  assert.equal(s['540ca_form - 1069'], '1200')
  assert.equal(s['540ca_form - 4033'], '1200')
  const e = packet.forms[2].values
  assert.equal(e['3514_Form_1011'], '06/07/2021')
  assert.equal(e['3514_Form_2028'], String(ca.lines['75']))
  assert.equal(e['3514_Form_3012'], String(ca.lines['76']))
  assert.equal(e['3514_Form_3008'], '13') // (28,800 − 27,425) / 100 = 13.75
  assert.equal(e['3514_Form_3009'], '75')
  const c = packet.forms[3].values
  assert.equal(c['3506 - 1014'], 'SUNNY DAYCARE')
  assert.equal(c['3506 - 1055'], '50')
  assert.equal(c['3506 - 1058'], String(ca.lines['40']))
})

test('the California PDF builds', async () => {
  const ret = family()
  const res = computeReturn(ret)
  const { bytes, problems } = await buildPdf(lib, buildCaPacket(ret, res, computeCalifornia(ret, res)).forms, load, '2025 California Form 540')
  assert.deepEqual(problems, [])
  assert.equal((await lib.PDFDocument.load(bytes)).getPageCount(), 6 + 6 + 4 + 2)
  if (process.env.WRITE_PDF) await writeFile(process.env.WRITE_PDF, bytes)
})
