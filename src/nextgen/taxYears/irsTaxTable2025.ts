/**
 * 2025 IRS Publication 1040 Tax Table -- RECONSTRUCTION FOR DEVELOPMENT.
 * https://www.irs.gov/publications/p1040
 *
 * This computes tax on the midpoint of the applicable published income band
 * using the 2025 statutory ordinary-income brackets. The method reproduces
 * selected published IRS entries, but is NOT a transcription or independently
 * audited copy of all 2,000+ rows. Treat all results as PROVISIONAL.
 * Do not use for Form 1040 line 16 or filing until the full table is imported,
 * cross-checked row-by-row and special worksheets are supported.
 */
import { FilingStatus2025 } from './preview2025'

interface Bracket { ceiling: number; rate: number }
const single: Bracket[] = [
  { ceiling: 11925, rate: .10 }, { ceiling: 48475, rate: .12 },
  { ceiling: 103350, rate: .22 },
]
const joint: Bracket[] = [
  { ceiling: 23850, rate: .10 }, { ceiling: 96950, rate: .12 },
  { ceiling: 206700, rate: .22 },
]
const head: Bracket[] = [
  { ceiling: 17000, rate: .10 }, { ceiling: 64850, rate: .12 },
  { ceiling: 103350, rate: .22 },
]
const brackets: Record<FilingStatus2025, Bracket[]> = {
  single, marriedJoint: joint, marriedSeparate: single,
  headOfHousehold: head, qualifyingSurvivingSpouse: joint,
}

export interface ProvisionalTaxTableResult2025 {
  kind: 'provisional-tax-table'
  lowerBound: number
  upperBound: number
  midpoint: number
  provisionalTax: number
  method: '2025 IRS table band midpoint (unverified reconstruction)'
  filingReady: false
}

function ordinaryBracketTax(income: number, status: FilingStatus2025): number {
  let previous = 0
  let tax = 0
  for (const bracket of brackets[status]) {
    const part = Math.max(0, Math.min(income, bracket.ceiling) - previous)
    tax += part * bracket.rate
    previous = bracket.ceiling
    if (income <= previous) break
  }
  return tax
}

/** For research and comparison only; NOT an authoritative IRS tax-table lookup. */
export function reconstruct2025TaxTableBand(
  taxableIncome: number,
  status: FilingStatus2025
): ProvisionalTaxTableResult2025 {
  if (!Number.isFinite(taxableIncome) || taxableIncome < 0 || taxableIncome >= 100000) {
    throw new RangeError('2025 Tax Table applies only to taxable income from $0 to under $100,000')
  }
  if (!Object.prototype.hasOwnProperty.call(brackets, status)) {
    throw new RangeError('Invalid filing status')
  }
  let lowerBound: number
  let upperBound: number
  if (taxableIncome < 5) {
    lowerBound = 0
    upperBound = 5
  } else if (taxableIncome < 25) {
    lowerBound = taxableIncome < 15 ? 5 : 15
    upperBound = lowerBound + 10
  } else if (taxableIncome < 3000) {
    lowerBound = 25 + Math.floor((taxableIncome - 25) / 25) * 25
    upperBound = lowerBound + 25
  } else {
    lowerBound = 3000 + Math.floor((taxableIncome - 3000) / 50) * 50
    upperBound = lowerBound + 50
  }
  const midpoint = (lowerBound + upperBound) / 2
  return {
    kind: 'provisional-tax-table', lowerBound, upperBound, midpoint,
    provisionalTax: Math.round(ordinaryBracketTax(midpoint, status)),
    method: '2025 IRS table band midpoint (unverified reconstruction)',
    filingReady: false,
  }
}
