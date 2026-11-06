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
