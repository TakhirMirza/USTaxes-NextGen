/**
 * South Carolina SC1040 (2025). Expected values are worked by hand from the 2025 SC1040 instructions and SC1040TT
 * (the engine's tax matches all 1,070 parsed table rows and the rate schedule example: $101,000 → $5,418).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyBusiness, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { ScInput, TaxReturnInput } from './model.ts'
import { computeSouthCarolina, scTax } from './sc2025.ts'
import { buildScPacket } from '../pdf/sc2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'SC',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '1 Gervais St', city: 'Columbia', state: 'SC', zip: '29201', phone: '803-555-0100' },
    ...patch
  }
}
const sc = (ret: TaxReturnInput, s: Partial<ScInput> = {}) => {
  const x = { ...ret, sc: { ...ret.sc, ...s } }
  const res = computeReturn(x)
  return { sc: computeSouthCarolina(x, res), res, ret: x }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '57-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('SC tax tables and rate schedule', () => {
  assert.equal(scTax(3600), 2)
  assert.equal(scTax(6020), 74)
  assert.equal(scTax(17950), 435)
  assert.equal(scTax(101000), 5418) // the SC1040TT example
})

test('SC single W-2', () => {
  const w = w2(60000)
  const { sc: r } = sc(base({ w2s: [w] }), { w2: withheld(w, 2500) })
  assert.equal(r.lines['1'], 44250)
  assert.equal(r.lines['5'], 44250)
  assert.equal(r.lines['6'], 2013)
  assert.equal(r.lines['30'], 487)
})

test('SC family: dependent exemptions, child care and two wage earner credits', () => {
  const { sc: r } = sc(base({ filingStatus: 'mfj', w2s: [w2(40000), w2(30000, 'spouse')], dependents: [kid(4), kid(9, 'Amy Doe')], dependentCare: { expenses: 3000, employerBenefits: 0, providers: [] } }))
  assert.equal(r.lines['w'], 9860)
  assert.equal(r.lines['t'], 4930)
  assert.equal(r.lines['5'], 38500 - 14790)
  assert.equal(r.lines['6'], 783)
  assert.equal(r.lines['11'], 210) // 7% × $3,000
  assert.equal(r.lines['12'], 210) // 0.7% × $30,000
})

test('SC retiree: retirement and age 65 deductions, Social Security', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'SCRS', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 20000 }
  const { sc: r, res } = sc(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 67, age65OrOlder: true }, retirement: [pension], socialSecurity: [ss] }))
  assert.equal(r.lines['p-1'], 10000)
  assert.equal(r.lines['q-1'], 5000)
  assert.equal(r.lines['o'], Math.round(res.f1040['6b']))
  const mil = sc(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 67, age65OrOlder: true }, retirement: [pension] }), { militaryRetirement: { taxpayer: 13000, spouse: 0 } }).sc
  assert.equal(mil.lines['p-4'], 13000)
  assert.equal(mil.lines['p-1'], 0) // the $10,000 limit is used up by the military deduction
  assert.equal(mil.lines['q-1'], 2000) // the instructions' Example 3: 15,000 − 13,000
})

test('SC adds back the federal QBI deduction', () => {
  const biz = { ...emptyBusiness(), name: 'Shop', grossReceipts: 50000 }
  const { sc: r, res } = sc(base({ businesses: [biz] }))
  assert.ok(res.f1040['13a'] > 0)
  assert.equal(r.lines['e'], Math.round(res.f1040['13a']))
})

test('SC1040: the values are printed on the official form', async () => {
  const w = w2(60000)
  const { sc: r, res, ret } = sc(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(4)], refundDeposit: { routingNumber: '053000219', accountNumber: '998877', accountType: 'checking' } }), { w2: withheld(w, 3000), countyCode: '40', birthDate: { taxpayer: '01/02/1985', spouse: '03/04/1986' } })
  const packet = buildScPacket(ret, res, r)
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  await fillForm(lib, await load('sc1040.pdf'), { ...packet.forms[0] }, problems)
  assert.deepEqual(problems, [])
  assert.ok((packet.forms[0].draw ?? []).some((x) => x.text === r.lines['6'].toLocaleString('en-US')))
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 SC')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-SC.pdf`, bytes)
})

test('SC1040TC: worksheets for taxes paid to other states, listed credits and the line 13 limit', async () => {
  const w = w2(80000)
  const tc = { otherStates: [{ state: 'nc', income: 20000, tax: 600 }, { state: 'GA', income: 4000, tax: 50 }], lines: { '4': 100 }, other: [{ description: 'Industry partnership', code: '45', amount: 75 }] }
  const { sc: r, res, ret } = sc(base({ w2s: [w] }), { tc })
  const T = r.tc!
  const [nc, ga] = T.worksheets
  assert.equal(nc.l1, 80000)
  assert.equal(nc.l3, 25)
  assert.equal(nc.l4, r.lines['10'])
  assert.equal(nc.l5, Math.round(r.lines['10'] * 0.25))
  assert.equal(nc.l7, Math.min(nc.l5, 600))
  assert.equal(ga.l3, 5)
  assert.equal(ga.l7, 50)
  assert.equal(T.lines['1'], nc.l7 + 50)
  assert.equal(T.lines['16'], T.lines['1'] + 100 + 75)
  assert.equal(T.other[0].code, '45')
  assert.equal(r.lines['13'], Math.min(T.lines['18'], r.lines['10'] - r.lines['11'] - r.lines['12']))
  const packet = buildScPacket(ret, res, r)
  const f = packet.forms.find((x) => x.id === 'sc1040tc')!
  assert.deepEqual(f.pages, [0, 1])
  assert.ok(!packet.notIncluded.some((x) => x.includes('list your credits')))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const x of packet.forms) await fillForm(lib, await load(x.file), { ...x }, problems)
  assert.deepEqual(problems, [])
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-SCTC.pdf`, (await buildPdf(lib, packet.forms, load, '2025 SC')).bytes)
})

test('SC1040TC: a third state gets another worksheet page', () => {
  const w = w2(90000)
  const tc = { otherStates: [{ state: 'NC', income: 10000, tax: 300 }, { state: 'GA', income: 5000, tax: 100 }, { state: 'TN', income: 4000, tax: 50 }], lines: {}, other: [] }
  const { sc: r, res, ret } = sc(base({ w2s: [w] }), { tc })
  assert.equal(r.tc!.worksheets.length, 3)
  assert.equal(r.tc!.lines['1'], r.tc!.worksheets.reduce((s, x) => s + x.l7, 0))
  const forms = buildScPacket(ret, res, r).forms
  const extra = forms.find((f) => f.id === 'sc1040tc-ws2')!
  assert.deepEqual(extra.pages, [1])
  assert.ok(extra.draw!.some((d) => d.text === 'TN'))
})
