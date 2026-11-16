/**
 * Fills the real 2025 New Jersey NJ-1040 and Massachusetts Form 1 PDFs and checks that every mapped key matches
 * exactly one field.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { empty1099Div, empty1099Int, empty1099R, emptyDependent, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeNewJersey } from '../engine/nj2025.ts'
import { computeMassachusetts } from '../engine/ma2025.ts'
import { buildNjPacket } from './nj2025.ts'
import { buildMaPacket } from './ma2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))

const household = (state: 'NJ' | 'MA'): TaxReturnInput => {
  const r = emptyReturn()
  const kid = { ...emptyDependent(), name: 'Ben Carter', relationship: 'Son', age: 4, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }
  const w2 = { ...emptyW2('spouse'), employer: 'Acme', wages: 52000, federalWithholding: 3100, socialSecurityWages: 52000, medicareWages: 52000, socialSecurityWithheld: 3224, medicareWithheld: 754 }
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'Pension Fund', grossDistribution: 18000, taxableAmount: 18000, code: '7' }
  const base: TaxReturnInput = {
    ...r, filingStatus: 'mfj', residentState: state,
    taxpayer: { ...r.taxpayer, firstName: 'Ann L', lastName: 'Carter', ssn: '123456789', age: 63 },
    spouse: { ...r.taxpayer, firstName: 'Bob', lastName: 'Carter', ssn: '987654321', age: 58 },
    contact: { ...r.contact, street: '5 Oak Ave', city: state === 'NJ' ? 'Princeton' : 'Worcester', state, zip: state === 'NJ' ? '08540' : '01608', phone: '609-555-0100', email: 'ann@example.com' },
    dependents: [kid], w2s: [w2], retirement: [pension],
    interest: [{ ...empty1099Int(), payer: 'Bank', interest: 900 }], dividends: [{ ...empty1099Div(), payer: 'Fund', ordinaryDividends: 1200 }],
    digitalAssets: false,
    refundDeposit: { routingNumber: '011000015', accountNumber: '998877', accountType: 'checking' }
  }
  if (state === 'NJ') return { ...base, nj: { ...base.nj, municipalityCode: '1114', w2: { [w2.id]: { ein: '123456789', stateId: '', stateIncome: 52500, stateTax: 1400 } }, housing: 'own', propertyTax: 9800, veteran: { taxpayer: true, spouse: false }, donations: { '70': 10 } } }
  const ira = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'IRA Custodian', grossDistribution: 6000, taxableAmount: 6000, code: '7', ira: true }
  const div = { ...empty1099Div(), payer: 'Fund', ordinaryDividends: 1200, capitalGainDistributions: 800 }
  return { ...base, retirement: [pension, ira], dividends: [div], ma: { ...base.ma, commuter: { taxpayer: 650, spouse: 0 }, iraBasisRecovered: 2000, longTermCarryover: 300, w2: { [w2.id]: { ein: '123456789', stateId: '', stateIncome: null, stateTax: 2300 } }, maBankInterest: 300, rentPaid: 18000, donations: { a: 5 }, electionFund: { taxpayer: true, spouse: false }, birthDate: { taxpayer: '03/02/1962', spouse: '07/19/1967' }, dependentBirthDates: { [kid.id]: '05/01/2021' }, health: { taxpayer: { ...base.ma.health.taxpayer, insurer: 'Blue Cross Blue Shield', subscriber: 'XYZ123456' }, spouse: { ...base.ma.health.spouse, coverage: 'part', months: [true, true, true, true, true, true, false, false, false, false, true, true] } } } }
}

const run = (state: 'NJ' | 'MA') => {
  const ret = household(state)
  const res = computeReturn(ret)
  return state === 'NJ' ? buildNjPacket(ret, res, computeNewJersey(ret, res)) : buildMaPacket(ret, res, computeMassachusetts(ret, res))
}

test('NJ-1040 and Form 1: every key matches exactly one field', async () => {
  for (const state of ['NJ', 'MA'] as const) {
    const packet = run(state)
    const problems: FillProblem[] = []
    for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
    assert.deepEqual(problems, [], state)
    if (state === 'MA') assert.deepEqual(packet.forms.map((x) => x.id), ['ma1', 'maschhc', 'maschdi', 'maschb', 'maschd', 'maschx', 'maschy'])
  }
})

test('the NJ and MA PDFs build', async () => {
  for (const state of ['NJ', 'MA'] as const) {
    const { bytes, problems } = await buildPdf(lib, run(state).forms, load, `2025 ${state}`)
    assert.deepEqual(problems, [])
    if (process.env.WRITE_PDF) await writeFile(`${process.env.WRITE_PDF}-${state}.pdf`, bytes)
  }
})
