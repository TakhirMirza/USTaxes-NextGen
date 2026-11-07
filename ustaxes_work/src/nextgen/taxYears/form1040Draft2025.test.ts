import { makeRestricted2025Draft } from './form1040Draft2025'

const w2 = [{ id: 'w1', employer: 'Fictional', box1Wages: 150000, box2FederalWithholding: 21000 }]
const interest = [{ id: 'i1', payer: 'Fictional', box1TaxableInterest: 200, federalWithholding: 20 }]

describe('2025 restricted Form 1040 draft', () => {
  test('maps only supported income and withholding fields', () => {
    const d = makeRestricted2025Draft(w2, interest, 'single')
    expect(d.lines['1a']).toBe(150000)
    expect(d.lines['2b']).toBe(200)
    expect(d.lines['25a']).toBe(21000)
    expect(d.lines['25b']).toBe(20)
    expect(d.lines['25d']).toBe(21020)
    expect(d.filingReady).toBe(false)
    expect(d.line16.kind).toBe('blocked')
  })
  test('only explicitly confirmed ordinary method can yield high-income worksheet', () => {
    const d = makeRestricted2025Draft(w2, interest, 'single', true, true)
    expect(d.line16.kind).toBe('ordinary-worksheet')
    expect(d.filingReady).toBe(false)
  })
  test('IRS verified published table example is not generalized to adjacent rows', () => {
    const w = [{ id: 'w', employer: 'Fictional', box1Wages: 56800, box2FederalWithholding: 0 }]
    const d = makeRestricted2025Draft(w, [], 'marriedJoint', true, true)
    expect(d.lines['15']).toBe(25300)
    expect(d.line16.kind).toBe('verified-reference-example')
    if (d.line16.kind !== 'blocked') expect(d.line16.tax).toBe(2562)
    const other = makeRestricted2025Draft([{ ...w[0], box1Wages: 56900 }], [], 'marriedJoint', true, true)
    expect(other.line16.kind).toBe('unverified-import-candidate')
  })
  test('rejects negative or invalid inputs', () => {
    expect(() => makeRestricted2025Draft([{ ...w2[0], box1Wages: -1 }], interest, 'single')).toThrow(RangeError)
  })
})

test('rejects invalid externally confirmed standard deduction', () => {
  expect(() => makeRestricted2025Draft([], [], 'single', false, false, [], -1)).toThrow(/nonnegative/)
  expect(() => makeRestricted2025Draft([], [], 'single', false, false, [], 0.001)).toThrow(/whole cents/)
})
