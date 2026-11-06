import { bridgeMultipleW2ToRestricted1040_2025, W2DocumentInput2025 } from './multipleW2Form1040Bridge2025'

const first: W2DocumentInput2025 = { id: 'w2-1', employer: 'Acme', box1Wages: '40000.11', box2FederalWithholding: '3000.21' }
const second: W2DocumentInput2025 = { id: 'w2-2', employer: 'Acme', box1Wages: '20000.22', box2FederalWithholding: '1000.32' }

describe('Stage 118 multi-document W-2 restricted Form 1040 bridge', () => {
  test('adds two distinct W-2s from the same employer in exact cents', () => {
    const result = bridgeMultipleW2ToRestricted1040_2025([first, second], 'single')
    expect(result.kind).toBe('mapped')
    if (result.kind !== 'mapped') return
    expect(result.documentCount).toBe(2)
    expect(result.draft.lines['1a']).toBe(60000.33)
    expect(result.draft.lines['25a']).toBe(4000.53)
    expect(result.draft.lines['25d']).toBe(4000.53)
    expect(result.draft.filingReady).toBe(false)
    expect(result.draft.line16.kind).toBe('blocked')
  })
  test('blocks duplicate IDs, including whitespace around an ID', () => {
    const result = bridgeMultipleW2ToRestricted1040_2025([first, { ...second, id: ' w2-1 ' }], 'single')
    expect(result.kind).toBe('blocked')
    if (result.kind === 'blocked') expect(result.documentIndex).toBe(1)
  })
  test('requires explicit withholding for each document', () => {
    expect(bridgeMultipleW2ToRestricted1040_2025([first, { ...second, box2FederalWithholding: '' }], 'single').kind).toBe('blocked')
    const zero = bridgeMultipleW2ToRestricted1040_2025([first, { ...second, box2FederalWithholding: '0' }], 'single')
    expect(zero.kind).toBe('mapped')
    if (zero.kind === 'mapped') expect(zero.draft.lines['25a']).toBe(3000.21)
  })
  test.each(['-1', '1.001', 'NaN', '20001'])('rejects invalid Box 2 %s', amount => {
    expect(bridgeMultipleW2ToRestricted1040_2025([first, { ...second, box2FederalWithholding: amount }], 'single').kind).toBe('blocked')
  })
  test('blocks missing documents and duplicate-free over-capacity input', () => {
    expect(bridgeMultipleW2ToRestricted1040_2025([], 'single').kind).toBe('blocked')
    expect(bridgeMultipleW2ToRestricted1040_2025(Array.from({ length: 101 }, (_, i) => ({ ...first, id: String(i) })), 'single').kind).toBe('blocked')
  })
  test('withholding does not change provisional line 16', () => {
    const a = bridgeMultipleW2ToRestricted1040_2025([first, second], 'single', true, true)
    const b = bridgeMultipleW2ToRestricted1040_2025([first, { ...second, box2FederalWithholding: '100' }], 'single', true, true)
    expect(a.kind).toBe('mapped')
    expect(b.kind).toBe('mapped')
    if (a.kind === 'mapped' && b.kind === 'mapped') expect(a.draft.line16).toEqual(b.draft.line16)
  })
})
