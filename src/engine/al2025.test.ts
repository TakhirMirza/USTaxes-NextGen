/**
 * Alabama Form 40 (2025). The engine's tax matches all 1,001 rows of the 2025 tax table (Form 40A booklet) and the
 * standard deduction chart; other expected values are worked by hand from the Form 40 schedules and instructions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyK1, emptyRental, emptyReturn, emptyTransaction, emptyW2 } from './model.ts'
import type { AlInput, TaxReturnInput } from './model.ts'
import { alDependentExemption, alStandardDeduction, alTax, alVehicleInterest, computeAlabama } from './al2025.ts'
import { buildAlPacket } from '../pdf/al2025.ts'
import { buildPdf, fillForm } from '../pdf/fill.ts'
import type { FillProblem } from '../pdf/fill.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single', residentState: 'AL',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    contact: { ...r.contact, street: '50 N Ripley St', city: 'Montgomery', state: 'AL', zip: '36104', phone: '334-555-0100' },
    ...patch
  }
}
const al = (ret: TaxReturnInput, x: Partial<AlInput> = {}) => {
  const r = { ...ret, al: { ...ret.al, ...x } }
  const res = computeReturn(r)
  return { al: computeAlabama(r, res), res, ret: r }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '63-1234567', stateId: '700123456', stateIncome: null, stateTax: tax } })

test('AL tax table, charts and vehicle interest worksheet', () => {
  assert.equal(alTax(23360, true), 1088) // the booklet example
  assert.equal(alTax(4050, false), 163)
  assert.equal(alTax(75, false), 1)
  assert.equal(alTax(101000, false), 5008)
  assert.equal(alStandardDeduction('single', 20000), 3000)
  assert.equal(alStandardDeduction('mfj', 40000), 5000)
  assert.equal(alStandardDeduction('hof', 27000), 4795)
  assert.equal(alDependentExemption(50000), 1000)
  assert.equal(alDependentExemption(50001), 500)
  assert.equal(alDependentExemption(150000), 300)
  assert.equal(alVehicleInterest(3000, 101500, false), 3000 - 400)
})

test('AL single W-2: FICA makes itemizing better; federal tax deduction', () => {
  const w = w2(50000)
  const { al: r, res } = al(base({ w2s: [w] }), { w2: withheld(w, 1800) })
  assert.equal(r.lines['10'], 50000)
  assert.equal(r.schA['6'], 3825) // 7.65% of wages
  assert.equal(r.itemize, true)
  assert.equal(r.lines['11'], 3825)
  assert.equal(r.lines['12'], Math.round(res.f1040['22']))
  assert.equal(r.lines['16'], 50000 - 3825 - r.lines['12'] - 1500)
  assert.equal(r.lines['17'], alTax(r.lines['16'], false))
  assert.equal(r.lines['22'], 1800)
})

test('AL retiree: exempt defined benefit pension and the $6,000 exclusion at 65', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'RSA', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ira = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'Broker', grossDistribution: 10000, taxableAmount: 10000, code: '7', ira: true }
  const { al: r } = al(base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70, age65OrOlder: true }, retirement: [pension, ira] }),
    { retirement: { [pension.id]: { exempt: true, reason: 'Defined benefit plan', fein: '63-0000000', stateId: '', stateTax: 0 }, [ira.id]: { exempt: false, reason: '', fein: '', stateId: '', stateTax: 200 } } })
  assert.equal(r.rs.taxpayer.taxable, 10000)
  assert.equal(r.rs.taxpayer.exclusion, 6000)
  assert.equal(r.partI['4'], 4000)
  assert.equal(r.lines['10'], 4000)
  assert.equal(r.lines['22'], 200)
})

test('AL family: dependent exemptions by AGI, head of family', () => {
  const { al: r } = al(base({ filingStatus: 'mfj', w2s: [w2(60000), w2(20000, 'spouse')], dependents: [kid(5), kid(10, 'Amy Doe')] }))
  assert.equal(r.lines['13'], 3000)
  assert.equal(r.lines['14'], 1000) // AGI $80,000: $500 each
  const hof = al(base({ filingStatus: 'hoh', w2s: [w2(30000)], dependents: [kid(8)] })).al
  assert.equal(hof.status, 'hof')
  assert.equal(hof.lines['13'], 3000)
  assert.equal(hof.lines['14'], 1000)
})

test('Form 40: every value lands on one field and the PDF builds', async () => {
  const w = w2(60000)
  const pension = { ...empty1099R(), owner: 'spouse' as const, payer: 'TRS of Alabama', grossDistribution: 20000, taxableAmount: 20000, code: '7' }
  const ira = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'Broker', grossDistribution: 5000, taxableAmount: 5000, code: '7', ira: true }
  const base0 = emptyReturn()
  const interest = [{ id: 'i1', payer: 'Bank', interest: 1200, taxExemptInterest: 0, federalWithholding: 0 }, { id: 'i2', payer: 'Treasury', interest: 800, taxExemptInterest: 0, federalWithholding: 0 }]
  const { al: r, res, ret } = al(base({ filingStatus: 'mfj', w2s: [w, w2(25000, 'spouse')], dependents: [kid(5), kid(10, 'Amy Doe')], retirement: [pension, ira], interest,
    itemized: { ...base0.itemized, mortgageInterest: 9000, realEstateTax: 1500, charityCash: 1200 },
    refundDeposit: { routingNumber: '062000019', accountNumber: '5551212', accountType: 'checking' } }),
  { w2: withheld(w, 2400), birthDate: { taxpayer: '01/02/1985', spouse: '03/04/1986' }, interest: { i2: { usObligation: 800, taxableMuni: 0 } },
    retirement: { [pension.id]: { exempt: true, reason: 'TRS', fein: '63-0000001', stateId: '', stateTax: 0 } }, license: { ...base0.al.license, taxpayer: { state: 'AL', number: '1234567', issued: '01/01/2022', expires: '01/01/2030' } } })
  assert.equal(r.lines['6'], 1200)
  const packet = buildAlPacket(ret, res, r)
  assert.deepEqual(packet.forms[0].pages, [0, 1, 2, 3, 4, 6, 7, 8])
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, packet.forms, load, '2025 AL')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-AL.pdf`, bytes)
})

test('AL Schedules D and E: full capital loss, rentals and K-1s', async () => {
  const t = (description: string, term: 'short' | 'long', proceeds: number, costBasis: number) => ({ ...emptyTransaction(), description, term, proceeds, costBasis, dateAcquired: '01/02/2020', dateSold: '06/30/2025' })
  const rental = { ...emptyRental(), address: '12 Oak St, Mobile, AL', fairRentalDays: 365, rents: 12000, expenses: { ...emptyRental().expenses, mortgageInterest: 5000, taxes: 2000, depreciation: 3000 } }
  const k1 = { ...emptyK1(), entityName: 'Gulf Partners LP', ein: '63-1234567', ordinary: 1500 }
  const { al: a, res, ret } = al(base({ w2s: [w2(50000)], capitalTransactions: [t('100 sh ABC', 'long', 20000, 10000), t('50 sh XYZ', 'short', 2000, 10000), t('Fund DEF', 'long', 4000, 10000)], rentals: [rental], k1s: [k1] }))
  assert.equal(res.f1040['7a'], -3000)
  assert.equal(a.partI['3'], -4000)
  assert.equal(a.schD.length, 3)
  assert.equal(a.schE.properties[0].lines['22'], 2000)
  assert.equal(a.schE.line24, 1500)
  assert.equal(a.partI['5'], 3500)
  const packet = buildAlPacket(ret, res, a)
  const de = packet.forms.find((f) => f.id === 'alschde')!
  assert.deepEqual(de.pages, [0, 1])
  assert.ok(de.draw!.some((d) => d.text === '(4000)'))
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
  const problems: FillProblem[] = []
  for (const f of packet.forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, [de], load, '2025 AL D&E')
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-ALDE.pdf`, bytes)
})
