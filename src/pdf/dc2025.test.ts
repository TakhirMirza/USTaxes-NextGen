/**
 * Fills the real DC 2025 Form D-40 and checks that every mapped key matches exactly one field.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeDc } from '../engine/dc2025.ts'
import { buildDcPacket } from './dc2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))

const renter = (): TaxReturnInput => {
  const r = emptyReturn()
  const kid = { ...emptyDependent(), name: 'Jo Brooks', relationship: 'Son', age: 8, ssn: '111223333' }
  return {
    ...r, filingStatus: 'hoh', residentState: 'DC',
    taxpayer: { ...r.taxpayer, firstName: 'Dana K', lastName: 'Brooks', ssn: '123456789', age: 34 },
    contact: { ...r.contact, street: '1400 U St NW', apt: 'Apt 5', city: 'Washington', state: 'DC', zip: '200091234', phone: '202-555-0199', email: 'dana@example.com' },
    dependents: [kid],
    w2s: [{ ...emptyW2('taxpayer'), employer: 'Acme', wages: 38000, socialSecurityWages: 38000, medicareWages: 38000, socialSecurityWithheld: 2356, medicareWithheld: 551 }],
    refundDeposit: { routingNumber: '054001725', accountNumber: '998877', accountType: 'checking' },
    dc: { ...r.dc, birthDate: { taxpayer: '02/03/1991', spouse: '' }, withholding: 1100, housing: 'rent', housingAmount: 16800, landlord: { ...r.dc.landlord, name: 'U Street Apartments LLC', street: '1400 U St NW', city: 'Washington', state: 'DC', zip: '20009', phone: '2025550100' }, dependentBirthDates: { [kid.id]: '06/07/2017' } }
  }
}

test('Form D-40: every key matches exactly one field, values in place', async () => {
  const ret = renter()
  const res = computeReturn(ret)
  const dc = computeDc(ret, res)
  const packet = buildDcPacket(ret, res, dc)
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const v = packet.forms[0].values
  assert.equal(v.FS, '8')
  assert.equal(v.fIRST_NAME, 'DANA')
  assert.equal(v.MI, 'K')
  assert.equal(v.Primary_DOB, '02031991')
  assert.equal(v.ZIP_1, '20009')
  assert.equal(v['ZIP plus 4'], '1234')
  assert.equal(v.DED_AMT, '22500')
  assert.equal(v.D40_Line_26d, String(Math.round(res.eic.credit)))
  assert.equal(v.PROP_TX_CR, String(dc.lines['28']))
  assert.equal(v.choice, '1')
  assert.deepEqual(packet.forms.map((x) => x.id), ['dc40', 'dcschs', 'dcschh'])
  const s = packet.forms[1].values
  assert.equal(s['FIRST NAME #1'], 'JO')
  assert.equal(s['DOB #1'], '06072017')
  assert.equal(s['G1-h'], '22500')
  const h = packet.forms[2].values
  assert.equal(h.A_TOTAL_RENT_PAID, '3360')
  assert.equal(h.A_TAX_CREDIT_ALLOW, String(dc.lines['28']))
  assert.equal(h.Landlord_Name, 'U STREET APARTMENTS LLC')
})

test('the DC PDF builds', async () => {
  const ret = renter()
  const res = computeReturn(ret)
  const { bytes, problems } = await buildPdf(lib, buildDcPacket(ret, res, computeDc(ret, res)).forms, load, '2025 DC Form D-40')
  assert.deepEqual(problems, [])
  assert.equal((await lib.PDFDocument.load(bytes)).getPageCount(), 3 + 2 + 2)
  if (process.env.WRITE_PDF) await writeFile(process.env.WRITE_PDF, bytes)
})
