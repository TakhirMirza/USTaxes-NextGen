import { validate2025SourceEntries } from './sourceEntryValidation2025'
const w2 = { id: 'w1', employer: 'Example', box1Wages: 1000, box2FederalWithholding: 100 }
const interest = { id: 'i1', payer: 'Bank', box1TaxableInterest: 12.34, federalWithholding: 0 }
test('accepts distinct valid documents', () => expect(() => validate2025SourceEntries([w2], [interest])).not.toThrow())
test('rejects cross-type duplicate IDs', () => expect(() => validate2025SourceEntries([w2], [{ ...interest, id: 'w1' }])).toThrow(/unique/))
test('rejects fractional cents', () => expect(() => validate2025SourceEntries([{ ...w2, box1Wages: 100.001 }], [])).toThrow(/whole cents/))
test('rejects invalid numbers', () => expect(() => validate2025SourceEntries([w2], [{ ...interest, federalWithholding: NaN }])).toThrow(/finite/))
test('rejects missing payers', () => expect(() => validate2025SourceEntries([], [{ ...interest, payer: ' ' }])).toThrow(/payer/))
