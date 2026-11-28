/**
 * Nebraska 2026: the 2026 Form 1040N and Schedules I–III (fillable, renumbered), the 2026 Tax Calculation Schedule
 * and the 2026 Tax Table (all 798 rows, src/engine/ne2026-tax-table.json, parsed from the DOR table).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from '../engine/model.ts'
import type { NeInput, TaxReturnInput } from '../engine/model.ts'
import { computeNebraska, neTax } from '../engine/ne2025.ts'
import { stateDraft, stateReady } from '../engine/rules.ts'
import { buildNePacket } from './ne2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2026/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const base = (year: 2025 | 2026, patch: Partial<TaxReturnInput> = {}): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, taxYear: year, filingStatus: 'single', residentState: 'NE',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '301 Centennial Mall S', city: 'Lincoln', state: 'NE', zip: '68509', phone: '402-555-0100' },
    w2s: [w2(60000)],
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<NeInput> = {}) => {
  const r = { ...ret, ne: { ...ret.ne, ...x } }
  const res = computeReturn(r)
  return { ne: computeNebraska(r, res), res, ret: r }
}

test('2026: Nebraska is on', () => {
  assert.equal(stateReady('NE', 2026), true)
  assert.equal(stateDraft('NE', 2026), true)
})

test('2026 tax: every row of the Tax Table (midpoint) and the Tax Calculation Schedule', async () => {
  const rows: number[][] = JSON.parse(await readFile(new URL('../engine/ne2026-tax-table.json', import.meta.url), 'utf8'))
  assert.equal(rows.length, 798)
  for (const [lo, hi, single, mfj, mfs, hoh] of rows) {
    const mid = (lo + hi) / 2
    assert.deepEqual([neTax(mid, 'single', 2026), neTax(mid, 'mfj', 2026), neTax(mid, 'mfs', 2026), neTax(mid, 'hoh', 2026)], [single, mfj, mfs, hoh], `row ${lo}`)
  }
  assert.equal(neTax(100000, 'single', 2026), Math.round(1514.58 + (100000 - 39900) * 0.0455))
  assert.equal(neTax(200000, 'mfj', 2026), Math.round(3029.16 + (200000 - 79800) * 0.0455))
  assert.equal(neTax(70000, 'hoh', 2026), Math.round(2198.88 + (70000 - 59160) * 0.0455))
})

test('2026 standard deduction, exemption credit and tax', () => {
  const { ne } = run(base(2026))
  assert.equal(ne.lines['6'], 8850)
  assert.equal(ne.lines['14'], 60000 - 8850)
  assert.equal(ne.lines['15'], neTax(51150, 'single', 2026))
  assert.equal(ne.lines['18'], 176)
  const mfj = run(base(2026, { filingStatus: 'mfj', w2s: [w2(60000), w2(40000, 'spouse')] })).ne
  assert.equal(mfj.lines['6'], 17700)
  assert.equal(mfj.lines['18'], 352)
  const hoh = run(base(2026, { filingStatus: 'hoh', dependents: [{ ...emptyDependent(), name: 'Kid Doe', relationship: 'Son', age: 8, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true }] })).ne
  assert.equal(hoh.lines['6'], 12950)
  const old = run(base(2026, { taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true } })).ne
  assert.equal(old.lines['6'], 10900)
})

test('2026 packet: renumbered Form 1040N and Schedule I fields', async () => {
  const p = { ...empty1099R(), id: 'm', payer: 'DFAS', grossDistribution: 20000, taxableAmount: 20000, code: '7' }
  const ret = base(2026, {
    filingStatus: 'mfj', w2s: [w2(70000), w2(30000, 'spouse')],
    taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 66, age65OrOlder: true },
    retirement: [p], socialSecurity: [{ ...emptySocialSecurity(), netBenefits: 18000 }],
    dependents: [{ ...emptyDependent(), name: 'Mia Doe', relationship: 'Daughter', age: 15, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true }]
  })
  const { ne, res, ret: x } = run(ret, { retirementKind: { m: 'military' }, collegeSavings: 3000, estimatedPayments: 9000 })
  assert.ok(ne.scheduleI['44'] > 0)
  const packet = buildNePacket(x, res, ne)
  const f = packet.forms[0]
  // Line 54 (total payments; 2025 line 53) and line 61 (overpayment; 2025 line 60) moved down one.
  assert.equal(f.values['54'], String(ne.lines['53']))
  assert.equal(f.values['53'], undefined)
  assert.equal(f.values['Dependent First Name 1'], 'MIA')
  assert.equal(f.values['Dependent Last Name 1'], 'DOE')
  const s = packet.forms.find((y) => y.id === 'neschi')!
  assert.equal(s.values['49'], String(ne.scheduleI['44']))
  assert.equal(s.values['35'], String(ne.scheduleI['32']))
  assert.equal(s.values['22'], '3000')
  assert.deepEqual(s.pages, [0, 1])
  const problems: FillProblem[] = []
  for (const y of packet.forms.filter((z) => z.file.endsWith('.pdf'))) await fillForm(lib, await load(y.file), { ...y }, problems)
  assert.deepEqual(problems, [])
  const { bytes, problems: p2 } = await buildPdf(lib, packet.forms, load, '2026 Nebraska Form 1040N')
  assert.deepEqual(p2, [])
  if (process.env.WRITE_PDF) await writeFile(process.env.WRITE_PDF, bytes)
})

test('every Nebraska 2026 form is labeled 2026', async () => {
  for (const f of ['ne-1040n.pdf', 'ne-1040n-schs.pdf']) {
    const doc = await lib.PDFDocument.load(await load(f))
    assert.match(doc.getTitle() ?? '', /^2026 Nebraska /)
  }
})
