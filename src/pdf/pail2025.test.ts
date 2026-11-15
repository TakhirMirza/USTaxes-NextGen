/**
 * Fills the real 2025 Pennsylvania (PA-40, Schedules SP and O) and Illinois (IL-1040, Schedules M and
 * IL-E/EITC) PDFs and checks that every mapped key matches exactly one field.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computePennsylvania } from '../engine/pa2025.ts'
import { computeIllinois } from '../engine/il2025.ts'
import { buildPaPacket } from './pa2025.ts'
import { buildIlPacket } from './il2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))

const family = (state: string, wages: number): TaxReturnInput => {
  const r = emptyReturn()
  const kid = { ...emptyDependent(), name: 'Mia Kowalski', relationship: 'Daughter', age: 7, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }
  return {
    ...r, filingStatus: 'hoh', residentState: state,
    taxpayer: { ...r.taxpayer, firstName: 'Eva J', lastName: 'Kowalski', ssn: '123456789', age: 33, occupation: 'Cashier' },
    contact: { ...r.contact, street: '12 Elm St', city: state === 'PA' ? 'Scranton' : 'Peoria', state, zip: state === 'PA' ? '18503' : '61602', phone: '570-555-0100', email: 'eva@example.com' },
    dependents: [kid],
    w2s: [{ ...emptyW2('taxpayer'), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 }],
    adjustments: { ...r.adjustments, studentLoanInterest: 600 },
    refundDeposit: { routingNumber: '031000053', accountNumber: '998877', accountType: 'checking' },
    pa: { ...r.pa, schoolDistrict: 'Scranton', schoolCode: '35400', withholding: 400 },
    il: { ...r.il, county: 'Peoria', withholding: 500, usObligationInterest: 0, collegeSavings: 1000, dependentBirthDates: { [kid.id]: '04/05/2018' }, useTaxTable: true }
  }
}

test('PA-40 with Schedules SP and O: every key matches exactly one field', async () => {
  const ret = family('PA', 16200)
  const res = computeReturn(ret)
  const pa = computePennsylvania(ret, res)
  const packet = buildPaPacket(ret, res, pa)
  assert.deepEqual(packet.forms.map((x) => x.id), ['pa40', 'pa40sp', 'pa40o'])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const v = packet.forms[0].values
  assert.equal(v['1a. Gross Compensation'], '16200')
  assert.equal(v['21. Tax Forgiveness Credit'], String(pa.lines['21']))
  assert.equal(v.Code, 'S')
  assert.ok(pa.lines['21'] > 0)
})

test('IL-1040 with Schedules M and IL-E/EITC: every key matches exactly one field', async () => {
  const ret = family('IL', 21000)
  const res = computeReturn(ret)
  const il = computeIllinois(ret, res)
  const packet = buildIlPacket(ret, res, il)
  assert.deepEqual(packet.forms.map((x) => x.id), ['il1040', 'ilschm', 'ilschie'])
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  assert.equal(packet.forms[0].values.filing_status, 'head of household')
  assert.equal(packet.forms[0].values['Child Tax credit from Sch.IL-EITC'], String(il.lines['30']))
  assert.ok(il.lines['30'] > 0)
})

test('the PA and IL PDFs build', async () => {
  for (const [state, wages] of [['PA', 16200], ['IL', 21000]] as const) {
    const ret = family(state, wages)
    const res = computeReturn(ret)
    const forms = state === 'PA' ? buildPaPacket(ret, res, computePennsylvania(ret, res)).forms : buildIlPacket(ret, res, computeIllinois(ret, res)).forms
    const { bytes, problems } = await buildPdf(lib, forms, load, `2025 ${state}`)
    assert.deepEqual(problems, [])
    if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-${state}.pdf`, bytes)
  }
})
