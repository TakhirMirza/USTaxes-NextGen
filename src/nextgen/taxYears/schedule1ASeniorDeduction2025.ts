/**
 * 2025 Schedule 1-A enhanced deduction for seniors — limited calculation.
 * Section 151(c)(1)(A) as amended by Public Law 119-21; Schedule 1-A.
 * Not a filing-ready determination. Identity, citizenship, SSN, and other
 * eligibility facts must be reviewed independently before use on line 13b.
 */
import { FilingStatus2025 } from './preview2025'

export interface SeniorDeductionFacts2025 {
  filingStatus: FilingStatus2025
  modifiedAdjustedGrossIncome: number
  taxpayerAge65ByYearEnd: boolean
  spouseAge65ByYearEnd: boolean
  /** Must be true only after independent review of Schedule 1-A eligibility. */
  taxpayerEligible: boolean
  spouseEligible: boolean
  /** Married taxpayers must file jointly to claim this deduction. */
  married: boolean
}
export interface SeniorDeductionResult2025 {
  year: 2025
  filingReady: false
  /** Calculated candidate, NOT an approved Form 1040 line 13b amount. */
  calculatedCandidate: number | null
  maximumBeforePhaseout: number
  phaseout: number | null
  form1040Line13b: null
  blockers: string[]
}

export function calculate2025SeniorDeduction(facts: SeniorDeductionFacts2025): SeniorDeductionResult2025 {
  const blockers: string[] = []
  const magi = facts.modifiedAdjustedGrossIncome
  if (!Number.isFinite(magi) || magi < 0 || magi > 1e12 ||
      !Number.isSafeInteger(Math.round(magi * 100)) ||
      Math.abs(magi * 100 - Math.round(magi * 100)) > 1e-7) {
    throw new RangeError('MAGI must be a nonnegative amount with at most two decimal places')
  }
  const booleans: (keyof SeniorDeductionFacts2025)[] = [
    'taxpayerAge65ByYearEnd', 'spouseAge65ByYearEnd', 'taxpayerEligible',
    'spouseEligible', 'married',
  ]
  if (booleans.some(key => typeof facts[key] !== 'boolean')) {
    throw new TypeError('All eligibility declarations must be explicit booleans')
  }
  const joint = facts.filingStatus === 'marriedJoint'
  if (facts.married && !joint) blockers.push('Married taxpayers must file jointly for the enhanced senior deduction.')
  if (!facts.married && (joint || facts.filingStatus === 'marriedSeparate')) blockers.push('Marital status contradicts filing status.')
  if (!joint && (facts.spouseAge65ByYearEnd || facts.spouseEligible)) blockers.push('Spouse senior deduction is not available for this filing status.')
  if (facts.taxpayerEligible && !facts.taxpayerAge65ByYearEnd) blockers.push('Taxpayer cannot be eligible without meeting age 65 requirement.')
  if (facts.spouseEligible && !facts.spouseAge65ByYearEnd) blockers.push('Spouse cannot be eligible without meeting age 65 requirement.')
  if (facts.taxpayerAge65ByYearEnd && !facts.taxpayerEligible) blockers.push('Taxpayer senior deduction eligibility has not been confirmed.')
  if (joint && facts.spouseAge65ByYearEnd && !facts.spouseEligible) blockers.push('Spouse senior deduction eligibility has not been confirmed.')
  const maximumBeforePhaseout = 6000 * (Number(facts.taxpayerEligible && facts.taxpayerAge65ByYearEnd) +
    Number(joint && facts.spouseEligible && facts.spouseAge65ByYearEnd))
  if (blockers.length) return {
    year: 2025, filingReady: false, calculatedCandidate: null,
    maximumBeforePhaseout, phaseout: null, form1040Line13b: null, blockers,
  }
  const threshold = joint ? 150000 : 75000
  // Six percent of excess MAGI, rounded to whole dollars for this preliminary
  // computation. Do not treat this as a completed Schedule 1-A worksheet.
  const phaseout = Math.round(Math.max(0, magi - threshold) * 0.06)
  return {
    year: 2025, filingReady: false,
    calculatedCandidate: Math.max(0, maximumBeforePhaseout - phaseout),
    maximumBeforePhaseout, phaseout, form1040Line13b: null, blockers,
  }
}
