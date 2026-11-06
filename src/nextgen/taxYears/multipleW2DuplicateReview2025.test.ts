import { findPotentialRepeatedW2_2025 } from './multipleW2DuplicateReview2025'
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
