/**
 * Connecticut Form CT-1040 (2025). Expected values are worked by hand from the 2025 CT-1040 instructions (Tax
 * Calculation Schedule and Tables A–E, including the instructions' Table B examples), the Pension and Annuity
 * Worksheet, the Property Tax Credit Table and Schedule CT-EITC.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { CtInput, TaxReturnInput } from './model.ts'
import { computeConnecticut, ctExemption, ctInitialTax, ctPensionRate, ctPersonalCredit, ctPhaseOut, ctRecapture, ctTax } from './ct2025.ts'
import { buildCtPacket } from '../pdf/ct2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'CT',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '450 Columbus Blvd', city: 'Hartford', state: 'CT', zip: '06103', phone: '860-555-0100' },
    ...patch
  }
}
const ct = (ret: TaxReturnInput, x: Partial<CtInput> = {}) => {
  const r = { ...ret, ct: { ...ret.ct, ...x } }
  const res = computeReturn(r)
  return { ct: computeConnecticut(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '06-1234567', stateId: '', stateIncome: null, stateTax: tax } })

test('CT tax calculation tables', () => {
  assert.equal(ctInitialTax('single', 13000), 335) // the instructions' examples
  assert.equal(ctInitialTax('single', 525000), 32998)
  assert.equal(ctInitialTax('mfj', 22500), 513)
  assert.equal(ctInitialTax('mfj', 1100000), 69490)
  assert.equal(ctInitialTax('hoh', 20000), 500)
  assert.equal(ctInitialTax('hoh', 825000), 51748)
  assert.equal(ctExemption('single', 30000), 15000)
  assert.equal(ctExemption('single', 30500), 14000)
  assert.equal(ctExemption('mfj', 71500), 0)
  assert.equal(ctPhaseOut('single', 60000), 25)
  assert.equal(ctPhaseOut('hoh', 120000), 400)
  assert.equal(ctRecapture('single', 147000), 225)
  assert.equal(ctRecapture('single', 202000), 340)
  assert.equal(ctRecapture('mfj', 695000), 5900)
  assert.equal(ctRecapture('hoh', 330000), 680)
  assert.equal(ctRecapture('hoh', 900000), 5320)
  assert.equal(ctPersonalCredit('single', 60000), 0.1)
  assert.equal(ctPersonalCredit('mfj', 40200), 0.3)
  assert.equal(ctPersonalCredit('hoh', 80000), 0)
  assert.equal(ctPensionRate('single', 76000), 0.85)
  assert.equal(ctPensionRate('mfj', 160000), 0)
})

test('CT single W-2 of $60,000', () => {
  const w = w2(60000)
  const { ct: r } = ct(base({ w2s: [w] }), { w2: withheld(w, 2500) })
  const T = ctTax('single', 60000)
  assert.equal(T['2'], 0)
  assert.equal(T['4'], 2550)
  assert.equal(T['5'], 25)
  assert.equal(T['9'], 258)
  assert.equal(r.lines['6'], 2317)
  assert.equal(r.lines['26'], 0)
  assert.equal(r.lines['25'], 183)
})

test('CT retirees: Social Security, pensions in full and 75% of IRA distributions', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'Plan', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ira = { ...empty1099R(), owner: 'spouse' as const, payer: 'Broker', grossDistribution: 20000, taxableAmount: 20000, code: '7', ira: true }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const old = { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }
  const { ct: r, res } = ct(base({ filingStatus: 'mfj', taxpayer: old, spouse: { ...old, firstName: 'Sam', ssn: '987654321' }, retirement: [pension, ira], socialSecurity: [ss] }))
  assert.ok(res.f1040['11a'] < 100000)
  assert.equal(r.lines['41'], Math.round(res.f1040['6b']))
  assert.equal(r.lines['48b'], 30000 + 15000)
})

test('CT property tax credit and CT EITC', () => {
  const { ct: r } = ct(base({ w2s: [w2(60000)] }), { residence: { town: 'Hartford', description: '450 Columbus Blvd', datePaid: '07012025', amount: 4000 } })
  assert.equal(r.sch3['66'], 0.3) // $59,500–$69,500
  assert.equal(r.lines['11'], 210)
  const low = ct(base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(4)] }))
  assert.ok(low.res.f1040['27a'] > 0)
  assert.equal(low.ct.lines['20a'], Math.round(low.res.f1040['27a'] * 0.4) + 250)
})

test('CT-1040 and CT-EITC: values are printed on the official forms', async () => {
  const w = w2(22000)
  const { ct: r, res, ret } = ct(base({ filingStatus: 'hoh', w2s: [w], dependents: [kid(4)], refundDeposit: { routingNumber: '011900254', accountNumber: '5551212', accountType: 'checking' } }),
    { w2: withheld(w, 400), usObligationInterest: 50, residence: { town: 'Hartford', description: '450 Columbus Blvd', datePaid: '07012025', amount: 2500 } })
  const packet = buildCtPacket(ret, res, r)
  assert.deepEqual(packet.forms.map((x) => x.id), ['ct1040', 'cteitc', 'ctdep'])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 CT')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-CT.pdf`, bytes)
})

test('CT Schedule 2: credit for income taxes paid to qualifying jurisdictions', async () => {
  const { ct: c, res, ret } = ct(base({ w2s: [w2(100000)] }), { otherStates: [{ name: 'New York', code: 'NY', income: 40000, tax: 1500 }] })
  const s2 = c.sch2!
  assert.equal(s2.line51, c.lines['5'])
  assert.equal(s2.cols[0]['54'], 0.4)
  assert.equal(s2.line55, c.lines['6'] - c.lines['11'])
  assert.equal(s2.cols[0]['56'], Math.round(0.4 * s2.line55))
  assert.equal(c.lines['7'], Math.min(s2.cols[0]['56'], 1500))
  const packet = buildCtPacket(ret, res, c)
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 CT')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-CTS2.pdf`, bytes)
})

test('Schedule CT-Dependent', async () => {
  const { ct: c, res, ret } = ct(base({ filingStatus: 'hoh', w2s: [w2(60000)], dependents: [{ ...emptyDependent(), name: 'Ann Doe', relationship: 'Daughter', age: 7, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true }] }))
  const r2 = { ...ret, ct: { ...ret.ct, dependentBirthDates: { [ret.dependents[0].id]: '03/14/2018' } } }
  const packet = buildCtPacket(r2, res, c)
  const dep = packet.forms.find((f) => f.id === 'ctdep')!
  assert.ok(dep.draw!.some((t) => t.text === 'ANN'))
  assert.ok(dep.draw!.some((t) => t.text === '1' && t.x === 685))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const { bytes } = await buildPdf(lib, [dep], load, '2025 CT-Dependent')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-CTDEP.pdf`, bytes)
})
