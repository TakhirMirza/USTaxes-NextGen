/**
 * Massachusetts 2026 (DOR early-release drafts of Form 1 and Schedules HC, X, Y, DI, B and D): the surtax threshold
 * DOR certified for 2026, the 2026 Schedule HC figures (TIR 26-1 penalties and poverty levels, the Health Connector's
 * 2026 affordability schedule), and the packet on the drafts in public/forms/2026.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyMaHealth, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { MaInput, TaxReturnInput } from '../engine/model.ts'
import { computeMassachusetts, maAffordablePercent, maFpl150, maMonthlyPenalty, maPenaltyColumn, maSubsidizedLimit } from '../engine/ma2025.ts'
import { stateDraft, stateReady } from '../engine/rules.ts'
import { buildMaPacket } from './ma2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2026/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: Math.min(wages, 184500) * 0.062, medicareWithheld: wages * 0.0145 })
const base = (year: 2025 | 2026, patch: Partial<TaxReturnInput> = {}): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, taxYear: year, filingStatus: 'single', residentState: 'MA',
    taxpayer: { ...r.taxpayer, firstName: 'Lee', lastName: 'Park', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Kim', lastName: 'Park', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1 Elm St', city: 'Boston', state: 'MA', zip: '02108' },
    w2s: [w2(60000)],
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<MaInput> = {}) => {
  const full = { ...ret, ma: { ...ret.ma, ...x } }
  const res = computeReturn(full)
  return { ma: computeMassachusetts(full, res), res, ret: full }
}

test('2026: Massachusetts is on as a draft', () => {
  assert.equal(stateReady('MA', 2026), true)
  assert.equal(stateDraft('MA', 2026), true)
})

test('2026 4% surtax starts above $1,107,750', () => {
  const big = (y: 2025 | 2026) => run(base(y, { w2s: [w2(1300000)] })).ma.lines
  const l26 = big(2026)
  assert.equal(l26['28b'], Math.round((l26['21'] - 1107750) * 0.04))
  const l25 = big(2025)
  assert.equal(l25['28b'], Math.round((l25['21'] - 1083150) * 0.04))
})

test('2026 exemptions: $1,700 for each person 65 or over', () => {
  const { ma } = run(base(2026, { taxpayer: { ...emptyReturn().taxpayer, firstName: 'Lee', lastName: 'Park', ssn: '123456789', age: 70, age65OrOlder: true } }))
  assert.equal(ma.lines['2c'], 1700)
  assert.equal(ma.lines['2g'], 4400 + 1700)
})

test('2026 Schedule HC tables: poverty levels, affordability, subsidized limit, penalties', () => {
  assert.equal(maFpl150(1, 2026), 23475)
  assert.equal(maFpl150(4, 2026), 48225)
  assert.equal(maFpl150(1, 2025), 22590)
  assert.equal(maAffordablePercent(1, 40000, 2026), 5.0)
  assert.equal(maAffordablePercent(2, 74000, 2026), 7.45)
  assert.equal(maAffordablePercent(3, 106601, 2026), 8.0)
  assert.equal(maSubsidizedLimit(1, 2026), 62600)
  assert.equal(maSubsidizedLimit(3, 2026), 106600)
  assert.equal(maPenaltyColumn(1, 31000, 2026), 'A')
  assert.equal(maPenaltyColumn(1, 62600, 2026), 'D')
  assert.equal(maPenaltyColumn(1, 70000, 2026), 'E')
  assert.equal(maMonthlyPenalty('E', 2026), 211)
  assert.equal(maMonthlyPenalty('A', 2026), 26)
  // The same income is in the 2025 top-but-one band.
  assert.equal(maPenaltyColumn(1, 70000, 2025), 'E')
  assert.equal(maMonthlyPenalty('E', 2025), 132)
})

test('2026 uninsured all year at $70,000: $211 a month, and Table 4 is flagged', () => {
  const { ma } = run(base(2026, { w2s: [w2(70000)] }), { health: { taxpayer: { ...emptyMaHealth(), coverage: 'none', months: Array(12).fill(false) }, spouse: emptyMaHealth() } })
  const hc = ma.health.hc.taxpayer!
  assert.equal(hc.worksheet?.l2, 'E')
  assert.equal(hc.penalty, 2532) // TIR 26-1: $211 a month, $2,532 a year above 400% FPL
  assert.ok(ma.issues.some((i) => i.includes('2026 Table 4')))
})

test('2026 packet: Form 1 and schedules fill on the drafts', async () => {
  const kid = { ...emptyDependent(), name: 'Ada Park', relationship: 'Daughter', age: 7, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }
  const ret = base(2026, { filingStatus: 'mfj', w2s: [w2(150000), w2(70000, 'spouse')], dependents: [kid] })
  const { ma, res, ret: x } = run(ret, { rentPaid: 30000, estimatedPayments: 1000, otherGambling: 500, commuter: { taxpayer: 900, spouse: 0 } })
  const packet = buildMaPacket(x, res, ma)
  const ids = packet.forms.map((f) => f.id)
  assert.ok(ids.includes('ma1') && ids.includes('maschhc') && ids.includes('maschdi') && ids.includes('maschx') && ids.includes('maschy'), ids.join())
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes, problems: p2 } = await buildPdf(lib, packet.forms, load, '2026 Massachusetts Form 1 (draft)')
  assert.deepEqual(p2, [])
  if (process.env.WRITE_PDF) await writeFile(process.env.WRITE_PDF, bytes)
  assert.equal(ma.lines['46'], 440)
})

test('every Massachusetts 2026 draft is labeled as a 2026 draft and keeps its fields', async () => {
  for (const f of ['ma1.pdf', 'maschhc.pdf', 'maschx.pdf', 'maschy.pdf', 'maschdi.pdf', 'maschb.pdf', 'maschd.pdf']) {
    const doc = await lib.PDFDocument.load(await load(f))
    assert.match(doc.getTitle() ?? '', /^2026 Massachusetts .*draft/)
    assert.ok(doc.getForm().getFields().length > 10, f)
  }
})
