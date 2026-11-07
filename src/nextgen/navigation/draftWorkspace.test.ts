import { parseDraftWorkspace } from './draftWorkspace'
const valid = { version: 1, year: '2025', filingStatus: 'single', hasDependents: 'no', deduction: 'standard', incomeKinds: ['W-2 wages'], wages: [{id: 1, employer: 'Example', wages: '80000.00', withholding: '9000'}], interest: '', payer: '', basicDeductionConfirmed: true, noOtherItemsConfirmed: true, ordinaryTaxMethodConfirmed: true }
describe('tax return draft import boundary', () => {
  it('accepts a well-formed versioned scenario', () => { expect(parseDraftWorkspace(valid)?.wages[0].wages).toBe('80000.00') })
  it('rejects unsupported schema, year, invalid money and duplicate sources', () => {
    expect(parseDraftWorkspace({...valid, version: 2})).toBeNull()
    expect(parseDraftWorkspace({...valid, year: '2029'})).toBeNull()
    expect(parseDraftWorkspace({...valid, wages: [{...valid.wages[0], wages: '-100'}]})).toBeNull()
    expect(parseDraftWorkspace({...valid, wages: [valid.wages[0], valid.wages[0]]})).toBeNull()
  })
  it('rejects unexpected fields in source values and overlong labels', () => {
    expect(parseDraftWorkspace({...valid, payer: 'x'.repeat(121)})).toBeNull()
  })
})
