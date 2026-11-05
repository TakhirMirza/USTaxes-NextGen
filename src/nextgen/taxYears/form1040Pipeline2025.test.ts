import { build2025Form1040Review } from './form1040Pipeline2025'

const base = { filingStatus: 'single' as const,
  w2: [{ id: 'w1', employer: 'Employer', box1Wages: 50000, box2FederalWithholding: 6000 }],
  interest1099: [{ id: 'i1', payer: 'Bank', box1TaxableInterest: 100, federalWithholding: 20 }],
}

test('missing source categories are explicit blockers, not zero', () => {
  const result = build2025Form1040Review(base)
  expect(result.filingReady).toBe(false)
  expect(result.withholding).toBeNull()
  expect(result.reconciliation).toBeNull()
  expect(result.blockers.some(x => x.includes('explicitly confirmed'))).toBe(true)
})

test('confirmed document withholding flows into reconciliation without inventing tax', () => {
  const result = build2025Form1040Review({ ...base, schedule1: [],
    other1099Withholding: 5, otherWithholding: 0, reconciliation: {} })
  expect(result.withholding!.line25aW2Withholding).toBe(6000)
  expect(result.withholding!.line25b1099Withholding).toBe(25)
  expect(result.withholding!.line25dWithholding).toBe(6025)
  expect(result.reconciliation!.completeArithmetic).toBe(false)
  expect(result.reconciliation!.missingInputs).toContain('line16Tax')
})

test('conflicting externally supplied withholding is rejected', () => {
  expect(() => build2025Form1040Review({ ...base, other1099Withholding: 0,
    otherWithholding: 0, reconciliation: { line25dWithholding: 1 } })).toThrow(/conflicts/)
})

test('a draft line 16 sample cannot silently become an authoritative reconciliation input', () => {
  const result = build2025Form1040Review({ ...base, ordinaryMethodConfirmed: true,
    specialMethodNotRequiredConfirmed: true, other1099Withholding: 0,
    otherWithholding: 0, reconciliation: {} })
  expect(result.reconciliation!.missingInputs).toContain('line16Tax')
  expect(result.filingReady).toBe(false)
})


test('Schedule 1-A must be reviewed explicitly', () => {
  const pending = build2025Form1040Review({ ...base, schedule1: [] })
  expect(pending.schedule1A).toBeNull()
  expect(pending.blockers).toContain('Schedule 1-A has not been explicitly reviewed.')
  const reviewed = build2025Form1040Review({ ...base, schedule1: [], schedule1A: [] })
  expect(reviewed.schedule1A!.form1040Line13b).toBeNull()
  expect(reviewed.blockers).not.toContain('Schedule 1-A has not been explicitly reviewed.')
  expect(reviewed.filingReady).toBe(false)
})

test('Schedule 1-A candidate dollars never silently reduce taxable income', () => {
  const baseline = build2025Form1040Review({ ...base, schedule1: [], schedule1A: [] })
  const candidate = build2025Form1040Review({ ...base, schedule1: [],
    schedule1A: [{ category: 'qualifiedTips', amount: 1200 }] })
  expect(candidate.schedule1A!.unverifiedCandidateTotal).toBe(1200)
  expect(candidate.schedule1A!.form1040Line13b).toBeNull()
  expect(candidate.draft).toEqual(baseline.draft)
  expect(candidate.blockers.some(x => x.includes('line 13b remains unavailable'))).toBe(true)
})

test('invalid Schedule 1-A candidate input is rejected at the pipeline boundary', () => {
  expect(() => build2025Form1040Review({ ...base, schedule1A: [
    { category: 'qualifiedOvertimePremium', amount: -10 }
  ] })).toThrow(/nonnegative/)
})


test('a missing deduction review prevents even a sample tax-table result being presented', () => {
  const result = build2025Form1040Review({ ...base, schedule1: [], schedule1A: [],
    ordinaryMethodConfirmed: true, specialMethodNotRequiredConfirmed: true })
  expect(result.draft.line16.kind).toBe('blocked')
  if (result.draft.line16.kind === 'blocked') {
    expect(result.draft.line16.reason).toMatch(/standard deduction eligibility/)
  }
})

test('unverified Schedule 1-A deduction cannot produce a usable line 16', () => {
  const result = build2025Form1040Review({ ...base, schedule1: [],
    schedule1A: [{ category: 'qualifiedTips', amount: 200 }],
    ordinaryMethodConfirmed: true, specialMethodNotRequiredConfirmed: true })
  expect(result.draft.line16.kind).toBe('blocked')
  if (result.draft.line16.kind === 'blocked') {
    expect(result.draft.line16.reason).toMatch(/line 13b/)
  }
})

const confirmedDeductionFacts = {
  canBeClaimedAsDependent: false, taxpayerAge65OrOlder: true,
  spouseAge65OrOlder: false, taxpayerBlind: false, spouseBlind: false,
  spouseItemizes: false, nonresidentAlienDuringYear: false, itemizing: false,
}

test('confirmed age-related deduction flows into draft taxable income, without declaring filing readiness', () => {
  const result = build2025Form1040Review({ ...base, standardDeductionFacts: confirmedDeductionFacts })
  expect(result.standardDeductionAmount.amount).toBe(17750)
  expect(result.draft.lines['12e']).toBe(17750)
  expect(result.draft.lines['15']).toBe(32350)
  expect(result.filingReady).toBe(false)
  expect(result.draft.line16.kind).toBe('blocked')
})

test('unresolved dependent deduction does not override illustrative basic amount', () => {
  const result = build2025Form1040Review({ ...base,
    standardDeductionFacts: { ...confirmedDeductionFacts, canBeClaimedAsDependent: true },
  })
  expect(result.standardDeductionAmount.amount).toBeNull()
  expect(result.draft.lines['12e']).toBe(15750)
  expect(result.draft.line16.kind).toBe('blocked')
})
