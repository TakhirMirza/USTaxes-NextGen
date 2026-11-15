/**
 * DC Form D-40 tests, worked by hand from the 2025 D-40 Booklet: tax tables ($50 rows) and
 * Calculation I, DC standard deduction, Calculation F, DC EITC and the Schedule H worksheet.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from './model.ts'
import type { DcInput, TaxReturnInput } from './model.ts'
import { computeDc, dcTax } from './dc2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 35 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const base = (patch: Partial<TaxReturnInput> = {}, dc: Partial<DcInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'DC', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, dc: { ...r.dc, ...dc } }
}
const dc = (ret: TaxReturnInput) => computeDc(ret, computeReturn(ret))

test('tax tables ($50 rows at their middle) and Calculation I', () => {
  assert.equal(dcTax(40), 0)
  assert.equal(dcTax(75), 3)
  assert.equal(dcTax(2525), 101)
  assert.equal(dcTax(5049), 201)
  assert.equal(dcTax(60010), 3502)
  assert.equal(dcTax(250000), 19650)
  assert.equal(dcTax(1000000), 91525)
})

test('single wage earner: DC standard deduction $15,000 (not the federal $15,750)', () => {
  const v = dc(base({ w2s: [w2(60000)] }, { withholding: 2600 }))
  assert.equal(v.lines['16'], 60000)
  assert.equal(v.lines['18'], 15000)
  assert.equal(v.lines['19'], 45000)
  assert.equal(v.lines['20'], 2527) // 2,200 + 6.5% × 5,025
  assert.equal(v.lines['38'], 73)
  assert.equal(v.lines['43'], 73)
})

test('additional standard deduction for 65 or older', () => {
  const v = dc(base({ taxpayer: { ...person, age: 70, age65OrOlder: true }, w2s: [w2(40000)] }))
  assert.equal(v.lines['18'], 15000 + 2000)
})

test('unemployment is in line a and subtracted on line 13', () => {
  const v = dc(base({ w2s: [w2(20000)], unemployment: 5000 }))
  assert.equal(v.lines['a'], 25000)
  assert.equal(v.lines['13'], 5000)
  assert.equal(v.lines['16'], 20000)
})

test('DC EITC is 100% of the federal credit with a qualifying child', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(25000)], dependents: [{ ...emptyDependent(), name: 'Kid', relationship: 'Son', age: 6, ssn: '123456789' }] })
  const res = computeReturn(ret)
  const v = computeDc(ret, res)
  assert.ok(res.eic.credit > 0)
  assert.equal(v.lines['27d'], Math.round(res.eic.credit))
  assert.equal(v.lines['18'], 22500)
})

test('DC EITC without a qualifying child: $649, phased out at 8.48% over $23,288', () => {
  assert.equal(dc(base({ w2s: [w2(10000)] })).lines['27e'], 649)
  assert.equal(dc(base({ w2s: [w2(25000)] })).lines['27e'], 504) // 649 − 1,712 × 0.0848
  assert.equal(dc(base({ w2s: [w2(5000)] })).lines['27e'], 383) // 5,000 × 7.65%
  assert.equal(dc(base({ w2s: [w2(31000)] })).lines['27e'], 0)
})

test('Calculation F: state taxes out, full real estate tax back in, 5% limit over $200,000', () => {
  const v = dc(base({
    w2s: [w2(300000)], deductionChoice: 'itemized',
    itemized: { ...emptyReturn().itemized, stateLocalIncomeOrSalesTax: 20000, realEstateTax: 10000, mortgageInterest: 20000, charityCash: 5000 }
  }))
  assert.equal(v.deduction.method, 'itemized')
  assert.equal(v.deduction.itemized?.f, 35000)
  assert.equal(v.deduction.itemized?.reduction, 5000)
  assert.equal(v.lines['18'], 30000)
  assert.equal(v.lines['20'], 21500) // 19,650 + 9.25% × 20,000
})

test('Schedule H: 20% of rent over 4% of AGI, capped at $1,425', () => {
  const v = dc(base({ w2s: [w2(30000)] }, { housing: 'rent', housingAmount: 18000 }))
  assert.equal(v.propertyCredit.base, 3600)
  assert.equal(v.propertyCredit.threshold, 1200)
  assert.equal(v.lines['28'], 1425)
  const small = dc(base({ w2s: [w2(20000)] }, { housing: 'rent', housingAmount: 6000 }))
  assert.equal(small.lines['28'], 1200 - 600) // 20% of 6,000 less 3% of 20,000
  const high = dc(base({ w2s: [w2(70000)] }, { housing: 'rent', housingAmount: 30000 }))
  assert.equal(high.lines['28'], 0)
})

test('Schedule I: other states’ bond interest added, U.S. obligations subtracted, college savings capped', () => {
  const v = dc(base({ w2s: [w2(50000)] }, { otherStateBondInterest: 800, usObligationInterest: 300, collegeSavings: 6000 }))
  assert.equal(v.lines['6'], 800)
  assert.equal(v.lines['14'], 300 + 4000)
  assert.equal(v.lines['16'], 50000 + 800 - 4300)
})
