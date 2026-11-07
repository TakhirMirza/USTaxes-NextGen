/** Regression fixtures for the existing 2021 federal ordinary-income engine.
 * These fixtures do not validate other taxes, credits, or the PDF layout. */
import { FilingStatus } from 'ustaxes/core/data'
import { CURRENT_YEAR, default as federal } from '../data/federal'
import { computeOrdinaryTax } from '../irsForms/TaxTable'

describe('2021 federal regression fixtures', () => {
  it('is explicitly scoped to tax year 2021', () => {
    expect(CURRENT_YEAR).toBe(2021)
  })

  it('preserves the single-filer $100,000 W-2 sample', () => {
    const wages = 100000
    const withheld = 15000
    const standardDeduction = federal.ordinary.status[FilingStatus.S].deductions[0].amount
    expect(standardDeduction).toBe(12550)
    const taxableIncome = wages - standardDeduction
    expect(taxableIncome).toBe(87450)
    const tax = Math.round(computeOrdinaryTax(FilingStatus.S, taxableIncome))
    expect(tax).toBe(15015)
    expect(tax - withheld).toBe(15)
  })

  it.each([FilingStatus.S, FilingStatus.MFJ, FilingStatus.MFS, FilingStatus.HOH])(
    'has zero ordinary tax on zero taxable income for %s',
    (status) => expect(computeOrdinaryTax(status, 0)).toBe(0)
  )

  it('preserves published 2021 single-filer taxable-income tax at $100,000', () => {
    expect(Math.round(computeOrdinaryTax(FilingStatus.S, 100000))).toBe(18021)
  })
})
