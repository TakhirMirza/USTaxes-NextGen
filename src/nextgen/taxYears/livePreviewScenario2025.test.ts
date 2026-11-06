import { calculateLivePreviewScenario2025, LivePreviewScenario2025, updateLivePreviewScenario2025 } from './livePreviewScenario2025'

const base: LivePreviewScenario2025 = { wages: '50000', status: 'single', ordinaryConfirmed: true, specialRuledOut: true }

test('wage changes invalidate both confirmations and block line 16', () => {
  const updated = updateLivePreviewScenario2025(base, { kind: 'wages', value: '51000' })
  expect(updated.ordinaryConfirmed).toBe(false)
  expect(updated.specialRuledOut).toBe(false)
  expect(calculateLivePreviewScenario2025(updated).line16?.kind).toBe('blocked')
})

test('filing status changes invalidate both confirmations and change deduction', () => {
  const before = calculateLivePreviewScenario2025(base)
  const updated = updateLivePreviewScenario2025(base, { kind: 'status', value: 'marriedJoint' })
  const after = calculateLivePreviewScenario2025(updated)
  expect(updated.ordinaryConfirmed).toBe(false)
  expect(updated.specialRuledOut).toBe(false)
  expect(after.result?.standardDeduction).not.toBe(before.result?.standardDeduction)
  expect(after.line16?.kind).toBe('blocked')
})

test('unchanged input does not erase confirmations', () => {
  expect(updateLivePreviewScenario2025(base, { kind: 'wages', value: base.wages })).toBe(base)
  expect(updateLivePreviewScenario2025(base, { kind: 'status', value: base.status })).toBe(base)
})

test.each(['', '-10', '1e5', '1.234', 'NaN'])('invalid wages %s never produce a tax candidate', wages => {
  const scenario = calculateLivePreviewScenario2025({ ...base, wages })
  expect(scenario.valid).toBe(false)
  expect(scenario.result).toBeNull()
  expect(scenario.line16).toBeNull()
})

test('reconfirmation is explicit after an input change', () => {
  const changed = updateLivePreviewScenario2025(base, { kind: 'wages', value: '50001' })
  const once = updateLivePreviewScenario2025(changed, { kind: 'ordinaryConfirmed', value: true })
  expect(calculateLivePreviewScenario2025(once).line16?.kind).toBe('blocked')
  const twice = updateLivePreviewScenario2025(once, { kind: 'specialRuledOut', value: true })
  expect(calculateLivePreviewScenario2025(twice).line16).not.toBeNull()
})

test('unsupported status is rejected at scenario boundary', () => {
  expect(() => updateLivePreviewScenario2025(base, { kind: 'status', value: 'unsupported' as LivePreviewScenario2025['status'] })).toThrow(RangeError)
})


test('optional W-2 Box 2 withholding is context only and does not change line 16', () => {
  const before = calculateLivePreviewScenario2025(base)
  const updated = updateLivePreviewScenario2025(base, { kind: 'federalWithholding', value: '1200.50' })
  expect(updated.ordinaryConfirmed).toBe(true)
  expect(updated.specialRuledOut).toBe(true)
  expect(calculateLivePreviewScenario2025(updated).line16).toEqual(before.line16)
})

test.each(['-1', '1e3', '12.345', '50000.01'])('unsafe withholding %s blocks calculations', value => {
  const updated = updateLivePreviewScenario2025(base, { kind: 'federalWithholding', value })
  const calculated = calculateLivePreviewScenario2025(updated)
  expect(calculated.valid).toBe(false)
  expect(calculated.line16).toBeNull()
})

test('empty withholding remains optional', () => {
  expect(calculateLivePreviewScenario2025({ ...base, federalWithholding: '' }).valid).toBe(true)
})
