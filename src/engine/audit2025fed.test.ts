/**
 * 2025 audit: federal tax figured independently from Rev. Proc. 2024-40 (brackets, EIC, AMT) as amended by P.L. 119-21
 * (OBBBA: standard deduction $15,750 / $31,500 / $23,625, child tax credit $2,200, senior deduction $6,000).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReturn } from './compute.ts'
import { emptyDependent, emptyReturn, emptyW2, empty1099R } from './model.ts'
import type { TaxReturnInput } from './model.ts'

type Fs = TaxReturnInput['filingStatus']
const BR: Record<Fs, number[]> = {
  single: [11925, 48475, 103350, 197300, 250525, 626350],
  mfj: [23850, 96950, 206700, 394600, 501050, 751600],
  qss: [23850, 96950, 206700, 394600, 501050, 751600],
  mfs: [11925, 48475, 103350, 197300, 250525, 375800],
  hoh: [17000, 64850, 103350, 197300, 250500, 626350]
}
const RATES = [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
const sched = (x: number, fs: Fs): number => RATES.reduce((t, rate, i) => t + Math.max(0, Math.min(x, BR[fs][i] ?? Infinity) - (i ? BR[fs][i - 1] : 0)) * rate, 0)
const STD: Record<Fs, number> = { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625, qss: 31500 }
const kid = (age: number, ssn: string) => ({ ...emptyDependent(), name: `Kid ${ssn}`, relationship: 'Son', age, ssn, monthsLivedWithYou: 12, childRelationship: true })
const ret = (fs: Fs, patch: Partial<TaxReturnInput>): TaxReturnInput => {
  const r = emptyReturn()
  return { ...r, filingStatus: fs, taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 }, spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Doe', ssn: '987654321', age: 40 }, ...patch }
}

test('Tax on $250,000 of wages for every filing status: Tax Computation Worksheet with the OBBBA standard deduction', () => {
  for (const fs of ['single', 'mfj', 'mfs', 'hoh', 'qss'] as Fs[]) {
    const deps = fs === 'hoh' || fs === 'qss' ? [kid(20, '111223333')] : []
    const r = computeReturn(ret(fs, { w2s: [{ ...emptyW2('taxpayer'), employer: 'A', wages: 250000, medicareWages: 250000, socialSecurityWages: 176100 }], dependents: deps }))
    assert.equal(r.f1040['12e'], STD[fs], `${fs} standard deduction`)
    assert.equal(r.f1040['15'], 250000 - STD[fs], `${fs} taxable income`)
    assert.equal(r.f1040['16'], Math.round(sched(250000 - STD[fs], fs)), `${fs} tax`)
  }
})

test('Tax Table below $100,000: tax on the midpoint of the $50 row (single, $60,000 wages)', () => {
  const r = computeReturn(ret('single', { w2s: [{ ...emptyW2('taxpayer'), employer: 'A', wages: 60000, medicareWages: 60000, socialSecurityWages: 60000 }] }))
  const ti = 60000 - 15750
  assert.equal(r.f1040['16'], Math.round(sched(Math.floor(ti / 50) * 50 + 25, 'single')))
})

test('Child tax credit $2,200 per child (MFJ, two children, $120,000)', () => {
  const r = computeReturn(ret('mfj', { w2s: [{ ...emptyW2('taxpayer'), employer: 'A', wages: 120000, medicareWages: 120000, socialSecurityWages: 120000 }], dependents: [kid(5, '111223333'), kid(9, '111224444')] }))
  assert.equal(r.f1040['19'], 4400)
})

test('EIC (HOH, one child, $30,000): $4,328 less 15.98% of the row midpoint over $23,350', () => {
  const r = computeReturn(ret('hoh', { w2s: [{ ...emptyW2('taxpayer'), employer: 'A', wages: 30000, medicareWages: 30000, socialSecurityWages: 30000 }], dependents: [kid(6, '111223333')] }))
  assert.equal(r.f1040['27a'], Math.round(4328 - 0.1598 * (30025 - 23350)))
})

test('Senior deduction $6,000 and additional standard deduction $2,000 (single, 70, $60,000 pension)', () => {
  const r0 = ret('single', { retirement: [{ ...empty1099R('taxpayer'), payer: 'Plan', grossDistribution: 60000, taxableAmount: 60000, code: '7' }] })
  const r = computeReturn({ ...r0, taxpayer: { ...r0.taxpayer, age: 70, age65OrOlder: true } })
  assert.equal(r.f1040['12e'], 15750 + 2000)
  assert.equal(r.schedule1A.senior, 6000)
  assert.equal(r.f1040['15'], 60000 - 17750 - 6000)
})
