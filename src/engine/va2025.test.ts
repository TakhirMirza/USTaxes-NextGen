/**
 * Virginia Form 760 tests. Expected values are worked by hand from the 2025 Form 760 instructions
 * (tax rate schedule, Age Deduction Worksheet, Spouse Tax Adjustment Worksheet, Schedule ADJ).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyAsset, emptyBusiness, emptyDependent, emptyReturn, emptyVaEntry, emptyVaSavers, emptyW2, empty1099R, normalizeReturn } from './model.ts'
import type { TaxReturnInput, VirginiaInput } from './model.ts'
import { computeVirginia, povertyGuideline, vaTax } from './va2025.ts'

const person = { ...emptyReturn().taxpayer, firstName: 'Test', lastName: 'Payer', age: 40 }
const base = (patch: Partial<TaxReturnInput> = {}, va: Partial<VirginiaInput> = {}): TaxReturnInput => {
  const r = { ...emptyReturn(), taxpayer: { ...person }, spouse: { ...person, firstName: 'Pat' }, ...patch }
  return { ...r, virginia: { ...r.virginia, enabled: true, localityCode: '043', ...va } }
}
const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, federalWithholding: 0, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const va = (ret: TaxReturnInput) => computeVirginia(ret, computeReturn(ret))

test('Virginia tax rate schedule', () => {
  assert.equal(vaTax(0), 0)
  assert.equal(vaTax(3000), 60)
  assert.equal(vaTax(5000), 120)
  assert.equal(vaTax(17000), 720)
  assert.equal(vaTax(90000), 4918) // the instructions' example: $720 + 5.75% of $73,000 = $4,917.50
  assert.equal(povertyGuideline(1), 15650)
  assert.equal(povertyGuideline(10), 54150 + 2 * 5500)
})

test('single wage earner: standard deduction, one exemption, balance due', () => {
  const v = va(base({ w2s: [w2(60000)] }, { withholding: { taxpayer: 2500, spouse: 0 } }))
  assert.equal(v.status, 1)
  assert.equal(v.lines['1'], 60000)
  assert.equal(v.lines['9'], 60000)
  assert.equal(v.lines['11'], 8750)
  assert.equal(v.lines['12'], 930)
  assert.equal(v.lines['15'], 50320)
  assert.equal(v.lines['16'], 2636) // 720 + 5.75% × 33,320 = 2,635.90
  assert.equal(v.lines['27'], 136)
  assert.equal(v.lines['35'], 136)
  assert.equal(v.underpayment.safe, true) // $150 or less
  assert.equal(v.adj.needed, false)
})

test('income-based age deduction is reduced dollar for dollar over $50,000', () => {
  const ret = base({
    taxpayer: { ...person, age: 70, age65OrOlder: true },
    w2s: [w2(40000)], retirement: [{ ...empty1099R(), payer: 'IRA', grossDistribution: 20000, taxableAmount: 20000, code: '7', ira: true }]
  }, { birthDate: { taxpayer: '03/15/1955', spouse: '' } })
  const v = va(ret)
  assert.equal(v.age.kind.taxpayer, 'income')
  assert.equal(v.age.afagi, 60000)
  assert.equal(v.lines['4'], 2000)
  assert.equal(v.exemptions.countB, 1)
  assert.equal(v.lines['12'], 1730)
  assert.equal(v.lines['15'], 60000 - 2000 - 8750 - 1730)
  assert.equal(v.lines['16'], 2475)
})

test('born on or before January 1, 1939: full $12,000 whatever the income', () => {
  const ret = base({ taxpayer: { ...person, age: 87, age65OrOlder: true }, w2s: [w2(150000)] }, { birthDate: { taxpayer: '06/01/1938', spouse: '' } })
  assert.equal(va(ret).lines['4'], 12000)
})

test('married, both income-based: joint AFAGI over $75,000 reduces the $24,000 pool, split in half', () => {
  const ret = base({
    filingStatus: 'mfj',
    taxpayer: { ...person, age: 66, age65OrOlder: true }, spouse: { ...person, firstName: 'Pat', age: 66, age65OrOlder: true },
    w2s: [w2(50000), w2(30000, 'spouse')]
  }, { birthDate: { taxpayer: '02/02/1959', spouse: '05/05/1959' } })
  const v = va(ret)
  assert.equal(v.age.claimants, 2)
  assert.equal(v.lines['4you'], 9500)
  assert.equal(v.lines['4spouse'], 9500)
  assert.equal(v.lines['4'], 19000)
})

test('spouse tax adjustment matches the worksheet (instructions example: $220)', () => {
  // Line 15 = 66,360 − 17,500 − 1,860 = 47,000; spouse VAGI 12,930 − 930 = 12,000.
  const v = va(base({ filingStatus: 'mfj', w2s: [w2(53430), w2(12930, 'spouse')] }))
  assert.equal(v.lines['15'], 47000)
  assert.ok(v.sta)
  assert.equal(v.sta.vagi.spouse, 12930)
  assert.equal(v.sta.line5, 12000)
  assert.equal(v.sta.line8, 470)
  assert.equal(v.sta.line9, 1755)
  assert.equal(v.lines['16'], 2445)
  assert.equal(v.lines['17'], 220)
  assert.equal(v.lines['18'], 2225)
})

test('spouse tax adjustment is $259 when both spouses have over $17,000 and line 15 is over $34,000', () => {
  const v = va(base({ filingStatus: 'mfj', w2s: [w2(70000), w2(50000, 'spouse')] }))
  assert.equal(v.lines['17'], 259)
  assert.equal(v.sta?.capped, true)
})

test('credit for low-income individuals beats 20% of a small federal EIC', () => {
  const v = va(base({ w2s: [w2(14000)] }))
  assert.equal(v.lines['9'], 14000)
  assert.equal(v.lines['16'], 100) // 14,000 − 8,750 − 930 = 4,320 → 60 + 3% × 1,320 = 99.60
  assert.equal(v.lowIncome.eligible, true)
  assert.equal(v.lowIncome.line13, 300)
  assert.equal(v.lowIncome.option, 'nonrefundable')
  assert.equal(v.lines['23'], 100)
  assert.equal(v.lines['27'], 0)
  assert.equal(v.adj.needed, true)
})

test('refundable Virginia EIC: 20% of the federal credit', () => {
  const ret = base({ filingStatus: 'hoh', w2s: [w2(25000)], dependents: [{ ...emptyDependent(), name: 'Kid', relationship: 'Son', age: 6, ssn: '123456789' }] })
  const res = computeReturn(ret)
  const v = computeVirginia(ret, res)
  assert.ok(res.eic.credit > 0)
  assert.equal(v.hoh, true)
  assert.equal(v.lowIncome.line16b, Math.round(res.eic.credit * 0.2))
  assert.equal(v.lowIncome.option, 'refundable')
  assert.equal(v.lines['23'], v.lowIncome.line16b)
})

test('automatic Schedule ADJ lines: unemployment (37), child care (101), Commonwealth Savers (104)', () => {
  const ret = base({
    w2s: [w2(70000)], unemployment: 3000,
    dependents: [{ ...emptyDependent(), name: 'Kid', relationship: 'Daughter', age: 5, ssn: '123456789' }],
    filingStatus: 'hoh',
    dependentCare: { expenses: 4000, employerBenefits: 0, providers: [] }
  }, { savers: [{ ...emptyVaSavers(), account: 'Invest529', contributed: 5000 }], subtractions: [{ ...emptyVaEntry('39'), amount: 0 }] })
  const v = va(ret)
  assert.deepEqual(v.adj.subtractions.map((s) => [s.code, s.amount]), [['37', 3000]])
  assert.deepEqual(v.adj.deductions.map((s) => [s.code, s.amount]), [['101', 3000], ['104', 4000]])
  assert.equal(v.lines['7'], 3000)
  assert.equal(v.lines['13'], 7000)
  assert.ok(v.issues.some((i) => i.includes('1,000 to 2026')))
})

test('bonus depreciation is added back for Virginia', () => {
  const biz = { ...emptyBusiness(), name: 'Shop', grossReceipts: 50000, assets: [{ ...emptyAsset('5'), description: 'Computer', placedInService: '06/01/2025', cost: 10000 }] }
  const v = va(base({ businesses: [biz] }))
  assert.equal(v.adj.bonusAddition, 8000) // 10,000 bonus federally vs 20% MACRS (half-year, 200% DB)
  assert.equal(v.adj.lines['2a'], 8000)
  assert.equal(v.lines['2'], 8000)
})

test('below the filing threshold: no tax, withholding refunded', () => {
  const v = va(base({ w2s: [w2(9000)] }, { withholding: { taxpayer: 200, spouse: 0 } }))
  assert.equal(v.belowThreshold, true)
  assert.equal(v.lines['16'], 0)
  assert.equal(v.lines['36'], 200 + v.lines['23'])
})

test('refund less credit forward and contributions', () => {
  const v = va(base({ w2s: [w2(60000)] }, { withholding: { taxpayer: 3500, spouse: 0 }, creditForward: 300, vacOther: 25 }))
  assert.equal(v.lines['28'], 3500 - 2636)
  assert.equal(v.lines['34'], 325)
  assert.equal(v.lines['36'], 3500 - 2636 - 325)
})

test('dependent filer: standard deduction limited to earned income', () => {
  const v = va(base({ canBeClaimedAsDependent: true, w2s: [w2(5000)] }))
  assert.equal(v.lines['11'], 5000)
})

test('older saved returns get Virginia defaults', () => {
  const r = normalizeReturn({ filingStatus: 'single', virginia: { enabled: true, withholding: { taxpayer: 10 } } })
  assert.equal(r.virginia.enabled, true)
  assert.equal(r.virginia.withholding.spouse, 0)
  assert.deepEqual(r.virginia.additions, [])
  assert.equal(normalizeReturn({}).virginia.enabled, false)
})

test('birth dates typed without slashes still count, and a mismatch with the federal age is flagged', () => {
  for (const bd of ['03/15/1955', '03-15-1955', '03151955', '3.15.1955']) {
    const ret = base({ taxpayer: { ...person, age: 70, age65OrOlder: true }, w2s: [w2(40000)] }, { birthDate: { taxpayer: bd, spouse: '' } })
    const v = va(ret)
    assert.equal(v.age.kind.taxpayer, 'income', bd)
    assert.equal(v.exemptions.countB, 1, bd)
  }
  const odd = va(base({ w2s: [w2(40000)] }, { birthDate: { taxpayer: '1955', spouse: '' } }))
  assert.ok(odd.issues.some((i) => i.includes('cannot be read')))
  const mismatch = va(base({ w2s: [w2(40000)] }, { birthDate: { taxpayer: '08/14/1959', spouse: '' } }))
  assert.ok(mismatch.issues.some((i) => i.includes('does not match the age')))
})
