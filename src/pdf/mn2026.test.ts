/**
 * Minnesota 2026 (Revenue's final drafts of Form M1, 10/1/26, and Schedule M1SA, 11/4/26): the 2026 parameters from
 * the draft M1 instructions, the computed Schedule M1SA, and the packet on the drafts in public/forms/2026.
 * src/engine/mn2026-tax-table.json holds the 901 rows of the 2026 tax table (pages 32–38), parsed from the instructions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { MnInput, TaxReturnInput } from '../engine/model.ts'
import { computeMinnesota, mnExemptions, mnStandardLimit, mnTax } from '../engine/mn2025.ts'
import { stateDraft, stateReady } from '../engine/rules.ts'
import { buildMnPacket } from './mn2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2026/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const base = (year: 2025 | 2026, patch: Partial<TaxReturnInput> = {}): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, taxYear: year, filingStatus: 'single', residentState: 'MN',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1 Lake St', city: 'Duluth', state: 'MN', zip: '55802' },
    w2s: [w2(60000)],
    ...patch
  }
}
const run = (ret: TaxReturnInput, m: Partial<MnInput> = {}) => {
  const x = { ...ret, mn: { ...ret.mn, ...m } }
  const res = computeReturn(x)
  return { mn: computeMinnesota(x, res), res, ret: x }
}

test('2026: Minnesota is on as a draft', () => {
  assert.equal(stateReady('MN', 2026), true)
  assert.equal(stateDraft('MN', 2026), true)
})

test('2026 tax: every row of the printed tax table, and the rate schedules', async () => {
  const rows: number[][] = JSON.parse(await readFile(new URL('../engine/mn2026-tax-table.json', import.meta.url), 'utf8'))
  assert.equal(rows.length, 901)
  for (const [lo, , single, mfj, mfs, hoh] of rows) {
    assert.deepEqual([mnTax(lo, 'single', 2026), mnTax(lo, 'mfj', 2026), mnTax(lo, 'mfs', 2026), mnTax(lo, 'hoh', 2026)], [single, mfj, mfs, hoh], `row ${lo}`)
  }
  assert.equal(mnTax(100000, 'single', 2026), Math.round(1782.09 + (100000 - 33310) * 0.068))
  assert.equal(mnTax(400000, 'mfj', 2026), Math.round(23789.82 + (400000 - 337930) * 0.0985))
  assert.equal(mnTax(200000, 'hoh', 2026), Math.round(10611.76 + (200000 - 164800) * 0.0785))
  assert.equal(mnTax(170000, 'mfs', 2026), Math.round(11894.91 + (170000 - 168965) * 0.0985))
})

test('2026 standard deduction, Worksheets A/B and dependent exemptions', () => {
  assert.equal(run(base(2026)).mn.lines['4'], 15300)
  assert.equal(run(base(2026, { filingStatus: 'hoh', dependents: [{ ...emptyDependent(), name: 'Kid Doe', relationship: 'Son', age: 8, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true }] })).mn.lines['4'], 23000)
  const old = run(base(2026, { filingStatus: 'mfj', taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 66 } })).mn
  assert.equal(old.lines['4'], 32200)
  assert.equal(mnStandardLimit(15300, 300000, 'single', 2026), 15300 - Math.round((300000 - 244400) * 0.03))
  assert.equal(mnStandardLimit(30600, 2000000, 'mfj', 2026), 6120)
  assert.equal(mnExemptions(2, 100000, 'mfj', 2026), 10600)
  assert.equal(mnExemptions(2, 366700 + 5000, 'mfj', 2026), Math.round(10600 - 10600 * 0.04))
})

test('2026 Schedule M1SA: no income tax, $10,000 property tax cap, 1% charitable floor, line 28 phaseout', () => {
  const it = { ...emptyReturn().itemized, medical: 2000, stateLocalIncomeOrSalesTax: 9000, realEstateTax: 8000, personalPropertyTax: 3000, mortgageInterest: 14000, charityCash: 5000, charityNonCash: 1000 }
  const { mn } = run(base(2026, { w2s: [w2(150000)], itemized: it, deductionChoice: 'itemized' }))
  const S = mn.sa!
  assert.equal(S['1'], mn.lines['1'])
  assert.equal(S['4'], 0) // medical under 10%
  assert.equal(S['8'], 10000)
  assert.equal(S['19'], Math.round(S['1'] * 0.01))
  assert.equal(S['21'], 6000 - S['19'])
  assert.equal(S['28'], 0)
  assert.equal(S['29'], 10000 + 14000 + S['21'])
  assert.equal(mn.deduction.method, 'itemized')
  assert.equal(mn.lines['4'], S['29'])
  // Over $244,400: 3% of the excess, at most 80% of the reducible deductions.
  const high = run(base(2026, { w2s: [w2(300000)], itemized: it, deductionChoice: 'itemized' })).mn.sa!
  assert.equal(high['28'], Math.round((high['1'] - 244400) * 0.03))
})

test('2026 charitable subtraction for non-itemizers: 50% over 1% of AGI and $500', () => {
  const { mn } = run(base(2026, { itemized: { ...emptyReturn().itemized, charityCash: 3000 } }))
  assert.equal(mn.deduction.method, 'standard')
  assert.equal(mn.m['11'], Math.round((3000 - mn.lines['1'] * 0.01 - 500) * 0.5))
  const y25 = run(base(2025, { itemized: { ...emptyReturn().itemized, charityCash: 3000 } })).mn
  assert.equal(y25.m['11'], 1250)
})

test('2026 Child and Working Family Credits', () => {
  const kid = { ...emptyDependent(), name: 'Kid Doe', relationship: 'Son', age: 8, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true }
  const { mn } = run(base(2026, { filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid, { ...kid, name: 'Bo Doe', ssn: '111223334' }] }))
  assert.equal(mn.cwfc['3'], 9690)
  assert.equal(mn.cwfc['4'], Math.round(9690 * 0.04))
  assert.equal(mn.cwfc['8'], 3600)
  assert.equal(mn.cwfc['11'], 32680)
  assert.equal(mn.ref['2'], mn.cwfc['4'] + 3600)
})

test('2026 packet: Form M1 and Schedule M1SA drafts fill; the other schedules are listed', async () => {
  const kid = { ...emptyDependent(), name: 'Kid Doe', relationship: 'Son', age: 8, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true }
  const ret = base(2026, {
    filingStatus: 'mfj', w2s: [w2(180000), w2(90000, 'spouse')], dependents: [kid], deductionChoice: 'itemized',
    itemized: { ...emptyReturn().itemized, realEstateTax: 9000, personalPropertyTax: 2500, mortgageInterest: 18000, charityCash: 8000 }
  })
  const { mn, res, ret: x } = run(ret, { county: 'St. Louis', estimatedPayments: 15000 })
  assert.equal(mn.deduction.method, 'itemized')
  const packet = buildMnPacket(x, res, mn)
  assert.deepEqual(packet.forms.map((f) => f.id), ['mnm1', 'mnm1sa'])
  assert.ok(packet.notIncluded.some((n) => n.startsWith('Schedule M1DQC') && n.includes('2026 draft is not in this app yet')))
  assert.ok(packet.notIncluded.some((n) => n === 'A copy of your 2026 federal return and schedules'))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const sa = packet.forms[1]
  assert.ok(sa.draw!.some((d) => d.text === String(mn.sa!['29'])))
  const { bytes, problems: p2 } = await buildPdf(lib, packet.forms, load, '2026 Minnesota Form M1 (draft)')
  assert.deepEqual(p2, [])
  assert.equal((await lib.PDFDocument.load(bytes)).getPageCount(), 4)
  if (process.env.WRITE_PDF) await writeFile(process.env.WRITE_PDF, bytes)
  assert.equal(packet.forms[0].values.m1line4, String(mn.lines['4']))
  assert.equal(packet.forms[0].values.m1line10, String(mn.lines['10']))
})

test('every Minnesota 2026 draft is labeled as a 2026 draft', async () => {
  for (const f of ['mnm1.pdf', 'mnm1sa.pdf']) {
    const doc = await lib.PDFDocument.load(await load(f))
    assert.match(doc.getTitle() ?? '', /^2026 Minnesota .*draft/)
  }
})
