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

test('KS Schedule A: itemizing in Kansas without itemizing federally', async () => {
  const r0 = emptyReturn()
  const { ks: k, res, ret } = ks(base({ w2s: [w2(60000)], itemized: { ...r0.itemized, medical: 6000, realEstateTax: 2500, mortgageInterest: 1500, charityCash: 300 } }), { schA: { ...r0.ks.schA, points: 200 } })
  assert.equal(res.deduction.used, 'standard')
  assert.equal(k.schA['3'], Math.round(res.f1040['11a'] * 0.075))
  assert.equal(k.schA['4'], Math.max(0, 6000 - k.schA['3']))
  assert.equal(k.schA['9'], 1700)
  assert.equal(k.schA['14'], k.schA['4'] + 2500 + 1700 + 300)
  assert.ok(k.itemize)
  assert.equal(k.lines['4'], k.schA['14'])
  const packet = buildKsPacket(ret, res, k)
  const sa = packet.forms.find((f) => f.id === 'ksscha')!
  assert.equal(sa.values['8c Points not reported to you on Form 1098'], '200')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, [sa], load, '2025 KS Sch A')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-KSA.pdf`, bytes)
})

test('KS line 13: Worksheet for Residents per state and the foreign tax limitation', () => {
  const w = w2(60000)
  const { ks: r } = ks(base({ w2s: [w] }), { w2: withheld(w, 2600), otherStates: [{ state: 'mo', tax: 900, income: 20000 }, { state: 'NE', tax: 100, income: 6000 }], foreign: { country: 'Canada', taxPaid: 500, federalCredit: 300, income: 3000 } })
  assert.equal(r.lines['12'], 2548)
  const [mo, ne, ca] = r.otherStates
  assert.equal(r.lines['3'], 60000)
  // Missouri: 2,548 × 20,000 / 60,000 = 849, less than the 900 paid.
  assert.deepEqual([mo.name, mo.l1, mo.l5, mo.l6, mo.l7], ['MO', 900, 33.3333, 849, 849])
  // Nebraska: the 100 paid is less than 2,548 × 10% = 255.
  assert.deepEqual([ne.l6, ne.l7], [255, 100])
  // Canada: line 1 is 500 − 300 = 200; 2,548 × 5% = 127.
  assert.deepEqual([ca.name, ca.l1, ca.l6, ca.l7], ['Canada', 200, 127, 127])
  assert.equal(r.lines['13'], 849 + 100 + 127)
  assert.equal(r.lines['16'], 2548 - 1076)
  assert.ok(r.attach.some((x) => x.includes('1116')))
  // Without the worksheet, an amount figured by hand still works.
  assert.equal(ks(base({ w2s: [w] }), { otherStateCredit: 400 }).ks.lines['13'], 400)
})
