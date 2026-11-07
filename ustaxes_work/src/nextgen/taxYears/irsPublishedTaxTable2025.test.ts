import { lookupVerified2025SampleTax, VERIFIED_2025_SAMPLE_ROWS, VERIFIED_2025_FIRST_PANEL_ROWS } from './irsPublishedTaxTable2025'
import { decide2025Line16 } from './irsLine16Decision2025'

const confirmed = { ordinaryIncomeMethodApplicable: true, specialTaxWorksheetRequired: false }

describe('IRS 2025 published sample Tax Table cells', () => {
  test('all four published rows match all four filing columns', () => {
    expect(VERIFIED_2025_SAMPLE_ROWS).toHaveLength(4)
    for (const row of VERIFIED_2025_SAMPLE_ROWS) {
      for (const status of ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold'] as const) {
        expect(lookupVerified2025SampleTax(row.lower, status)).toBe(row[status])
        expect(lookupVerified2025SampleTax(row.upper - 0.01, status)).toBe(row[status])
      }
      expect(lookupVerified2025SampleTax(row.lower, 'qualifyingSurvivingSpouse')).toBe(row.marriedJoint)
    }
  })
  test('2025 IRS first panel includes all 42 published brackets from $0 through $1,000', () => {
    expect(VERIFIED_2025_FIRST_PANEL_ROWS).toHaveLength(42)
    expect(VERIFIED_2025_FIRST_PANEL_ROWS[0]).toMatchObject({ lower: 0, upper: 5, single: 0 })
    expect(VERIFIED_2025_FIRST_PANEL_ROWS[1]).toMatchObject({ lower: 5, upper: 15, single: 1 })
    expect(VERIFIED_2025_FIRST_PANEL_ROWS[2]).toMatchObject({ lower: 15, upper: 25, single: 2 })
    expect(VERIFIED_2025_FIRST_PANEL_ROWS[41]).toMatchObject({ lower: 975, upper: 1000, single: 99 })
    for (const row of VERIFIED_2025_FIRST_PANEL_ROWS) {
      for (const status of ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold', 'qualifyingSurvivingSpouse'] as const) {
        expect(lookupVerified2025SampleTax(row.lower, status)).toBe(row.single)
        expect(lookupVerified2025SampleTax(row.upper - 0.01, status)).toBe(row.single)
      }
    }
    expect(lookupVerified2025SampleTax(1000, 'single')).toBeUndefined()
  })
  test('unverified boundaries fail closed', () => {
    expect(lookupVerified2025SampleTax(25199.99, 'single')).toBeUndefined()
    expect(lookupVerified2025SampleTax(25400, 'single')).toBeUndefined()
    expect(lookupVerified2025SampleTax(NaN, 'single')).toBeUndefined()
  })
  test('line 16 routing uses exact IRS sample cell only when eligibility is confirmed', () => {
    expect(decide2025Line16({ taxableIncome: 25350, status: 'headOfHousehold', ...confirmed }))
      .toMatchObject({ kind: 'verified-reference-example', tax: 2705, filingReady: false })
    expect(decide2025Line16({ taxableIncome: 25350, status: 'headOfHousehold' }).kind).toBe('blocked')
  })
})
