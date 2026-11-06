/** Strict text-input boundary for the 2025 wages-only illustration.
 * Rejects exponents, grouping separators, signs and fractional cents.
 * This is not a tax document parser or filing authorization.
 */
export function parseWageInput2025(input: string): number | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(trimmed)) return null
  const amount = Number(trimmed)
  if (!Number.isFinite(amount) || amount > 1e12) return null
  return amount
}

/** Human-readable field state for the live illustration; never implies filing eligibility. */
export type WageInputFeedback2025 =
  | { kind: 'empty'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'valid'; message: string }

export function getWageInputFeedback2025(input: string): WageInputFeedback2025 {
  if (input.trim() === '') return { kind: 'empty', message: 'Enter annual W-2 wages to calculate an illustration.' }
  if (parseWageInput2025(input) === null) {
    return { kind: 'invalid', message: 'Use a nonnegative USD amount, up to two decimal places, without commas or symbols (maximum $1 trillion).' }
  }
  return { kind: 'valid', message: 'Illustration only. This is not a complete tax return or refund estimate.' }
}
