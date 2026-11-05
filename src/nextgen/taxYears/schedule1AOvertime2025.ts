/**
 * 2025 Schedule 1-A Part III: qualified overtime deduction candidate.
 * Source: IRS 2025 Instructions for Form 1040, Schedule 1-A, Part III,
 * https://www.irs.gov/pub/irs-pdf/i1040gi.pdf (printed pp. 106-108).
 * This is NOT a filing-ready determination: FLSA coverage, source-document
 * substantiation, Schedule 1-A MAGI and SSN must be independently established.
 */
import { FilingStatus2025 } from './preview2025'

export interface OvertimeDeductionFacts2025 {
  filingStatus: FilingStatus2025
  married: boolean
  /** Only the FLSA-required premium above regular pay, not gross overtime wages. */
  qualifiedFlsaOvertimePremium: number
  modifiedAdjustedGrossIncome: number
  /** Explicitly reviewed FLSA qualification and source evidence. */
  flsaPremiumVerified: boolean
  /** Every spouse who earned claimed overtime has a valid SSN. */
  eligibleEarnersHaveValidSsn: boolean
}

export interface OvertimeDeductionCandidate2025 {
  year: 2025
  filingReady: false
  cappedPremium: number
  phaseoutReduction: number | null
  calculatedCandidate: number | null
  form1040Line13b: null
  blockers: string[]
}

function requireMoney(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1e12 ||
      !Number.isSafeInteger(Math.round(value * 100)) ||
      Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) {
    throw new RangeError(`${name} must be a nonnegative monetary amount with at most two decimal places`)
  }
}

export function calculate2025OvertimeDeductionCandidate(
  facts: OvertimeDeductionFacts2025,
): OvertimeDeductionCandidate2025 {
  requireMoney(facts.qualifiedFlsaOvertimePremium, 'FLSA overtime premium')
  requireMoney(facts.modifiedAdjustedGrossIncome, 'MAGI')
  if (typeof facts.married !== 'boolean' ||
      typeof facts.flsaPremiumVerified !== 'boolean' ||
      typeof facts.eligibleEarnersHaveValidSsn !== 'boolean') {
    throw new TypeError('Eligibility evidence must be explicit booleans')
  }
  const validStatuses: FilingStatus2025[] = [
    'single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold', 'qualifyingSurvivingSpouse',
  ]
  if (!validStatuses.includes(facts.filingStatus)) throw new RangeError('Unsupported filing status')
  const joint = facts.filingStatus === 'marriedJoint'
  const blockers: string[] = []
  if (facts.married && !joint) blockers.push('Married taxpayers must file jointly to claim qualified overtime deduction.')
  if (!facts.married && (joint || facts.filingStatus === 'marriedSeparate')) {
    blockers.push('Marital status conflicts with filing status.')
  }
  if (!facts.flsaPremiumVerified) blockers.push('FLSA-required premium and supporting source documents have not been verified.')
  if (!facts.eligibleEarnersHaveValidSsn) blockers.push('Valid SSN for each person claiming overtime has not been verified.')
  const cappedPremium = Math.min(facts.qualifiedFlsaOvertimePremium, joint ? 25000 : 12500)
  if (blockers.length) return {
    year: 2025, filingReady: false, cappedPremium,
    phaseoutReduction: null, calculatedCandidate: null, form1040Line13b: null, blockers,
  }
  const threshold = joint ? 300000 : 150000
  // Schedule 1-A phaseout: $100 for each $1,000 (or fraction thereof)
  // by which MAGI exceeds the threshold. Work in cents to avoid float boundary errors.
  const excessCents = Math.max(0, Math.round(facts.modifiedAdjustedGrossIncome * 100) - threshold * 100)
  const phaseoutReduction = Math.ceil(excessCents / 100000) * 100
  return {
    year: 2025, filingReady: false, cappedPremium, phaseoutReduction,
    calculatedCandidate: Math.max(0, cappedPremium - phaseoutReduction),
    form1040Line13b: null, blockers,
  }
}
