import rules from '../tax2025-reference.json'

export type FilingStatus2025 = keyof typeof rules.standardDeduction
export const filingStatuses2025: { value: FilingStatus2025; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'marriedJoint', label: 'Married filing jointly' },
  { value: 'marriedSeparate', label: 'Married filing separately' },
  { value: 'headOfHousehold', label: 'Head of household' },
  { value: 'qualifyingSurvivingSpouse', label: 'Qualifying surviving spouse' },
]

/** Illustrative ordinary-rate calculation, NOT Form 1040 tax liability. */
export function preview2025OrdinaryWages(grossWages: number, status: FilingStatus2025) {
  if (!Number.isFinite(grossWages) || grossWages < 0 || grossWages > 1e12) {
    throw new RangeError('Enter a valid nonnegative wage amount')
  }
  const deduction = rules.standardDeduction[status]
  if (!Number.isFinite(deduction)) throw new RangeError('Invalid filing status')
  const taxable = Math.max(0, grossWages - deduction)
  const tiers: number[][] = rules.brackets[status]
  let estimate = 0
  for (let i = 0; i < tiers.length; i++) {
    const [floor, rate] = tiers[i]
    const ceiling = i + 1 < tiers.length ? tiers[i + 1][0] : Infinity
    estimate += Math.max(0, Math.min(taxable, ceiling) - floor) * rate
  }
  return {
    grossWages,
    standardDeduction: deduction,
    taxableOrdinaryIncome: taxable,
    illustrativeBracketTax: Math.round((estimate + Number.EPSILON) * 100) / 100,
    filingReady: false as const,
  }
}
