/**
 * Validates document identity and currency precision before combining income,
 * withholding and review declarations. No tax-law eligibility is inferred.
 */
import { W2Entry2025, Interest1099Entry2025 } from './income2025'

function money(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1e10 ||
      Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    throw new RangeError(`${label} must be a finite nonnegative amount in whole cents`)
  }
}

export function validate2025SourceEntries(
  w2s: ReadonlyArray<W2Entry2025>,
  interest1099s: ReadonlyArray<Interest1099Entry2025>
): void {
  if (w2s.length > 100 || interest1099s.length > 100) {
    throw new RangeError('Too many source documents')
  }
  const ids = new Set<string>()
  for (const entry of w2s) {
    if (typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id.trim())) {
      throw new RangeError('Document IDs must be unique and nonempty across W-2 and 1099-INT')
    }
    ids.add(entry.id.trim())
    if (typeof entry.employer !== 'string' || !entry.employer.trim()) {
      throw new RangeError('W-2 employer is required')
    }
    money(entry.box1Wages, 'W-2 box 1')
    money(entry.box2FederalWithholding, 'W-2 box 2')
  }
  for (const entry of interest1099s) {
    if (typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id.trim())) {
      throw new RangeError('Document IDs must be unique and nonempty across W-2 and 1099-INT')
    }
    ids.add(entry.id.trim())
    if (typeof entry.payer !== 'string' || !entry.payer.trim()) {
      throw new RangeError('1099-INT payer is required')
    }
    money(entry.box1TaxableInterest, '1099-INT box 1')
    money(entry.federalWithholding, '1099-INT federal withholding')
  }
}
