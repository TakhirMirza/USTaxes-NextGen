import { findPotentialRepeatedW2_2025, repeatedW2ReviewSignature2025, isRepeatedW2ReviewAcknowledged2025 } from './multipleW2DuplicateReview2025'
import { W2DocumentInput2025 } from './multipleW2Form1040Bridge2025'

const first: W2DocumentInput2025 = { id: 'one', employer: 'Acme', box1Wages: '123.45', box2FederalWithholding: '12.30' }
describe('Stage 123 potential repeated W-2 review', () => {
  test('flags identical employer and cent amounts even with distinct IDs and formatting', () => {
    expect(findPotentialRepeatedW2_2025([first, { ...first, id: 'two', employer: ' acme ', box1Wages: '123.45', box2FederalWithholding: '12.3' }])).toEqual([[0, 1]])
  })
  test('does not flag same employer with different amounts', () => {
    expect(findPotentialRepeatedW2_2025([first, { ...first, id: 'two', box2FederalWithholding: '12.31' }])).toEqual([])
  })
  test('does not infer duplicates from incomplete or invalid entries', () => {
    expect(findPotentialRepeatedW2_2025([{ ...first, box2FederalWithholding: '' }, { ...first, id: 'two', box2FederalWithholding: '' }])).toEqual([])
  })
  test('does not flag identical amounts for different employers', () => {
    expect(findPotentialRepeatedW2_2025([first, { ...first, id: 'two', employer: 'Other' }])).toEqual([])
  })
  test('returns all affected document indexes for three matches', () => {
    expect(findPotentialRepeatedW2_2025([first, { ...first, id: 'two' }, { ...first, id: 'three' }])).toEqual([[0, 1, 2]])
  })
})

describe('Stage 124 explicit repeated W-2 acknowledgement', () => {
  const repeated = [first, { ...first, id: 'two' }]
  test('does not require acknowledgement for unique W-2s', () => {
    expect(repeatedW2ReviewSignature2025([first])).toBeNull()
    expect(isRepeatedW2ReviewAcknowledged2025(null, null)).toBe(true)
  })
  test('blocks an unacknowledged potential repeat', () => {
    const signature = repeatedW2ReviewSignature2025(repeated)
    expect(signature).not.toBeNull()
    expect(isRepeatedW2ReviewAcknowledged2025(signature, null)).toBe(false)
  })
  test('allows only the exact reviewed group', () => {
    const signature = repeatedW2ReviewSignature2025(repeated)
    expect(isRepeatedW2ReviewAcknowledged2025(signature, signature)).toBe(true)
    const changed = repeatedW2ReviewSignature2025([first, { ...first, id: 'three' }])
    expect(isRepeatedW2ReviewAcknowledged2025(changed, signature)).toBe(false)
  })
  test('changing an amount invalidates the acknowledgement even if repeats remain', () => {
    const signature = repeatedW2ReviewSignature2025(repeated)
    const changed = repeatedW2ReviewSignature2025([{ ...first, box1Wages: '200' }, { ...first, id: 'two', box1Wages: '200' }])
    expect(isRepeatedW2ReviewAcknowledged2025(changed, signature)).toBe(false)
  })
})
