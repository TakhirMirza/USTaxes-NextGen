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


describe('Stage 106: Form 1040 reconciliation rejects malformed imported money', () => {
  const requiredMoneyFields = [
    'line16Tax', 'line17Schedule2Tax', 'line19ChildOtherDependentCredit',
    'line20Schedule3NonrefundableCredits', 'line23OtherTaxes',
    'line25dWithholding', 'line26EstimatedPayments', 'line27aEarnedIncomeCredit',
    'line28AdditionalChildTaxCredit', 'line29AmericanOpportunityCredit',
    'line30RefundableAdoptionCredit', 'line31Schedule3RefundableCredits',
  ] as const

  for (const field of requiredMoneyFields) {
    it(`fails closed on non-finite, negative and sub-cent ${field}`, () => {
      for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01, 1.001, 1e10 + 1]) {
        expect(() => reconcile2025Form1040Arithmetic({ ...complete, [field]: invalid })).toThrow(RangeError)
      }
    })
  }

  it('rejects invalid withholding components even if aggregate withholding is valid', () => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0.001, 1e10 + 1]) {
      expect(() => reconcile2025Form1040Arithmetic({ ...complete,
        line25aW2Withholding: invalid, line25b1099Withholding: 0, line25cOtherWithholding: 0,
      })).toThrow(RangeError)
    }
  })

  it('rejects malformed explicit refund and carryforward elections', () => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0.001, 1e10 + 1]) {
      expect(() => reconcile2025Form1040Arithmetic({ ...complete,
        line35aRefundRequested: invalid })).toThrow(RangeError)
      expect(() => reconcile2025Form1040Arithmetic({ ...complete,
        line36AppliedTo2026: invalid })).toThrow(RangeError)
    }
  })

  it('never turns absent required money into an inferred zero or a filing-ready result', () => {
    for (const field of requiredMoneyFields) {
      const incomplete: Partial<typeof complete> = { ...complete }
      delete incomplete[field]
      const result = reconcile2025Form1040Arithmetic(incomplete)
      expect(result.completeArithmetic).toBe(false)
      expect(result.filingReady).toBe(false)
      expect(result.missingInputs).toContain(field)
      expect(Object.values(result.lines).every(value => value === null)).toBe(true)
    }
  })
})

describe('Stage 107: imported data and boundary reconciliation safeguards', () => {
  it('rejects nonnumeric values from untrusted JSON rather than coercing them', () => {
    const invalid: unknown[] = ['100', null, true, {}, [], '0.00']
    for (const value of invalid) {
      const imported = { ...complete, line16Tax: value } as unknown as typeof complete
      expect(() => reconcile2025Form1040Arithmetic(imported)).toThrow(RangeError)
    }
  })

  it('requires the total withholding field even when all breakdown entries exist', () => {
    const incomplete: Partial<typeof complete> & {
      line25aW2Withholding: number; line25b1099Withholding: number; line25cOtherWithholding: number
    } = { ...complete, line25aW2Withholding: 5000, line25b1099Withholding: 400, line25cOtherWithholding: 100 }
    delete incomplete.line25dWithholding
    const result = reconcile2025Form1040Arithmetic(incomplete)
    expect(result.completeArithmetic).toBe(false)
    expect(result.missingInputs).toContain('line25dWithholding')
    expect(result.lines['25d']).toBeNull()
    expect(result.filingReady).toBe(false)
  })

  it('handles exact-cent withholding without binary floating-point mismatches', () => {
    const result = reconcile2025Form1040Arithmetic({ ...complete,
      line25aW2Withholding: 5499.97, line25b1099Withholding: 0.01,
      line25cOtherWithholding: 0.02, line25dWithholding: 5500,
    })
    expect(result.completeArithmetic).toBe(true)
    expect(result.lines['25d']).toBe(5500)
    expect(result.filingReady).toBe(false)
  })

  it('never silently infers a refund or carryforward election', () => {
    const result = reconcile2025Form1040Arithmetic({ ...complete })
    expect(result.lines['34']).toBe(800)
    expect(result.lines['35a']).toBeNull()
    expect(result.lines['36']).toBeNull()
    expect(result.filingReady).toBe(false)
  })

  it('rejects allocating more than available even at the cent boundary', () => {
    expect(() => reconcile2025Form1040Arithmetic({ ...complete,
      line35aRefundRequested: 799.99, line36AppliedTo2026: 0.02,
    })).toThrow(RangeError)
  })
})
