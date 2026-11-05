import { presentRestricted2025Review } from './form1040ReviewPresentation2025'
const base = () => ({ year: 2025, filingReady: false, postingAuthorized: false,
  officialLines: { '17': null, '18': null },
  candidates: { line17: 0, line18: 1200, line20: null, line21: null, line22: null, line23: null, line24: null, line31: null, line32: null, line33: null, line34: null, line37: null },
  blockers: ['Awaiting credit review'] })
test('renders explicit zero distinctly from unknown', () => {
  const r = presentRestricted2025Review(base())
  expect(r.rows[0].display).toBe('$0.00')
  expect(r.rows[2].display).toBe('Not reviewed')
  expect(r.status).toBe('NOT FILING READY')
})
test('rejects filing ready or posted records', () => {
  expect(() => presentRestricted2025Review({ ...base(), filingReady: true })).toThrow()
  expect(() => presentRestricted2025Review({ ...base(), postingAuthorized: true })).toThrow()
})
test('rejects any posted official line', () => {
  expect(() => presentRestricted2025Review({ ...base(), officialLines: { '17': 0 } })).toThrow()
})
test('rejects invalid and missing candidate amounts', () => {
  expect(() => presentRestricted2025Review({ ...base(), candidates: { ...base().candidates, line18: -1 } })).toThrow()
  const r = base() as any; delete r.candidates.line18
  expect(() => presentRestricted2025Review(r)).toThrow()
})
test('preserves blockers', () => expect(presentRestricted2025Review(base()).blockers).toEqual(['Awaiting credit review']))
