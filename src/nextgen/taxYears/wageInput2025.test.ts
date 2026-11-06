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
