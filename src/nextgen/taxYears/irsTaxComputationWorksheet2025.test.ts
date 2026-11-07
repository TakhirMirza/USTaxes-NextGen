import { computeIrsTaxWorksheet2025 as compute } from './irsTaxComputationWorksheet2025'

test('IRS 2025 single section A boundaries', () => {
  expect(compute(100000, 'single', true)).toMatchObject({ status: 'computed', line16TaxDollars: 16914, worksheetSection: 'A' })
  expect(compute(103350, 'single', true)).toMatchObject({ status: 'computed', line16TaxDollars: 17651, ratePercent: 22 })
  expect(compute(103351, 'single', true)).toMatchObject({ status: 'computed', line16TaxDollars: 17651, ratePercent: 24 })
})
test('IRS 2025 married jointly and qualifying survivor share section B', () => {
  expect(compute(100000, 'marriedJoint', true)).toMatchObject({ status: 'computed', line16TaxDollars: 11828, worksheetSection: 'B' })
  expect(compute(100000, 'qualifyingSurvivingSpouse', true)).toMatchObject({ status: 'computed', line16TaxDollars: 11828 })
})
test('IRS 2025 separate section C upper band', () => {
  expect(compute(400000, 'marriedSeparate', true)).toMatchObject({ status: 'computed', line16TaxDollars: 110031, ratePercent: 37 })
})
test('IRS 2025 head of household section D', () => {
  expect(compute(100000, 'headOfHousehold', true)).toMatchObject({ status: 'computed', line16TaxDollars: 15175, worksheetSection: 'D' })
})
test('blocks Tax Table range, unconfirmed special-rate review and invalid inputs', () => {
  expect(compute(99999, 'single', true).status).toBe('blocked')
  expect(compute(100000, 'single', false).status).toBe('blocked')
  expect(compute(100000.01, 'single', true).status).toBe('blocked')
  expect(compute(-1, 'single', true).status).toBe('blocked')
  expect(compute(100000, 'invalid' as any, true).status).toBe('blocked')
})
