/**
 * Restricted W-2 / 1099-INT withholding bridge for 2025 Form 1040.
 * Does not infer that other 1099 forms or other withholding are absent.
 * This is NOT a tax return or filing calculation.
 */
import { W2Entry2025, Interest1099Entry2025 } from './income2025'
import { Form1040ReconciliationInputs2025 } from './form1040Reconciliation2025'

function cents(amount: number, description: string): number {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e10 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    throw new RangeError(`${description} must be a finite, nonnegative amount in cents`)
  }
  return Math.round(amount * 100)
}

function uniqueIds(entries: ReadonlyArray<{ id: string }>, name: string): void {
  const ids = new Set<string>()
  for (const entry of entries) {
    if (!entry.id || !entry.id.trim() || ids.has(entry.id)) {
      throw new RangeError(`${name} entries require unique nonempty IDs`)
    }
    ids.add(entry.id)
  }
}

export interface WithholdingBreakdown2025 {
  filingReady: false
  line25aW2Withholding: number
  line25b1099Withholding: number
  line25cOtherWithholding: number
  line25dWithholding: number
}

/**
 * The caller must explicitly provide other1099Withholding and otherWithholding,
 * including zero only after verifying that those sources are absent.
 */
export function summarize2025Withholding(
  w2s: ReadonlyArray<W2Entry2025>,
  interest1099s: ReadonlyArray<Interest1099Entry2025>,
  other1099Withholding: number,
  otherWithholding: number
): WithholdingBreakdown2025 {
  if (w2s.length > 100 || interest1099s.length > 100) throw new RangeError('Too many tax documents')
  uniqueIds(w2s, 'W-2')
  uniqueIds(interest1099s, '1099-INT')
  const a = w2s.reduce((sum, e) => sum + cents(e.box2FederalWithholding, 'W-2 box 2'), 0)
  const b = interest1099s.reduce((sum, e) => sum + cents(e.federalWithholding, '1099-INT withholding'), 0) +
    cents(other1099Withholding, 'Other 1099 withholding')
  const c = cents(otherWithholding, 'Other withholding')
  const total = a + b + c
  if (!Number.isSafeInteger(total) || total > 1e12) throw new RangeError('Withholding total exceeds supported range')
  return {
    filingReady: false,
    line25aW2Withholding: a / 100,
    line25b1099Withholding: b / 100,
    line25cOtherWithholding: c / 100,
    line25dWithholding: total / 100,
  }
}

/** Refuses to replace inconsistent withholding already supplied by a caller. */
export function attach2025Withholding(
  input: Form1040ReconciliationInputs2025,
  breakdown: WithholdingBreakdown2025
): Form1040ReconciliationInputs2025 {
  const keys = ['line25aW2Withholding', 'line25b1099Withholding',
    'line25cOtherWithholding', 'line25dWithholding'] as const
  for (const key of keys) {
    const existing = input[key]
    if (existing !== undefined && cents(existing, key) !== cents(breakdown[key], key)) {
      throw new RangeError(`Existing ${key} conflicts with document withholding`)
    }
  }
  return { ...input, ...breakdown }
}
