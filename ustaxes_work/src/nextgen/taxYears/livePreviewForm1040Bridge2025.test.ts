import { bridgeLiveW2ToRestricted1040_2025 } from './livePreviewForm1040Bridge2025'
import { LivePreviewScenario2025 } from './livePreviewScenario2025'

const scenario: LivePreviewScenario2025 = {
  wages: '60000.25', federalWithholding: '5100.50', status: 'single',
  ordinaryConfirmed: false, specialRuledOut: false,
}

describe('Stage 117 read-only W-2 to restricted Form 1040 bridge', () => {
  test('maps verified cents to lines 1a, 25a and 25d without filing authorization', () => {
    const result = bridgeLiveW2ToRestricted1040_2025(scenario)
    expect(result.kind).toBe('mapped')
    if (result.kind !== 'mapped') return
    expect(result.draft.lines['1a']).toBe(60000.25)
    expect(result.draft.lines['25a']).toBe(5100.50)
    expect(result.draft.lines['25d']).toBe(5100.50)
    expect(result.draft.filingReady).toBe(false)
    expect(result.draft.line16.kind).toBe('blocked')
  })
  test('requires explicit Box 2, never assumes missing withholding is zero', () => {
    expect(bridgeLiveW2ToRestricted1040_2025({ ...scenario, federalWithholding: '' }).kind).toBe('blocked')
    const zero = bridgeLiveW2ToRestricted1040_2025({ ...scenario, federalWithholding: '0' })
    expect(zero.kind).toBe('mapped')
    if (zero.kind === 'mapped') expect(zero.draft.lines['25a']).toBe(0)
  })
  test.each(['-1', '1.001', 'NaN', '60001'])('rejects invalid Box 2 %s', amount => {
    expect(bridgeLiveW2ToRestricted1040_2025({ ...scenario, federalWithholding: amount }).kind).toBe('blocked')
  })
  test('withholding alone never changes provisional line 16 method or tax', () => {
    const first = bridgeLiveW2ToRestricted1040_2025({ ...scenario, ordinaryConfirmed: true, specialRuledOut: true })
    const second = bridgeLiveW2ToRestricted1040_2025({ ...scenario, federalWithholding: '200', ordinaryConfirmed: true, specialRuledOut: true })
    expect(first.kind).toBe('mapped')
    expect(second.kind).toBe('mapped')
    if (first.kind === 'mapped' && second.kind === 'mapped') {
      expect(first.draft.line16).toEqual(second.draft.line16)
      expect(first.draft.lines['25a']).not.toBe(second.draft.lines['25a'])
    }
  })
})
