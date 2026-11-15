/**
 * Ohio IT 1040 tests, worked by hand from the 2025 Ohio IT 1040 / SD 100 instructions.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { empty1099R, emptyDependent, emptyK1, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { OhInput, TaxReturnInput } from './model.ts'
import { computeOhio, ohExemption, ohRetirementCredit, ohTax } from './oh2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 35 }
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number) => ({ ...emptyDependent(), name: 'Kid Payer', relationship: 'Son', age, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput> = {}, oh: Partial<OhInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), residentState: 'OH', taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, oh: { ...r.oh, ...oh } }
}
const oh = (ret: TaxReturnInput) => computeOhio(ret, computeReturn(ret))

test('tax brackets: the booklet example', () => {
  assert.equal(ohTax(26050), 0)
  assert.equal(ohTax(68050), 1497)
  assert.equal(ohTax(100000), 2376) // 342 + 73,950 × 2.75%
  assert.equal(ohTax(120000), 3019) // 2,394.32 + 20,000 × 3.125%
})

test('exemption amounts and Table 2', () => {
  assert.equal(ohExemption(40000), 2400)
  assert.equal(ohExemption(40001), 2150)
  assert.equal(ohExemption(80001), 1900)
  assert.equal(ohExemption(750000), 0)
  assert.equal(ohRetirementCredit(500), 0)
  assert.equal(ohRetirementCredit(1500), 25)
  assert.equal(ohRetirementCredit(8000), 130)
  assert.equal(ohRetirementCredit(8001), 200)
})

test('single, $60,000 wages', () => {
  const ret = base({ w2s: [w2(60000)] })
  const v = computeOhio({ ...ret, oh: { ...ret.oh, w2: { [ret.w2s[0].id]: { ein: '123456789', stateId: '12345678', stateIncome: null, stateTax: 1300 } } } }, computeReturn(ret))
  assert.equal(v.lines['4'], 2150)
  assert.equal(v.lines['5'], 57850)
  assert.equal(v.lines['8a'], 1217) // 342 + 31,800 × 2.75% = 1,216.50
  assert.equal(v.lines['10'], 1217)
  assert.equal(v.lines['14'], 1300)
  assert.equal(v.lines['23'], 83)
  assert.equal(v.lines['26'], 83)
})

test('joint with a child: exemptions and the joint filing credit (5%)', () => {
  const v = oh(base({ filingStatus: 'mfj', w2s: [w2(50000), w2(40000, 'spouse')], dependents: [kid(7)] }))
  assert.equal(v.exemptionCount, 3)
  assert.equal(v.lines['4'], 5700)
  assert.equal(v.lines['5'], 84300)
  assert.equal(v.lines['8a'], 1944) // 342 + 58,250 × 2.75% = 1,943.88
  assert.equal(v.credits['12'], 97) // 5% of 1,944
  assert.equal(v.lines['10'], 1847)
})

test('low income: no tax and the $20 exemption credit', () => {
  const v = oh(base({ w2s: [w2(25000)] }))
  assert.equal(v.lines['5'], 22600)
  assert.equal(v.lines['8a'], 0)
  assert.equal(v.credits['9'], 20)
  assert.equal(v.lines['10'], 0)
})

test('business income: first $250,000 deducted, the rest at 3%', () => {
  const k = { ...emptyK1('taxpayer'), kind: 'scorp' as const, entityName: 'Widget Inc', ordinary: 300000, materialParticipation: true }
  const ret = base({ k1s: [k] })
  const res = computeReturn(ret)
  const v = computeOhio(ret, res)
  const fagi = Math.round(res.f1040['11a'])
  assert.equal(v.business['10'], 300000)
  assert.equal(v.business['13'], 250000)
  assert.equal(v.lines['3'], fagi - 250000)
  assert.equal(v.lines['4'], 1900)
  const l5 = fagi - 250000 - 1900
  assert.equal(v.business['15'], Math.min(Math.min(300000, fagi) - 250000, l5))
  assert.equal(v.lines['8b'], Math.round(v.business['15'] * 0.03))
})

test('retiree: Social Security deducted, retirement income and senior citizen credits', () => {
  const ret = base({
    taxpayer: { ...person, age: 67, age65OrOlder: true },
    retirement: [{ ...empty1099R(), payer: 'Pension Fund', grossDistribution: 40000, taxableAmount: 40000, code: '7' }],
    socialSecurity: [{ ...emptySocialSecurity(), netBenefits: 24000 }]
  })
  const res = computeReturn(ret)
  const v = computeOhio(ret, res)
  assert.equal(v.adjustments['16'], Math.round(res.f1040['6b']))
  assert.equal(v.lines['3'], Math.round(res.f1040['11a']) - Math.round(res.f1040['6b']))
  assert.equal(v.credits['2'], 200)
  assert.equal(v.credits['4'], 50)
})

test('Ohio EITC is 30% of the federal credit', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(20000)], dependents: [kid(5)] })
  const res = computeReturn(ret)
  const v = computeOhio(ret, res)
  assert.equal(v.credits['13'], Math.round(res.eic.credit * 0.3))
})
