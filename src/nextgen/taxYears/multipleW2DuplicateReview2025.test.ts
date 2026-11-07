import { findPotentialRepeatedW2_2025, repeatedW2ReviewSignature2025, isRepeatedW2ReviewAcknowledged2025, describePotentialRepeatedW2Groups2025, potentialRepeatedW2ReviewDetails2025, potentialW2WithholdingDifferences2025 } from './multipleW2DuplicateReview2025'
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
    ['duplicate wages formatting', 1, 'box1Wages', '123.45 '],
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

  test('fractional-cent wages are rejected rather than treated as a duplicate', () => {
    const invalid = base.map((document, index) => index === 1 ? { ...document, box1Wages: '123.450' } : document)
    expect(findPotentialRepeatedW2_2025(invalid)).toEqual([])
    expect(repeatedW2ReviewSignature2025(invalid, 'single')).toBeNull()
    // The separate W-2 input validation gate rejects this invalid amount.
    // A null duplicate signature does not make invalid wages filing-ready.
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


describe('Stage 129 transparent potential duplicate group references', () => {
  test('reports one-based positions for multiple separate potential-repeat groups', () => {
    const documents: W2DocumentInput2025[] = [
      first,
      { id: 'other-1', employer: 'Elsewhere', box1Wages: '50.00', box2FederalWithholding: '5.00' },
      { ...first, id: 'second' },
      { id: 'other-2', employer: 'Elsewhere', box1Wages: '50.00', box2FederalWithholding: '5.00' },
      { ...first, id: 'third' },
    ]
    expect(describePotentialRepeatedW2Groups2025(documents)).toEqual([
      'W-2 documents 1, 3, 5',
      'W-2 documents 2, 4',
    ])
  })

  test('does not report a group for invalid fractional-cent entries', () => {
    expect(describePotentialRepeatedW2Groups2025([first, { ...first, id: 'second', box1Wages: '123.450' }])).toEqual([])
  })

  test('does not report a group for distinct valid documents', () => {
    expect(describePotentialRepeatedW2Groups2025([first, { ...first, id: 'second', employer: 'Different' }])).toEqual([])
  })
})


describe('Stage 130 source-review detail regression', () => {
  test('shows group positions and validated comparison values', () => {
    const documents = [first, { ...first, id: 'second', employer: ' ACME ', box2FederalWithholding: '12.3' }]
    expect(potentialRepeatedW2ReviewDetails2025(documents)).toEqual([{
      documentPositions: [1, 2], employerLabel: 'Acme', box1Wages: 123.45, box2FederalWithholding: 12.3,
    }])
  })
  test('omits incomplete or fractional-cent source entries', () => {
    expect(potentialRepeatedW2ReviewDetails2025([first, { ...first, id: 'second', box1Wages: '123.450' }])).toEqual([])
    expect(potentialRepeatedW2ReviewDetails2025([first, { ...first, id: 'second', box2FederalWithholding: '' }])).toEqual([])
  })
  test('does not alter review acknowledgement requirement', () => {
    const documents = [first, { ...first, id: 'second' }]
    expect(potentialRepeatedW2ReviewDetails2025(documents)).toHaveLength(1)
    expect(isRepeatedW2ReviewAcknowledged2025(repeatedW2ReviewSignature2025(documents), null)).toBe(false)
  })
})


describe('Stage 131 same-employer wage / withholding difference review', () => {
  test('reports positions and distinct Box 2 amounts without inferring duplication', () => {
    expect(potentialW2WithholdingDifferences2025([first, { ...first, id: 'two', employer: ' ACME ', box2FederalWithholding: '12.31' }])).toEqual([{
      documentPositions: [1, 2], employerLabel: 'Acme', box1Wages: 123.45, box2Withholdings: [12.3, 12.31],
    }])
  })
  test('does not flag identical withholding or unrelated employers', () => {
    expect(potentialW2WithholdingDifferences2025([first, { ...first, id: 'two' }])).toEqual([])
    expect(potentialW2WithholdingDifferences2025([first, { ...first, id: 'two', employer: 'Elsewhere', box2FederalWithholding: '12.31' }])).toEqual([])
  })
  test('ignores invalid and incomplete amounts', () => {
    expect(potentialW2WithholdingDifferences2025([first, { ...first, id: 'two', box2FederalWithholding: '' }])).toEqual([])
    expect(potentialW2WithholdingDifferences2025([first, { ...first, id: 'two', box1Wages: '123.450', box2FederalWithholding: '12.31' }])).toEqual([])
  })
  test('informational signal does not weaken the existing duplicate acknowledgement gate', () => {
    const documents = [first, { ...first, id: 'two', box2FederalWithholding: '12.31' }]
    expect(potentialW2WithholdingDifferences2025(documents)).toHaveLength(1)
    expect(repeatedW2ReviewSignature2025(documents)).toBeNull()
    expect(isRepeatedW2ReviewAcknowledged2025(repeatedW2ReviewSignature2025([first, { ...first, id: 'two' }]), null)).toBe(false)
  })
})
