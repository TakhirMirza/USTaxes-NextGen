/**
 * Kansas K-40 (2025). Tax table rows checked against the 2025 booklet (ip25); returns worked by hand.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { KsInput, TaxReturnInput } from './model.ts'
import { computeKansas, ksTax } from './ks2025.ts'
import { buildKsPacket } from '../pdf/ks2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'KS',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '915 SW Harrison St', city: 'Topeka', state: 'KS', zip: '66612', phone: '785-555-0100' },
    ...patch
  }
}
const ks = (ret: TaxReturnInput, x: Partial<KsInput> = {}) => {
  const r = { ...ret, ks: { ...ret.ks, ...x } }
  const res = computeReturn(r)
  return { ks: computeKansas(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '48-1234567', stateId: '036123456789F01', stateIncome: null, stateTax: tax } })

test('KS tax table rows from the 2025 booklet', () => {
  assert.equal(ksTax(25, false), 0)
  assert.equal(ksTax(50, false), 2)
  assert.equal(ksTax(100, true), 4)
  assert.equal(ksTax(150, false), 7)
  assert.equal(ksTax(500, false), 25)
  assert.equal(ksTax(23000, false), 1195)
  assert.equal(ksTax(46000, false), 2478)
  assert.equal(ksTax(46000, true), 2391)
  assert.equal(ksTax(150000, false), Math.round(150000 * 0.0558 - 87))
})

test('KS single W-2', () => {
  const w = w2(60000)
  const { ks: r } = ks(base({ w2s: [w] }), { w2: withheld(w, 2600) })
  assert.equal(r.lines['4'], 3605)
  assert.equal(r.lines['5'], 9160)
  assert.equal(r.lines['7'], 47235)
  assert.equal(r.lines['8'], 2548)
  assert.equal(r.lines['43'], 52)
})

test('KS joint with two children; retiree with Social Security and exempt KPERS', () => {
  const { ks: r } = ks(base({ filingStatus: 'mfj', w2s: [w2(80000)], dependents: [kid(3), kid(8, 'Amy Doe')] }))
  assert.equal(r.lines['5'], 22960)
  assert.equal(r.lines['7'], 48800)
  assert.equal(r.lines['8'], 2547)
  const p = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'KPERS', grossDistribution: 25000, taxableAmount: 25000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const old = ks(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p], socialSecurity: [ss] }), { exemptRetirement: { [p.id]: true } })
  assert.equal(old.ks.scheduleS['A14'], 25000)
  assert.equal(old.ks.scheduleS['A10'], Math.round(old.res.f1040['6b']))
  assert.equal(old.ks.lines['4'], 4455)
  assert.equal(old.ks.lines['8'], 0)
})

test('KS earned income credit is refundable', () => {
  const { ks: r, res } = ks(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(6)] }))
  assert.equal(r.lines['5'], 9160 + 2320 + 2320)
  assert.equal(r.lines['8'], 0)
  assert.equal(r.lines['22'], Math.round(res.f1040['27a'] * 0.17))
  assert.equal(r.lines['43'], r.lines['22'])
})

test('K-40 and Schedule S: every value lands on one field and the PDF builds', async () => {
  const w = w2(45000)
  const { ks: r, res, ret } = ks(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(0)] }), { w2: withheld(w, 1500), usObligationInterest: 40, schoolDistrict: '501', county: 'SN', contributions: { '35': 5 } })
  const packet = buildKsPacket(ret, res, r)
  assert.deepEqual(packet.forms.map((f) => f.id), ['ksk40', 'ksschs'])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 KS')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-KS.pdf`, bytes)
})
