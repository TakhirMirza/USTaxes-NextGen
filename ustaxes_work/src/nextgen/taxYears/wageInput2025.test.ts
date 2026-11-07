import { getWageInputFeedback2025 } from './wageInput2025'
import { parseWageInput2025 } from './wageInput2025'

test('accepts ordinary nonnegative dollar amounts with up to two decimal places', () => {
  expect(parseWageInput2025('0')).toBe(0)
  expect(parseWageInput2025(' 1250.25 ')).toBe(1250.25)
  expect(parseWageInput2025('1000000000000')).toBe(1e12)
})

test.each(['', ' ', '-1', '+1', '1e3', '1,000', '$100', '1.234', '.50', '1.', 'Infinity', 'NaN', '1000000000000.01', '0x10'])('rejects invalid wage input %s', input => {
  expect(parseWageInput2025(input)).toBeNull()
})

test('rejects hostile and imported non-string values at runtime', () => {
  const imported: unknown[] = [null, undefined, 42, {}, [], true]
  imported.forEach(value => {
    expect(parseWageInput2025(value as string)).toBeNull()
  })
})


describe('Stage 114 live field feedback', () => {
  test.each(['', ' ', '\t'])('blank input %j requests wages without reporting a malformed amount', input => {
    expect(getWageInputFeedback2025(input).kind).toBe('empty')
  })
  test.each(['-1', '1e5', '1,000', '$100', '10.999', '1000000000000.01', 'Infinity'])('invalid amount %s is blocked', input => {
    expect(getWageInputFeedback2025(input).kind).toBe('invalid')
  })
  test.each(['0', '0.00', '12345.67', '1000000000000'])('valid amount %s remains illustrative', input => {
    expect(getWageInputFeedback2025(input).kind).toBe('valid')
    expect(getWageInputFeedback2025(input).message).toMatch(/not a complete tax return/i)
  })
})
