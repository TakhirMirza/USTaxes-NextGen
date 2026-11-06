import { build2025Form1040Review } from './form1040Pipeline2025'
import { get2025ReviewChecklist } from './form1040ReviewChecklist2025'
const base = { filingStatus: 'single' as const, w2: [], interest1099: [] }
test('missing facts remain visibly blocked', () => {
  const checks = get2025ReviewChecklist(build2025Form1040Review(base))
  expect(checks.find(x => x.id === 'schedule1')!.status).toBe('blocked')
  expect(checks.find(x => x.id === 'withholding')!.status).toBe('blocked')
  expect(checks.find(x => x.id === 'filing')!.status).toBe('blocked')
})
test('explicit empty Schedule 1-A is reviewed, not a deduction', () => {
  const checks = get2025ReviewChecklist(build2025Form1040Review({ ...base, schedule1: [], schedule1A: [] }))
  expect(checks.find(x => x.id === 'schedule1a')!.status).toBe('reviewed')
  expect(checks.find(x => x.id === 'filing')!.status).toBe('blocked')
})
test('positive candidate deductions remain blocked', () => {
  const checks = get2025ReviewChecklist(build2025Form1040Review({ ...base, schedule1A: [{ category: 'qualifiedTips', amount: 500 }] }))
  expect(checks.find(x => x.id === 'schedule1a')!.status).toBe('blocked')
})

test('reference tax-table sample does not count as a completed line 16 review', () => {
  const checks = get2025ReviewChecklist(build2025Form1040Review({
    ...base, ordinaryMethodConfirmed: true, specialMethodNotRequiredConfirmed: true,
    w2: [{ id: 'w2-example', employer: 'Fictional employer', box1Wages: 41000, box2FederalWithholding: 100 }],
  }))
  // The exact income can vary with deductions; regardless, a sample cell must never
  // certify filing readiness.
  expect(checks.find(x => x.id === 'filing')!.status).toBe('blocked')
})


test('absent reconciliation never marks arithmetic or elections reviewed', () => {
  const result = build2025Form1040Review(base)
  const withoutReconciliation = { ...result, reconciliation: null }
  const checks = get2025ReviewChecklist(withoutReconciliation)
  expect(checks.find(x => x.id === 'arithmetic')?.status).toBe('blocked')
  expect(checks.find(x => x.id === 'elections')?.status).toBe('blocked')
  expect(checks.find(x => x.id === 'filing')?.status).toBe('blocked')
})
