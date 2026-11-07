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

describe('Stage 125 acknowledgement invalidation boundaries', () => {
  const repeated = [first, { ...first, id: 'two' }, { ...first, id: 'unflagged', employer: 'Other', box1Wages: '500.00' }]
  const accepted = repeatedW2ReviewSignature2025(repeated, 'single')
  test('unflagged W-2 amount changes invalidate an earlier acknowledgement', () => {
    const updated = repeatedW2ReviewSignature2025([first, repeated[1], { ...repeated[2], box1Wages: '600.00' }], 'single')
    expect(isRepeatedW2ReviewAcknowledged2025(updated, accepted)).toBe(false)
  })
  test('filing status changes invalidate an earlier acknowledgement', () => {
    expect(isRepeatedW2ReviewAcknowledged2025(repeatedW2ReviewSignature2025(repeated, 'marriedFilingJointly'), accepted)).toBe(false)
  })
  test('reordering documents invalidates an earlier acknowledgement', () => {
    expect(isRepeatedW2ReviewAcknowledged2025(repeatedW2ReviewSignature2025([repeated[1], first, repeated[2]], 'single'), accepted)).toBe(false)
  })
  test('exact same documents and filing status retain acknowledgement', () => {
    expect(isRepeatedW2ReviewAcknowledged2025(repeatedW2ReviewSignature2025(repeated, 'single'), accepted)).toBe(true)
  })
  test('an unflagged employer edit invalidates an earlier acknowledgement', () => {
    const updated = repeatedW2ReviewSignature2025([first, repeated[1], { ...repeated[2], employer: 'Another' }], 'single')
    expect(isRepeatedW2ReviewAcknowledged2025(updated, accepted)).toBe(false)
  })
})


describe('Stage 127 W-2 review acknowledgement regression matrix', () => {
  const base: W2DocumentInput2025[] = [
    first,
    { ...first, id: 'two' },
    { id: 'third', employer: 'Other', box1Wages: '500.00', box2FederalWithholding: '50.00' },
  ]
  const accepted = repeatedW2ReviewSignature2025(base, 'single')

  test.each([
    ['duplicate employer spelling', 1, 'employer', 'ACME'],
    ['duplicate document ID', 1, 'id', 'second'],
    ['duplicate wages formatting', 1, 'box1Wages', '123.450'],
    ['duplicate withholding formatting', 1, 'box2FederalWithholding', '12.3'],
    ['unflagged document ID', 2, 'id', 'replacement'],
    ['unflagged withholding', 2, 'box2FederalWithholding', '55.00'],
    ['unflagged wages', 2, 'box1Wages', '501.00'],
    ['unflagged employer', 2, 'employer', 'Other Company'],
  ] as Array<[string, number, keyof W2DocumentInput2025, string]>)('%s invalidates confirmation', (_description, index, field, value) => {
    const changed = base.map((document, i) => i === index ? { ...document, [field]: value } : document)
    const current = repeatedW2ReviewSignature2025(changed, 'single')
    expect(current).not.toBeNull()
    expect(isRepeatedW2ReviewAcknowledged2025(current, accepted)).toBe(false)
  })

  test('adding a unique document invalidates confirmation', () => {
    const added = [...base, { id: 'fourth', employer: 'Elsewhere', box1Wages: '75', box2FederalWithholding: '5' }]
    expect(isRepeatedW2ReviewAcknowledged2025(repeatedW2ReviewSignature2025(added, 'single'), accepted)).toBe(false)
  })

  test('removing an unflagged document invalidates confirmation', () => {
    expect(isRepeatedW2ReviewAcknowledged2025(repeatedW2ReviewSignature2025(base.slice(0, 2), 'single'), accepted)).toBe(false)
  })

  test('resolving a possible duplicate needs no acknowledgement', () => {
    const resolved = [base[0], { ...base[1], employer: 'Different Employer' }, base[2]]
    expect(repeatedW2ReviewSignature2025(resolved, 'single')).toBeNull()
    expect(isRepeatedW2ReviewAcknowledged2025(null, accepted)).toBe(true)
  })

  test('a new duplicate group cannot reuse confirmation for a previous group', () => {
    const newGroup = [base[0], { ...base[1], employer: 'Other', box1Wages: '500.00', box2FederalWithholding: '50.00' }, base[2]]
    expect(isRepeatedW2ReviewAcknowledged2025(repeatedW2ReviewSignature2025(newGroup, 'single'), accepted)).toBe(false)
  })

  test('acknowledgement is bound to filing status and exact snapshot', () => {
    expect(isRepeatedW2ReviewAcknowledged2025(accepted, accepted)).toBe(true)
    expect(isRepeatedW2ReviewAcknowledged2025(repeatedW2ReviewSignature2025(base, 'headOfHousehold'), accepted)).toBe(false)
    expect(isRepeatedW2ReviewAcknowledged2025(accepted, null)).toBe(false)
  })
})
