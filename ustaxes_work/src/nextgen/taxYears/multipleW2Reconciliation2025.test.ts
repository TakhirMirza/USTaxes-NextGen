import { bridgeMultipleW2ToRestricted1040_2025, W2DocumentInput2025 } from './multipleW2Form1040Bridge2025'
import { reconcileMultipleW2_2025 } from './multipleW2Reconciliation2025'

const first: W2DocumentInput2025 = { id: 'A', employer: 'Employer 1', box1Wages: '100.11', box2FederalWithholding: '20.21' }
const second: W2DocumentInput2025 = { id: 'B', employer: 'Employer 1', box1Wages: '200.22', box2FederalWithholding: '0' }

describe('Stage 122 independent W-2 reconciliation', () => {
  test('matches two distinct W-2s in exact cents including explicit zero', () => {
    const docs = [first, second]
    expect(reconcileMultipleW2_2025(docs, bridgeMultipleW2ToRestricted1040_2025(docs, 'single'))).toEqual({ kind: 'matched', wagesCents: 30033, withholdingCents: 2021, documentCount: 2 })
  })
  test('does not match when input changes after draft generation', () => {
    const docs = [first, second]
    const bridge = bridgeMultipleW2ToRestricted1040_2025(docs, 'single')
    expect(reconcileMultipleW2_2025([first, { ...second, box1Wages: '200.23' }], bridge).kind).toBe('mismatch')
    expect(reconcileMultipleW2_2025([first, { ...second, box2FederalWithholding: '1' }], bridge).kind).toBe('mismatch')
  })
  test('blocks duplicate IDs and missing withholding', () => {
    const duplicate = [first, { ...second, id: ' A ' }]
    expect(reconcileMultipleW2_2025(duplicate, bridgeMultipleW2ToRestricted1040_2025(duplicate, 'single')).kind).toBe('blocked')
    const missing = [first, { ...second, box2FederalWithholding: '' }]
    expect(reconcileMultipleW2_2025(missing, bridgeMultipleW2ToRestricted1040_2025(missing, 'single')).kind).toBe('blocked')
  })
  test('rejects mismatched document count and altered mapped lines', () => {
    const docs = [first, second]
    const bridge = bridgeMultipleW2ToRestricted1040_2025(docs, 'single')
    expect(reconcileMultipleW2_2025([first], bridge).kind).toBe('mismatch')
    if (bridge.kind !== 'mapped') return
    const tampered = { ...bridge, draft: { ...bridge.draft, lines: { ...bridge.draft.lines, '25a': 20.22 } } }
    expect(reconcileMultipleW2_2025(docs, tampered).kind).toBe('mismatch')
  })
})
