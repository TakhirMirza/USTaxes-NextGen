import { bridgeMultipleW2ToRestricted1040_2025 } from './multipleW2Form1040Bridge2025'
import { summarizeW2ByEmployer2025, checkW2EmployerTotals2025, checkW2EmployerMapping2025, findW2EmployerLabelVariations2025 } from './w2EmployerSummary2025'

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


describe('Stage 135 employer inventory to Form 1040 mapping check', () => {
  const documents = [entry('a', 'Example', '100.01', '10.02'), entry('b', 'Example', '200.02', '20.03')]
  it('matches independent employer totals to mapped Form 1040 lines', () => {
    const bridge = bridgeMultipleW2ToRestricted1040_2025(documents, 'single')
    expect(checkW2EmployerMapping2025(documents, bridge)).toEqual({ kind: 'matched', documentCount: 2, box1Wages: 300.03, box2FederalWithholding: 30.05 })
  })
  it('rejects blocked drafts', () => {
    expect(checkW2EmployerMapping2025(documents, { kind: 'blocked', reason: 'test' }).kind).toBe('blocked')
  })
  it('rejects a stale draft when source amounts change', () => {
    const bridge = bridgeMultipleW2ToRestricted1040_2025(documents, 'single')
    const changed = [documents[0], entry('b', 'Example', '200.03', '20.03')]
    expect(checkW2EmployerMapping2025(changed, bridge).kind).toBe('blocked')
  })
  it('rejects mismatched document counts even if totals match', () => {
    const bridge = bridgeMultipleW2ToRestricted1040_2025(documents, 'single')
    const split = [entry('a', 'Example', '100.01', '10.02'), entry('b', 'Example', '100.01', '10.01'), entry('c', 'Example', '100.01', '10.02')]
    expect(checkW2EmployerMapping2025(split, bridge).kind).toBe('blocked')
  })
})


describe('Stage 136 employer inventory input boundary safeguards', () => {
  it('withholds the entire summary when source document IDs repeat', () => {
    expect(summarizeW2ByEmployer2025([entry('same', 'A', '100', '10'), entry('same', 'B', '200', '20')])).toBeNull()
  })
  it('treats whitespace-equivalent document IDs as repeated', () => {
    expect(summarizeW2ByEmployer2025([entry(' id ', 'A', '100', '10'), entry('id', 'B', '200', '20')])).toBeNull()
  })
  it('withholds summaries and blocks checks beyond the 100-document limit', () => {
    const documents = Array.from({ length: 101 }, (_, index) => entry(`w2-${index}`, 'A', '1', '0'))
    expect(summarizeW2ByEmployer2025(documents)).toBeNull()
    expect(checkW2EmployerTotals2025(documents)).toEqual({ kind: 'blocked', reason: 'W-2 document limit exceeded (100).' })
  })
  it('accepts 100 distinct valid documents without silently dropping any', () => {
    const documents = Array.from({ length: 100 }, (_, index) => entry(`w2-${index}`, 'A', '1.01', '0.01'))
    expect(summarizeW2ByEmployer2025(documents)?.[0].documentPositions).toHaveLength(100)
    expect(checkW2EmployerTotals2025(documents)).toEqual({ kind: 'matched', documentCount: 100, box1Wages: 101, box2FederalWithholding: 1 })
  })
})


describe('Stage 137 employer label whitespace advisory', () => {
  it('flags different internal whitespace without changing source labels', () => {
    const documents = [entry('a', 'Example  Inc', '100', '10'), entry('b', 'example inc', '200', '20')]
    expect(findW2EmployerLabelVariations2025(documents)).toEqual([{ documentPositions: [1, 2], labels: ['Example  Inc', 'example inc'] }])
    expect(summarizeW2ByEmployer2025(documents)?.length).toBe(2)
  })
  it('does not flag differences in case or surrounding whitespace alone', () => {
    expect(findW2EmployerLabelVariations2025([entry('a', ' Example Inc ', '1', '0'), entry('b', 'example inc', '2', '0')])).toEqual([])
  })
  it('does not infer identity for substantively different names', () => {
    expect(findW2EmployerLabelVariations2025([entry('a', 'Example Inc', '1', '0'), entry('b', 'Example LLC', '2', '0')])).toEqual([])
  })
  it('does not alter independent reconciliation or allow over-limit inventories', () => {
    const documents = [entry('a', 'Example  Inc', '100', '10'), entry('b', 'Example Inc', '200', '20')]
    expect(checkW2EmployerTotals2025(documents).kind).toBe('matched')
    expect(findW2EmployerLabelVariations2025(Array.from({ length: 101 }, (_, i) => entry(String(i), 'A  B', '1', '0')))).toEqual([])
  })
})
