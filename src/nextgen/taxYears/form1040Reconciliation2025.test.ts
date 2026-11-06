import { reconcile2025Form1040Arithmetic } from './form1040Reconciliation2025'

const complete = {
  line16Tax: 5000, line17Schedule2Tax: 100, line19ChildOtherDependentCredit: 500,
  line20Schedule3NonrefundableCredits: 100, line23OtherTaxes: 200,
  line25dWithholding: 5500, line26EstimatedPayments: 0,
  line27aEarnedIncomeCredit: 0, line28AdditionalChildTaxCredit: 0,
  line29AmericanOpportunityCredit: 0, line30RefundableAdoptionCredit: 0,
  line31Schedule3RefundableCredits: 0,
}

describe('2025 Form 1040 restricted arithmetic reconciliation', () => {
  it('does not silently assume missing credit or tax amounts are zero', () => {
    const result = reconcile2025Form1040Arithmetic({ line16Tax: 5000 })
    expect(result.completeArithmetic).toBe(false)
    expect(result.lines['34']).toBeNull()
    expect(result.lines['37']).toBeNull()
    expect(result.missingInputs).toContain('line23OtherTaxes')
  })
  it('reconciles refund with all inputs explicit', () => {
    const result = reconcile2025Form1040Arithmetic(complete)
    expect(result.lines['18']).toBe(5100)
    expect(result.lines['21']).toBe(600)
    expect(result.lines['22']).toBe(4500)
    expect(result.lines['24']).toBe(4700)
    expect(result.lines['33']).toBe(5500)
    expect(result.lines['34']).toBe(800)
    expect(result.lines['35a']).toBeNull()
    expect(result.lines['36']).toBeNull()
    expect(result.lines['37']).toBe(0)
    expect(result.filingReady).toBe(false)
  })
  it('reconciles balance owed and caps nonrefundable credits at zero tax', () => {
    const result = reconcile2025Form1040Arithmetic({ ...complete,
      line19ChildOtherDependentCredit: 10000, line25dWithholding: 0 })
    expect(result.lines['22']).toBe(0)
    expect(result.lines['24']).toBe(200)
    expect(result.lines['37']).toBe(200)
    expect(result.lines['34']).toBe(0)
  })
  it('rejects negative and fractional-cent inputs', () => {
    expect(() => reconcile2025Form1040Arithmetic({ ...complete, line16Tax: -1 })).toThrow(RangeError)
    expect(() => reconcile2025Form1040Arithmetic({ ...complete, line16Tax: 1.001 })).toThrow(RangeError)
  })
})

describe('2025 refund and carryforward elections', () => {
  it('allocates an overpayment only when taxpayer election is explicit', () => {
    const result = reconcile2025Form1040Arithmetic({ ...complete,
      line35aRefundRequested: 500, line36AppliedTo2026: 300 })
    expect(result.lines['34']).toBe(800)
    expect(result.lines['35a']).toBe(500)
    expect(result.lines['36']).toBe(300)
    expect(result.filingReady).toBe(false)
  })
  it('allows full refund election with no carryforward', () => {
    const result = reconcile2025Form1040Arithmetic({ ...complete,
      line35aRefundRequested: 800, line36AppliedTo2026: 0 })
    expect(result.lines['35a']).toBe(800)
    expect(result.lines['36']).toBe(0)
  })
  it('rejects elections exceeding overpayment or not summing to it', () => {
    expect(() => reconcile2025Form1040Arithmetic({ ...complete,
      line35aRefundRequested: 801 })).toThrow(RangeError)
    expect(() => reconcile2025Form1040Arithmetic({ ...complete,
      line35aRefundRequested: 700, line36AppliedTo2026: 50 })).toThrow(RangeError)
    expect(() => reconcile2025Form1040Arithmetic({ ...complete,
      line36AppliedTo2026: -1 })).toThrow(RangeError)
  })
  it('does not permit refund election when balance is owed', () => {
    expect(() => reconcile2025Form1040Arithmetic({ ...complete,
      line25dWithholding: 0, line35aRefundRequested: 1 })).toThrow(RangeError)
  })
})


describe('2025 IRS line 30 and withholding breakdown', () => {
  it('requires the new refundable adoption credit input rather than assuming zero', () => {
    const without30: Partial<typeof complete> = { ...complete }
    delete without30.line30RefundableAdoptionCredit
    const result = reconcile2025Form1040Arithmetic(without30)
    expect(result.completeArithmetic).toBe(false)
    expect(result.missingInputs).toContain('line30RefundableAdoptionCredit')
  })
  it('includes refundable adoption credit in lines 30, 32, 33 and 34', () => {
    const result = reconcile2025Form1040Arithmetic({ ...complete, line30RefundableAdoptionCredit: 500 })
    expect(result.lines['30']).toBe(500)
    expect(result.lines['32']).toBe(500)
    expect(result.lines['33']).toBe(6000)
    expect(result.lines['34']).toBe(1300)
  })
  it('reconciles W-2, 1099 and other withholding against line 25d', () => {
    const result = reconcile2025Form1040Arithmetic({ ...complete,
      line25aW2Withholding: 5000, line25b1099Withholding: 400, line25cOtherWithholding: 100 })
    expect(result.lines['25d']).toBe(5500)
    expect(() => reconcile2025Form1040Arithmetic({ ...complete,
      line25aW2Withholding: 5000, line25b1099Withholding: 300, line25cOtherWithholding: 100 })).toThrow(RangeError)
  })
  it('rejects incomplete or invalid withholding breakdown', () => {
    expect(() => reconcile2025Form1040Arithmetic({ ...complete,
      line25aW2Withholding: 5000 })).toThrow(RangeError)
    expect(() => reconcile2025Form1040Arithmetic({ ...complete,
      line25aW2Withholding: -1, line25b1099Withholding: 0, line25cOtherWithholding: 0 })).toThrow(RangeError)
  })
})
