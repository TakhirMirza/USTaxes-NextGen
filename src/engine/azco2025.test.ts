/**
 * Arizona Form 140 and Colorado DR 0104 (2025). Expected values are worked by hand from the 2025 Form 140
 * instructions and the 2025 Book 104 (tax table, DR 0104AD, DR 0104CR, DR 0104CN, DR 0347).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { empty1099Div, empty1099R, emptyDependent, emptyReturn, emptySocialSecurity, emptyW2 } from './model.ts'
import type { AzInput, CoInput, TaxReturnInput } from './model.ts'
import { azDependentFactor, azFamilyMaxIncome, computeArizona } from './az2025.ts'
import { coChildCredit, coFamilyCredit, coTabor, coTax, computeColorado } from './co2025.ts'

const w2 = (wages: number, owner: 'taxpayer' | 'spouse' = 'taxpayer') =>
  ({ ...emptyW2(owner), employer: 'Acme', wages, federalWithholding: 0, socialSecurityWages: wages, medicareWages: wages, socialSecurityWithheld: wages * 0.062, medicareWithheld: wages * 0.0145 })
const kid = (age: number, name = 'Kid Doe') => ({ ...emptyDependent(), name, relationship: 'Son', age, ssn: '111223333', monthsLivedWithYou: 12, childRelationship: true })
const base = (patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r, filingStatus: 'single',
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 },
    ...patch
  }
}
const az = (ret: TaxReturnInput, a: Partial<AzInput> = {}) => {
  const x = { ...ret, residentState: 'AZ', az: { ...ret.az, ...a } }
  return computeArizona(x, computeReturn(x))
}
const co = (ret: TaxReturnInput, c: Partial<CoInput> = {}) => {
  const x = { ...ret, residentState: 'CO', co: { ...ret.co, ...c } }
  const res = computeReturn(x)
  return { co: computeColorado(x, res), res }
}
const withheld = (w: ReturnType<typeof w2>, tax: number) => ({ [w.id]: { ein: '12-3456789', stateId: '', stateIncome: null, stateTax: tax } })

// ── Arizona ──

test('AZ single W-2: $15,750 standard deduction and 2.5%', () => {
  const w = w2(60000)
  const r = az(base({ w2s: [w] }), { w2: withheld(w, 1200) })
  assert.equal(r.lines['42'], 60000)
  assert.equal(r.lines['43'], 15750)
  assert.equal(r.lines['45'], 44250)
  assert.equal(r.lines['46'], 1106) // 44,250 × 2.5% = 1,106.25
  assert.equal(r.lines['52'], 1106)
  assert.equal(r.lines['79'], 94)
})

test('AZ low-income family: dependent, family income and excise credits', () => {
  const w = w2(18000)
  const r = az(base({ filingStatus: 'mfj', w2s: [w], dependents: [kid(5), kid(10, 'Amy Doe')] }), { w2: withheld(w, 100) })
  assert.equal(r.lines['45'], 0)
  assert.equal(r.lines['49'], 200) // two children under 17 × $100
  assert.equal(r.lines['50'], 160) // 18,000 ≤ 23,600; 4 people × $40, under the $240 cap
  assert.equal(r.lines['52'], 0)
  assert.equal(r.lines['56'], 100) // 4 × $25, $100 household cap
  assert.equal(r.lines['79'], 200)
})

test('AZ dependent credit Table V and family credit tables', () => {
  assert.equal(azDependentFactor(201500, false), 0.9) // the instructions' example: $1,500 over → .90
  assert.equal(azDependentFactor(400000, true), 1)
  assert.equal(azDependentFactor(419001, true), 0)
  assert.equal(azDependentFactor(219000, false), 0.05)
  assert.equal(azFamilyMaxIncome('hoh', 2), 20135)
  assert.equal(azFamilyMaxIncome('mfj', 5), 31000)
  assert.equal(azFamilyMaxIncome('single', 3), 10000)
  const w = w2(201500)
  const r = az(base({ w2s: [w], dependents: [kid(8)] }))
  assert.equal(r.lines['49'], 90)
})

test('AZ standard deduction increase: 34% of charitable gifts', () => {
  const ret = base({ w2s: [w2(60000)], itemized: { ...emptyReturn().itemized, charityCash: 1000, charityNonCash: 500 } })
  const r = az(ret)
  assert.equal(r.deduction.method, 'standard')
  assert.equal(r.charity['4C'], 1500)
  assert.equal(r.lines['44'], 510)
  assert.equal(r.lines['45'], 43740)
  assert.equal(r.lines['46'], 1094) // 1,093.50 rounds up
  const credited = az(ret, { charityCreditGifts: 500 })
  assert.equal(credited.lines['44'], 340)
})

test('AZ retiree: government pension exclusion, age exemption, Social Security', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'ASRS', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const ret = base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 66, age65OrOlder: true }, retirement: [pension], socialSecurity: [ss] })
  const res = computeReturn(ret)
  const r = az(ret, { governmentPension: { taxpayer: 30000, spouse: 0 } })
  assert.equal(r.lines['29a'], 2500)
  assert.equal(r.lines['30'], Math.round(res.f1040['6b']))
  assert.equal(r.lines['38'], 2100)
  assert.equal(r.lines['42'], Math.round(res.f1040['11a']) - 2500 - Math.round(res.f1040['6b']) - 2100)
})

test('AZ long-term gain subtraction: 25% of the post-2011 gain', () => {
  const ret = base({ w2s: [w2(50000)] })
  const r0 = az(ret, { ltcgAfter2011: 10000 })
  assert.equal(r0.lines['23'], 0) // no long-term gain on the federal return, so nothing to subtract
  const div = { ...empty1099Div(), payer: 'Fund', ordinaryDividends: 12000, capitalGainDistributions: 12000 }
  const r1 = az({ ...ret, dividends: [div] }, { ltcgAfter2011: 10000 })
  assert.equal(r1.lines['22'], 12000)
  assert.equal(r1.lines['23'], 10000)
  assert.equal(r1.lines['24'], 2500)
  const r2 = az({ ...ret, dividends: [div] }, { ltcgAfter2011: 20000 })
  assert.equal(r2.lines['23'], 12000) // no more than the net long-term gain
  const qss = az(base({ filingStatus: 'qss', w2s: [w2(50000)], dependents: [kid(7)] }))
  assert.equal(qss.status, 'hoh')
  assert.equal(qss.lines['43'], 23625)
})

// ── Colorado ──

test('CO tax table and rate', () => {
  assert.equal(coTax(5), 0)
  assert.equal(coTax(20), 1)
  assert.equal(coTax(5150), 227)
  assert.equal(coTax(44250), 1947)
  assert.equal(coTax(49950), 2198)
  assert.equal(coTax(50001), 2200)
  assert.equal(coTax(-100), 0)
})

test('CO TABOR, child tax credit and family affordability tables', () => {
  assert.equal(coTabor(52000, false), 19)
  assert.equal(coTabor(52001, true), 50)
  assert.equal(coTabor(300000, false), 59)
  assert.equal(coChildCredit(26000, false), 1200)
  assert.equal(coChildCredit(36001, true), 600)
  assert.equal(coChildCredit(77001, false), 0)
  assert.deepEqual(coFamilyCredit(15000, false), { under6: 3273, age6to16: 2455 })
  assert.deepEqual(coFamilyCredit(40000, true), { under6: 2598, age6to16: 1949 })
  assert.deepEqual(coFamilyCredit(85000, false), { under6: 123, age6to16: 92 })
  assert.deepEqual(coFamilyCredit(85001, false), { under6: 0, age6to16: 0 })
})

test('CO single W-2: federal taxable income, table tax, TABOR refund', () => {
  const w = w2(60000)
  const { co: r } = co(base({ w2s: [w] }), { w2: withheld(w, 2000) })
  assert.equal(r.lines['1'], 44250)
  assert.equal(r.lines['12'], 44250)
  assert.equal(r.lines['13'], 1947)
  assert.equal(r.lines['38'], 25)
  assert.equal(r.lines['42'], 2000 + 25 - 1947)
})

test('CO family: child tax credit, family affordability, care credit, EITC', () => {
  const ret = base({ filingStatus: 'mfj', w2s: [w2(40000)], dependents: [kid(4), kid(8, 'Amy Doe')], dependentCare: { expenses: 3000, employerBenefits: 0, providers: [] } })
  const { co: r, res } = co(ret)
  assert.equal(r.lines['1'], 8500)
  assert.equal(r.lines['13'], 372) // row 8,400–8,500: 8,450 × 4.4%
  assert.equal(r.cn['4'], 600) // one child under 6, joint AGI 36,001–61,000
  assert.equal(r.cn['7'], 2598)
  assert.equal(r.cn['10'], 1949)
  assert.equal(r.cr['1'], 5147)
  assert.equal(r.cr['2'], Math.round(res.schedule3.dependentCare * 0.5))
  assert.equal(r.cr['5'], Math.round(res.f1040['27a'] * 0.5))
  assert.equal(r.lines['38'], 38)
  assert.equal(r.lines['42'], r.cr['26'] + 38 - 372)
})

test('CO high income: state income tax and deduction addbacks', () => {
  const ret = base({ w2s: [w2(400000)], itemized: { ...emptyReturn().itemized, stateLocalIncomeOrSalesTax: 20000, realEstateTax: 10000, mortgageInterest: 10000 } })
  const { co: r, res } = co(ret)
  assert.equal(res.deduction.used, 'itemized')
  assert.equal(r.lines['2'], 20000)
  assert.equal(r.lines['4'], Math.round(res.f1040['12e']) - 12000 - 20000)
  assert.equal(co(ret, { deductedSalesTax: true }).co.lines['2'], 0)
})

test('CO retiree 65+: Social Security and $24,000 pension subtraction', () => {
  const pension = { ...empty1099R(), owner: 'taxpayer' as const, payer: 'PERA', grossDistribution: 30000, taxableAmount: 30000, code: '7' }
  const ss = { ...emptySocialSecurity(), owner: 'taxpayer' as const, netBenefits: 24000 }
  const ret = base({ taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 67, age65OrOlder: true }, retirement: [pension], socialSecurity: [ss] })
  const { co: r, res } = co(ret)
  assert.equal(r.ad['3'], Math.round(res.f1040['6b']))
  assert.equal(r.ad['4'], Math.min(24000 - r.ad['3'], 30000))
  // 55–64: pension subtraction is $20,000 less Social Security subtracted.
  const younger = co({ ...ret, taxpayer: { ...ret.taxpayer, age: 60, age65OrOlder: false }, socialSecurity: [] }).co
  assert.equal(younger.ad['4'], 20000)
  const under55 = co({ ...ret, taxpayer: { ...ret.taxpayer, age: 50, age65OrOlder: false }, socialSecurity: [] }).co
  assert.equal(under55.ad['4'], 0)
})

test('CO non-itemizer charitable subtraction over $500', () => {
  const { co: r } = co(base({ w2s: [w2(60000)], itemized: { ...emptyReturn().itemized, charityCash: 1800 } }))
  assert.equal(r.ad['12'], 1300)
  assert.equal(r.lines['12'], 44250 - 1300)
})

test('AZ Form 140PTC property tax credit claim', async () => {
  const r0 = emptyReturn()
  const pension = { ...empty1099R(), payer: 'Pension', grossDistribution: 3000, taxableAmount: 3000 }
  const ret = base({ taxpayer: { ...r0.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 70 }, retirement: [pension] })
  const r = { ...ret, residentState: 'AZ', az: { ...ret.az, ptc: { ...r0.az.ptc, claim: true, birthDate: '01/02/1955', livedAlone: true, own: true, propertyTax: 600 } } }
  const res = computeReturn(r)
  const a = computeArizona(r, res)
  const t = a.ptc!
  assert.equal(t.J, 3000)
  assert.equal(t.lines['11'], 212)
  assert.equal(t.lines['15'], 212)
  assert.equal(t.lines['17'], 25)
  assert.equal(t.lines['19'], 237)
  assert.ok(t.qualifies)
  assert.equal(a.lines['56'], 0)
  const { azPtcCredit } = await import('./az2025.ts')
  assert.equal(azPtcCredit(1750, true), 502); assert.equal(azPtcCredit(1751, true), 479); assert.equal(azPtcCredit(3751, true), 0)
  assert.equal(azPtcCredit(2500, false), 502); assert.equal(azPtcCredit(4901, false), 123); assert.equal(azPtcCredit(5501, false), 0)
  const { buildAzPacket } = await import('../pdf/az2025.ts')
  const { buildPdf, fillForm } = await import('../pdf/fill.ts')
  const lib = await import('pdf-lib')
  const { readFile, writeFile } = await import('node:fs/promises')
  const packet = buildAzPacket(r, res, a)
  const f = packet.forms.find((x) => x.id === 'az140ptc')!
  const formsDir = new URL('../../public/forms/2025/', import.meta.url)
  const problems: { field: string }[] = []
  await fillForm(lib, await readFile(new URL(f.file, formsDir)), { ...f }, problems as never)
  assert.deepEqual(problems, [])
  if (process.env.WRITE_PDF) {
    const { bytes } = await buildPdf(lib, [f], (file: string) => readFile(new URL(file, formsDir)), '2025 AZ 140PTC')
    await writeFile(`${process.env.WRITE_PDF}-AZPTC.pdf`, bytes)
  }
})
