import { create2025Schedule1Worksheet } from './schedule1Worksheet2025'
import { makeRestricted2025Draft } from './form1040Draft2025'

describe('restricted 2025 Schedule 1 worksheet', () => {
  test('aggregates separate income and adjustments without claiming eligibility', () => {
    const s = create2025Schedule1Worksheet([{line:'3', amount:1200.25}, {line:'8z', amount:100}, {line:'15', amount:300.25}])
    expect(s.otherIncome).toBe(1300.25)
    expect(s.adjustments).toBe(300.25)
    expect(s.netIncomeEffect).toBe(1000)
    expect(s.filingReady).toBe(false)
    expect(s.classificationConfirmed).toBe(false)
  })
  test('rejects negative, fractional-cent and unsupported values', () => {
    expect(() => create2025Schedule1Worksheet([{line:'3', amount:-1}])).toThrow(RangeError)
    expect(() => create2025Schedule1Worksheet([{line:'3', amount:0.001}])).toThrow(RangeError)
    expect(() => create2025Schedule1Worksheet([{line:'10' as any, amount:5}])).toThrow(RangeError)
  })
  test('maps Schedule 1 to Form 1040 draft lines 8, 10, 11a and 15', () => {
    const d = makeRestricted2025Draft([{id:'w',employer:'Example',box1Wages:100000,box2FederalWithholding:5000}], [], 'single', false, false, [
      {line:'3', amount:10000}, {line:'15', amount:2500},
    ])
    expect(d.lines['8']).toBe(10000)
    expect(d.lines['9']).toBe(110000)
    expect(d.lines['10']).toBe(2500)
    expect(d.lines['11a']).toBe(107500)
    expect(d.lines['15']).toBe(91750)
    expect(d.line16.kind).toBe('blocked')
    expect(d.filingReady).toBe(false)
  })
})
