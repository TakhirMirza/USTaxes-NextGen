import { reviewIntegrated2025Form1040 } from './form1040IntegratedReview2025'
import { RestrictedDraft2025 } from './form1040Draft2025'
import { RestrictedSchedule1ABridge2025 } from './form1040Schedule1ABridge2025'
import { Form1040Schedule8812Bridge2025 } from './form1040Schedule8812Bridge2025'
const draft: RestrictedDraft2025 = {
  year: 2025, filingReady: false,
  lines: { '1a': 50000, '2b': 0, '8': 0, '9': 50000, '10': 0, '11a': 50000,
    '12e': 15750, '15': 34250, '25a': 3000, '25b': 0, '25d': 3000 },
  line16: { kind: 'blocked', reason: 'not verified', filingReady: false }, excluded: [],
}
const a: RestrictedSchedule1ABridge2025 = {
  year: 2025, filingReady: false, form1040Line13b: null, provisionalSchedule1ATotal: 1000,
  draftLine15Unchanged: 34250, provisionalLine15IfAllowed: 33250, eligibleToPost: false, blockers: [],
}
const credit: Form1040Schedule8812Bridge2025 = {
  year: 2025, filingReady: false, form1040Line19: null, form1040Line28: null,
  nonrefundableCandidate: 500, refundableCandidate: 200, combinedCandidate: 700,
  childTaxCreditBeforePhaseout: 2200, otherDependentCreditBeforePhaseout: 0,
  phaseoutReduction: 0, availableTaxBeforeCredits: 999, unresolved: [], readyForPosting: false,
}
const base = { draft, filingStatus: 'single' as const, schedule1A: a, schedule8812: credit,
  ordinaryIncomeMethodConfirmed: true, specialTaxWorksheetNotRequiredConfirmed: true }
test('cross-checks provisional line 16 and refuses mismatched credit tax baseline', () => {
  const result = reviewIntegrated2025Form1040(base)
  expect(result.provisionalTaxableIncome).toBe(33250)
  expect(result.provisionalLine16?.kind).not.toBe('blocked')
  expect(result.candidateNonrefundableCredit).toBeNull()
  expect(result.blockers.join(' ')).toContain('baseline differs')
  expect(Object.values(result.officialLines).every(v => v === null)).toBe(true)
})
test('missing evidence is blocked, never treated as zero deduction', () => {
  const result = reviewIntegrated2025Form1040({ ...base, schedule1A: null, schedule8812: null })
  expect(result.provisionalTaxableIncome).toBeNull()
  expect(result.blockers.join(' ')).toContain('missing')
})
test('rejects inconsistent Schedule 1-A arithmetic', () => {
  const result = reviewIntegrated2025Form1040({ ...base, schedule1A: { ...a, provisionalLine15IfAllowed: 33300 } })
  expect(result.provisionalLine16).toBeNull()
  expect(result.blockers.join(' ')).toContain('do not reconcile')
})
test('rejects unsafe filing status from an upstream bridge', () => {
  expect(() => reviewIntegrated2025Form1040({ ...base, schedule8812: { ...credit, readyForPosting: true } as Form1040Schedule8812Bridge2025 })).toThrow()
})

// Invalid imported money must fail closed rather than reach a provisional calculation.
test('rejects non-finite and negative Form 1040 money inputs', () => {
  expect(() => reviewIntegrated2025Form1040({
    ...base, draft: { ...draft, lines: { ...draft.lines, '15': Number.NaN } },
  })).toThrow(RangeError)
  expect(() => reviewIntegrated2025Form1040({
    ...base, draft: { ...draft, lines: { ...draft.lines, '25d': -1 } },
  })).toThrow(RangeError)
})

test('rejects unsafe bridge credit candidates without authorizing filing', () => {
  expect(() => reviewIntegrated2025Form1040({
    ...base, schedule8812: { ...credit, nonrefundableCandidate: Number.POSITIVE_INFINITY },
  })).toThrow(RangeError)
  expect(() => reviewIntegrated2025Form1040({
    ...base, schedule8812: { ...credit, refundableCandidate: -5 },
  })).toThrow(RangeError)
})
