/**
 * Oklahoma Form 511 (2025). The engine's tax matches all 2,000 rows of the 2025 tax table and both worksheets
 * ($100,000: $4,562 single, $4,373 joint); other expected values are worked by hand from the 2025 Form 511 packet.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099Div, empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { OkInput, TaxReturnInput } from './model.ts'
import { computeOklahoma, okEic2020Table, okTax } from './ok2025.ts'
import { buildOkPacket } from '../pdf/ok2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'OK',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '2501 N Lincoln Blvd', city: 'Oklahoma City', state: 'OK', zip: '73194', phone: '405-555-0100' },
    ...patch
  }
}
const ok = (ret: TaxReturnInput, x: Partial<OkInput> = {}) => {
  const r = { ...ret, ok: { ...ret.ok, county: 'Oklahoma', ...x } }
  const res = computeReturn(r)
  return { ok: computeOklahoma(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '73-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('OK tax table and worksheets', () => {
  assert.equal(okTax(14793, true), 325) // the packet's example
  assert.equal(okTax(14793, false), 513)
  assert.equal(okTax(225, false), 1)
  assert.equal(okTax(99000, false), 4513 + 2)
  assert.equal(okTax(100000, false), 4562)
  assert.equal(okTax(100000, true), 4373)
  assert.equal(okTax(110000, false), 4562 + 475)
})

test('OK single W-2: standard deduction and one exemption', () => {
  const w = w2(60000)
  const { ok: r } = ok(base({ w2s: [w] }), { w2: withheld(w, 2000) })
  assert.equal(r.lines['10'], 6350)
  assert.equal(r.lines['11'], 1000)
  assert.equal(r.lines['13'], 52650)
  assert.equal(r.lines['14'], 2314) // row 52,650–52,700
  assert.equal(r.lines['39'], 314)
})

test('OK retiree: Social Security and the $10,000 retirement exclusion (government first)', () => {
  const ira = { ...empty1099R(), id: 'ira', owner: 'taxpayer' as const, payer: 'Broker', grossDistribution: 15000, taxableAmount: 15000, code: '7', ira: true }
  const ops = { ...empty1099R(), id: 'opers', owner: 'taxpayer' as const, payer: 'OPERS', grossDistribution: 8000, taxableAmount: 8000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 20000 }
  const { ok: r, res } = ok(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [ira, ops], socialSecurity: [ss] }), { retirementKind: { opers: 'okgov' } })
  assert.equal(r.schA['5'], 8000)
  assert.equal(r.schA['6'], 2000)
  assert.equal(r.schA['2'], Math.round(res.f1040['6b']))
  assert.equal(r.lines['7'], Math.round(res.f1040['11a']) - 10000 - r.schA['2'])
  const military = ok(base({ retirement: [{ ...ops, payer: 'DFAS' }] }), { retirementKind: { opers: 'military' } }).ok
  assert.equal(military.schA['4'], 8000)
})

test('OK credits: 5% of the child tax credit, 5% of EIC prorated', () => {
  const { ok: r, res } = ok(base({ filingStatus: 'mfj', w2s: [w2(50000)], dependents: [kid(5), kid(8, 'Amy Doe')] }))
  assert.equal(r.schF['3'], 4400)
  assert.equal(r.lines['15'], 220)
  const low = ok(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(4)] })).ok
  assert.ok(low.schG['1'] > 0)
  assert.equal(low.lines['28'], Math.round(low.schG['1'] * 0.05))
  // Form 511-EIC uses the 2020 federal credit: one child, $20,000 → 2020 table row $20,000–$20,050 = $3,473 (the 2025 credit is larger).
  assert.equal(low.eic!.line20[1], 3473)
  assert.equal(low.schG['1'], 3473)
  void res
})

test('OK earned income credit: 2020 rules, the larger of the 2024 and 2025 columns, 2020 investment income limit', () => {
  assert.equal(okEic2020Table(10000, 0, false), 538 - Math.round(0.0765 * (10025 - 8790)) || 0)
  assert.equal(okEic2020Table(15820, 0, false), 0)
  assert.equal(okEic2020Table(5000, 2, true), Math.round(0.4 * 5025))
  assert.equal(okEic2020Table(53330, 2, true), 0)
  const kidRet = (patch = {}) => base({ filingStatus: 'hoh', w2s: [w2(30000)], dependents: [kid(4)], ...patch })
  const y25 = ok(kidRet()).ok
  const both = ok({ ...kidRet(), ok: { ...kidRet().ok, priorYearEic: { earnedIncome: 22000, agi: 22000 } } }).ok
  assert.ok(both.eic!.line20[0] > both.eic!.line20[1])
  assert.equal(both.schG['1'], both.eic!.line20[0])
  assert.equal(y25.schG['1'], y25.eic!.line20[1])
  const rich = ok(kidRet({ dividends: [{ ...empty1099Div(), payer: 'Fund', ordinaryDividends: 5000 }] })).ok
  assert.equal(rich.eic, null)
  assert.equal(rich.lines['28'], 0)
})

test('OK itemized: state income tax removed, $17,000 limit apart from medical and gifts', () => {
  const b0 = emptyReturn()
  const { ok: r, res } = ok(base({ w2s: [w2(200000)], itemized: { ...b0.itemized, stateLocalIncomeOrSalesTax: 6000, realEstateTax: 3000, mortgageInterest: 18000, charityCash: 5000 } }))
  assert.equal(res.deduction.used, 'itemized')
  const D = r.schD!
  assert.equal(D['2'], 6000)
  assert.equal(D['6'], D['3'] - D['5'])
  assert.equal(D['limited'], 1)
  assert.equal(r.lines['10'], 17000 + 5000)
})

test('Form 511: every value lands on one field and the PDF builds', async () => {
  const w = w2(35000)
  const ira = { ...empty1099R(), id: 'ira', owner: 'spouse' as const, payer: 'Broker', grossDistribution: 4000, taxableAmount: 4000, code: '7', ira: true }
  const { ok: r, res, ret } = ok(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(5)], retirement: [ira],
    refundDeposit: { routingNumber: '103000648', accountNumber: '5551212', accountType: 'checking' } }),
  { w2: withheld(w, 2500), usObligationInterest: 60, dependentBirthDates: {} })
  const packet = buildOkPacket(ret, res, r)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 5, 6]) // U.S. interest makes Oklahoma AGI smaller: 511-F and 511-G prorate
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 OK')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-OK.pdf`, bytes)
})

test('Forms 511-EIC, 511-TX, 511-CR and 538-S print on the official forms', async () => {
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const w = w2(18000)
  const { ok: r, res, ret } = ok(base({ filingStatus: 'hoh', w2s: [w], dependents: [kid(4)] }),
    { w2: withheld(w, 300), salesTaxCredit: 80, otherStateCredit: 500, otherStateName: 'Texas', otherStateIncome: 6000, otherCredit: { code: '20', amount: 40 }, priorYearEic: { earnedIncome: 16000, agi: 16000 } })
  const packet = buildOkPacket(ret, res, r)
  const ids = packet.forms.map((f) => f.id)
  for (const id of ['ok511eic', 'ok538s']) assert.ok(ids.includes(id), ids.join(', '))
  const eic = packet.forms.find((f) => f.id === 'ok511eic')!.values
  assert.equal(eic['Part II Tax Year 2024 Line 15'], '18,000')
  assert.equal(eic['Part II Tax Year 2024 Line 20'], r.eic!.line20[1].toLocaleString('en-US'))
  assert.equal(eic['Part II Tax Year 2023 Line 20'], r.eic!.line20[0].toLocaleString('en-US'))
  const s = packet.forms.find((f) => f.id === 'ok538s')!.values
  assert.equal(s['538-S Part 3 1'], '18,000')
  assert.equal(s['538-S Exemptions D1'], '2')
  assert.equal(s['538-S Part 4 15-3'], '80')
  if (r.tx['7']) {
    const tx = packet.forms.find((f) => f.id === 'ok511tx')!.values
    assert.equal(tx['6 Tax Paid To'], 'TEXAS')
    assert.equal(r.tx['5'], Math.round(r.lines['14'] * r.tx['3']))
  }
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  // A taxpayer with tax: the 511-TX limitation and the 511-CR line.
  const w9 = w2(60000)
  const t = ok(base({ w2s: [w9] }), { w2: withheld(w9, 2000), otherStateCredit: 900, otherStateName: 'Kansas', otherStateIncome: 15000, otherCredit: { code: '20', amount: 50 } })
  assert.equal(t.ok.tx['3'], 15000 / t.ok.lines['7'])
  assert.equal(t.ok.lines['16'], Math.min(900, Math.round(t.ok.lines['14'] * t.ok.tx['3'])))
  const pt = buildOkPacket(t.ret, t.res, t.ok)
  const tx = pt.forms.find((f) => f.id === 'ok511tx')!.values
  assert.equal(tx['6 Tax Paid To'], 'KANSAS')
  assert.equal(tx['6d'], '900'); assert.equal(tx['6c'], '00')
  const cr = pt.forms.find((f) => f.id === 'ok511cr')!.values
  assert.equal(cr['C 20'], '50'); assert.equal(cr['C 30c'], '50')
  const problems2: FillProblem[] = []
  for (const f of pt.forms) await fillForm(lib, await load(f.file), { ...f }, problems2)
  assert.deepEqual(problems2, [])
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-OK-more.pdf`, (await buildPdf(lib, [...packet.forms, ...pt.forms], load, 'OK')).bytes)
})
