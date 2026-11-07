import { summarizeW2ByEmployer2025, checkW2EmployerTotals2025 } from './w2EmployerSummary2025'

const entry = (id: string, employer: string, wages: string, withholding: string) => ({ id, employer, box1Wages: wages, box2FederalWithholding: withholding })

describe('Stage 133 employer source inventory (informational)', () => {
  it('groups case-insensitive employer labels without dropping any W-2', () => {
    expect(summarizeW2ByEmployer2025([
      entry('a', ' Example Inc ', '100.01', '10.02'),
      entry('b', 'example inc', '200.02', '20.03'),
      entry('c', 'Other', '50', '0'),
    ])).toEqual([
      { employerLabel: 'Example Inc', documentPositions: [1, 2], box1Wages: 300.03, box2FederalWithholding: 30.05 },
      { employerLabel: 'Other', documentPositions: [3], box1Wages: 50, box2FederalWithholding: 0 },
    ])
  })
  it('does not silently deduplicate identical forms', () => {
    const summary = summarizeW2ByEmployer2025([entry('a', 'A', '100', '5'), entry('b', 'A', '100', '5')])
    expect(summary).toEqual([{ employerLabel: 'A', documentPositions: [1, 2], box1Wages: 200, box2FederalWithholding: 10 }])
  })
  it('refuses partial totals for invalid amounts and missing employer labels', () => {
    expect(summarizeW2ByEmployer2025([entry('a', 'A', '100', '5'), entry('b', 'B', '', '2')])).toBeNull()
    expect(summarizeW2ByEmployer2025([entry('a', ' ', '100', '5')])).toBeNull()
    expect(summarizeW2ByEmployer2025([entry('', 'A', '100', '5')])).toBeNull()
  })
  it('returns an empty inventory for no entries', () => {
    expect(summarizeW2ByEmployer2025([])).toEqual([])
  })
})


describe('Stage 134 independent employer inventory totals check', () => {
  it('matches cents across multiple employers and repeated employer labels', () => {
    expect(checkW2EmployerTotals2025([
      entry('a', 'A', '100.01', '10.02'),
      entry('b', ' a ', '200.02', '20.03'),
      entry('c', 'B', '50.03', '0'),
    ])).toEqual({ kind: 'matched', documentCount: 3, box1Wages: 350.06, box2FederalWithholding: 30.05 })
  })
  it('does not silently drop identical W-2 entries with distinct IDs', () => {
    expect(checkW2EmployerTotals2025([entry('a', 'A', '100', '5'), entry('b', 'A', '100', '5')])).toEqual({ kind: 'matched', documentCount: 2, box1Wages: 200, box2FederalWithholding: 10 })
  })
  it('fails closed on duplicate IDs, invalid inputs and missing labels', () => {
    expect(checkW2EmployerTotals2025([entry('a', 'A', '100', '5'), entry('a', 'B', '50', '2')]).kind).toBe('blocked')
    expect(checkW2EmployerTotals2025([entry('a', '', '100', '5')]).kind).toBe('blocked')
    expect(checkW2EmployerTotals2025([entry('a', 'A', '100', '')]).kind).toBe('blocked')
  })
  it('does not treat an empty document list as a verified reconciliation', () => {
    expect(checkW2EmployerTotals2025([]).kind).toBe('blocked')
  })
})
