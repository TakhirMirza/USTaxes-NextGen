/**
 * Montana Form 2 (2025), worked by hand from the 2025 Form 2 instructions (rates on page 12, Schedule 2EC tables on
 * pages 40–41).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyTransaction, emptyW2 } from './model.ts'
import type { MtInput, TaxReturnInput } from './model.ts'
import { computeMontana, mtCapitalGainsTax, mtElderlyMultiplier, mtElderlyReduction, mtOrdinaryTax } from './mt2025.ts'
import { buildMtPacket } from '../pdf/mt2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kai Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'MT',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '125 N Roberts St', city: 'Helena', state: 'MT', zip: '59601', phone: '406-555-0100' },
    ...patch
  }
}
const run = (ret: TaxReturnInput, x: Partial<MtInput> = {}) => {
  const r = { ...ret, mt: { ...ret.mt, ...x } }
  const res = computeReturn(r)
  return { mt: computeMontana(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '99-1234567', stateId: '12345678', stateIncome: null, stateTax: tax } })

test('MT ordinary income tax and capital gains tax', () => {
  assert.equal(mtOrdinaryTax(21099, 'single'), Math.round(21099 * 0.047))
  assert.equal(mtOrdinaryTax(44250, 'single'), 2358) // 5.9% × 44,250 − 253
  assert.equal(mtOrdinaryTax(100000, 'mfj'), 5900 - 506)
  assert.equal(mtOrdinaryTax(50000, 'hoh'), 2950 - 380)
  const cg = mtCapitalGainsTax(24250, 10000, 'single')
  assert.deepEqual([cg.l3, cg.l4, cg.l6, cg.l7, cg.l8, cg.l9, cg.l10, cg.l11], [10000, 14250, 6850, 6850, 206, 3150, 129, 335])
})

test('MT Schedule 2EC tables', () => {
  assert.equal(mtElderlyReduction(1999), 0)
  assert.equal(mtElderlyReduction(2000), 0.006)
  assert.equal(mtElderlyReduction(11999), 0.048)
  assert.equal(mtElderlyReduction(12000), 0.05)
  assert.equal(mtElderlyMultiplier(34999), 1)
  assert.equal(mtElderlyMultiplier(37500), 0.4)
  assert.equal(mtElderlyMultiplier(44999), 0.1)
  assert.equal(mtElderlyMultiplier(45000), 0)
})

test('MT single W-2: starts from federal taxable income', () => {
  const w = w2(60000)
  const { mt } = run(base({ w2s: [w] }), { w2: withheld(w, 2500) })
  const L = mt.lines
  assert.equal(L['1'], 60000)
  assert.equal(L['2'], 15750)
  assert.equal(L['7'], 44250)
  assert.equal(L['8'], 2358)
  assert.equal(L['26'], 142)
})

test('MT family: 10% earned income credit', () => {
  const { mt, res } = run(base({ filingStatus: 'mfj', w2s: [w2(25000), w2(15000, 'spouse')], dependents: [kid(3), kid(8, 'Lei Doe')] }))
  assert.equal(mt.lines['7'], 8500)
  assert.equal(mt.lines['8'], 400)
  assert.ok(res.f1040['27a'] > 0)
  assert.equal(mt.lines['15'], Math.round(res.f1040['27a'] * 0.1))
})

test('MT net long-term capital gains taxed at 3% / 4.1%', () => {
  const tx = { ...emptyTransaction(), term: 'long' as const, proceeds: 20000, costBasis: 10000 }
  const { mt } = run(base({ w2s: [w2(30000)], capitalTransactions: [tx] }))
  assert.equal(mt.lines['7'], 24250)
  assert.equal(mt.p2['2'], 10000)
  assert.equal(mt.p2['11'], 335)
  assert.equal(mt.p2['12'], 670)
  assert.equal(mt.lines['8'], 1005)
})

test('MT 65-or-older subtraction, 529 cap and the elderly homeowner/renter credit', () => {
  const p = { ...empty1099R(), payer: 'Pension', grossDistribution: 10000, taxableAmount: 10000 }
  const ss = { ...emptySocialSecurity(), netBenefits: 15000 }
  const r0 = emptyReturn()
  const { mt } = run(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p], socialSecurity: [ss] }),
    { tuition529: 6000, elderly: { claim: true, householdSize: 1, otherHouseholdIncome: 0, governmentAssistance: 0, propertyTaxBilled: 0, rentPaid: 9000, physicalAddress: '' } })
  assert.equal(mt.lines['6'], 5660)
  assert.equal(mt.s1['16'], 4500)
  const ec = mt.ec!
  assert.equal(ec['18'], 25000)
  assert.equal(ec['20'], 12400)
  assert.equal(ec['22'], 620)
  assert.equal(ec['25'], 1350)
  assert.equal(ec['30'], 730)
  assert.equal(mt.lines['16'], 730)
})

test('MT Worksheet B: state income tax added back when itemizing', () => {
  const r0 = emptyReturn()
  const { mt, res } = run(base({ w2s: [w2(150000)], itemized: { ...r0.itemized, mortgageInterest: 20000, stateLocalIncomeOrSalesTax: 8000, realEstateTax: 5000, charityCash: 5000 } }))
  assert.equal(res.deduction.used, 'itemized')
  assert.equal(mt.s1['4'], 8000)
  assert.equal(mt.lines['4'], 8000)
})

test('Form 2: every value lands on one field and the PDF builds', async () => {
  const p = { ...empty1099R(), payer: 'Pension', grossDistribution: 10000, taxableAmount: 10000 }
  const ss = { ...emptySocialSecurity(), netBenefits: 15000 }
  const r0 = emptyReturn()
  const { mt, res, ret } = run(base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [p], socialSecurity: [ss], refundDeposit: { ...r0.refundDeposit, routingNumber: '123456780', accountNumber: '000123456789', accountType: 'checking' } }),
    { tuition529: 2000, usObligationInterest: 100, otherStateBondInterest: 50, contributions: { '1a': 10, '1c': 7 }, birthDates: { taxpayer: '3/4/1955', spouse: '' }, withholding1099: 300,
      elderly: { claim: true, householdSize: 1, otherHouseholdIncome: 0, governmentAssistance: 0, propertyTaxBilled: 0, rentPaid: 9000, physicalAddress: '' } })
  const packet = buildMtPacket(ret, res, mt)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 7, 9])
  assert.equal(packet.forms[0].values['Taxpayer Date of Birth'], '03041955')
  assert.equal(packet.forms[0].values['Schedule IV Line 1a'], '10')
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 MT')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-MT.pdf`, bytes)
})

test('MT Schedule III Part II: credit for tax paid to another state, ordinary and long-term gain parts', async () => {
  const tx = { ...emptyTransaction(), term: 'long' as const, proceeds: 20000, costBasis: 10000 }
  const oc = { state: 'id', amount: 0, income: 12000, stateIncome: 15000, expenses: 0, tax: 500, ltcgIncome: 3000, ltcgTax: 150 }
  const { mt, res, ret } = run(base({ w2s: [w2(30000)], capitalTransactions: [tx] }), { otherStateCredit: oc })
  const Q = mt.s3p2!
  assert.deepEqual([Q['3a'], Q['3'], Q['5'], Q['6'], Q['7'], Q['8'], Q['9'], Q['10']], [30000, 30000, 670, 0.8, 400, 0.4, 268, 268])
  assert.deepEqual([Q['13'], Q['15'], Q['16'], Q['17'], Q['18'], Q['19'], Q['20'], Q['21']], [10000, 335, 0.2, 30, 0.3, 101, 30, 298])
  assert.equal(mt.s3['1'], 298)
  assert.equal(mt.lines['9'], 298)
  assert.ok(!mt.issues.some((x) => x.includes('Schedule III section')))
  const packet = buildMtPacket(ret, res, mt)
  const v = packet.forms[0].values
  assert.equal(v['Schedule III Part II Line 6'], '0.800000')
  assert.equal(v['Schedule III, Part II, Line 2, State'], 'ID')
  assert.ok(packet.forms[0].pages!.includes(6))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 MT')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-MT3.pdf`, bytes)
  // Only an amount: used as entered.
  assert.equal(run(base({ w2s: [w2(30000)] }), { otherStateCredit: { ...oc, income: 0, stateIncome: 0, tax: 0, ltcgIncome: 0, ltcgTax: 0, amount: 120 } }).mt.lines['9'], 120)
})
