/**
 * Fills the real Maryland 2025 PDFs (Form 502, 502B, 502SU) and checks that every mapped key matches
 * exactly one field and that the values land where the form expects them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyMdEntry, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeMaryland } from '../engine/md2025.ts'
import { buildMarylandPacket } from './md2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
const w2 = (owner: 'taxpayer' | 'spouse', wages: number) => ({
  ...emptyW2(owner), employer: 'Acme', wages, federalWithholding: wages * 0.1, socialSecurityWages: wages, socialSecurityWithheld: wages * 0.062, medicareWages: wages, medicareWithheld: wages * 0.0145
})

const family = (): TaxReturnInput => {
  const r = emptyReturn()
  const kid = { ...emptyDependent(), name: 'Mia Lopez', relationship: 'Daughter', age: 7, ssn: '111223333' }
  return {
    ...r, filingStatus: 'mfj', residentState: 'MD',
    taxpayer: { ...r.taxpayer, firstName: 'Ana M', lastName: 'Lopez', ssn: '123456789', age: 41 },
    spouse: { ...r.spouse, firstName: 'Luis', lastName: 'Lopez', ssn: '987654321', age: 43 },
    contact: { ...r.contact, street: '5 Elm Ct', apt: '', city: 'Rockville', state: 'MD', zip: '20850', phone: '301-555-0100', email: 'ana@example.com' },
    dependents: [kid],
    w2s: [w2('taxpayer', 70000), w2('spouse', 45000)],
    refundDeposit: { routingNumber: '052001633', accountNumber: '12345678', accountType: 'checking' },
    maryland: {
      ...r.maryland, subdivisionCode: '1609', subdivisionName: 'City of Rockville', withholding: 7000, usObligationInterest: 300,
      subtractions: [{ ...emptyMdEntry('xb'), amount: 2500 }], dependentBirthDates: { [kid.id]: '03/04/2018' }
    }
  }
}

async function filled(ret: TaxReturnInput) {
  const res = computeReturn(ret)
  const md = computeMaryland(ret, res)
  const packet = buildMarylandPacket(ret, res, md)
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  return { res, md, packet, problems }
}

test('Form 502, 502B and 502SU: every key matches exactly one field', async () => {
  const { packet, problems } = await filled(family())
  assert.deepEqual(packet.forms.map((f) => f.id), ['md502', 'md502b', 'md502su'])
  assert.deepEqual(problems, [])
})

test('Form 502 values', async () => {
  const { md, packet } = await filled(family())
  const v = packet.forms[0].values
  const L = md.lines
  assert.equal(v['Check Box - 1'], 'Married filing joint return or spouse had no income')
  assert.equal(v['Enter your first name'], 'Ana')
  assert.equal(v['Enter your middle initial'], 'M')
  assert.equal(v['Enter 4 Digit Political Subdivision Code (See Instruction 6)'], '1609')
  assert.equal(v['Physical Maryland County'], 'MONTGOMERY')
  assert.equal(v['Text Field 17'], '3')
  assert.equal(v['D. Enter Dollar Amount Total Exemptions (Add A, B and C.) '], '9600')
  assert.equal(v['Enter 13'], '2800')
  assert.equal(v['Text Field 9'], 'ab')
  assert.equal(v['Text Field 10'], 'xb')
  assert.equal(v['Enter 14'], '1200')
  assert.equal(v['Enter 20'], String(L['20']))
  assert.equal(v['Enter local tax rate'], '320')
  assert.equal(v['Text Box 44'], String(L['28']))
  assert.equal(L['16'], L['7'] - L['15'])
  assert.equal(L['20'], L['16'] - L['17'] - L['19'])
  assert.equal(L['34'], L['27'] + L['33'])
  if (L['50'] > 0) assert.equal(v['Check Box 52'], 'Checking')
})

test('Form 502B and 502SU values', async () => {
  const { packet } = await filled(family())
  const b = packet.forms[1].values
  assert.equal(b.DP_FNAME1, 'Mia')
  assert.equal(b.DP_LNAME1, 'Lopez')
  assert.equal(b.DP_BIRTHDAY1, '03/04/2018')
  assert.equal(b['502B_TOTALBOXES_TTL'], '1')
  const su = packet.forms[2].values
  assert.equal(su['Text Field 43'], '300')
  assert.equal(su['Text Field 36'], '2500')
  assert.equal(su['Text Field 87'], '2800')
})

test('the Maryland PDF builds', async () => {
  const ret = family()
  const res = computeReturn(ret)
  const md = computeMaryland(ret, res)
  const { bytes, problems } = await buildPdf(lib, buildMarylandPacket(ret, res, md).forms, load, '2025 Maryland Form 502')
  assert.deepEqual(problems, [])
  const doc = await lib.PDFDocument.load(bytes)
  assert.equal(doc.getPageCount(), 4 + 2 + 3)
  if (process.env.WRITE_PDF) await writeFile(process.env.WRITE_PDF, bytes)
})
