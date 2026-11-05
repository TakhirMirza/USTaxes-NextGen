/**
 * Limited 2025 standard deduction calculator for independently confirmed facts.
 * IRS Publication 501 (2025), Tables 6-8:
 * https://www.irs.gov/publications/p501
 * Does NOT resolve disaster-loss adjustments, dependent worksheet, nonresident
 * exceptions or special married-filing-separately spouse eligibility.
 */
import { FilingStatus2025 } from './preview2025'
import { StandardDeductionFacts2025 } from './standardDeductionReview2025'
import rules from '../tax2025-reference.json'

export interface StandardDeductionAmount2025 {
  year: 2025
  filingReady: false
  amount: number | null
  basicAmount: number
  additionalAgeBlindness: number | null
  blockers: string[]
}

/** An explicit spouse eligibility review is needed for married filing separately. */
export function calculate2025StandardDeduction(
  status: FilingStatus2025,
  facts?: StandardDeductionFacts2025,
): StandardDeductionAmount2025 {
  const basicAmount: number = rules.standardDeduction[status]
  if (!Number.isFinite(basicAmount)) throw new RangeError('Invalid filing status')
  const blockers: string[] = []
  if (!facts) blockers.push('Taxpayer eligibility facts are missing.')
  else {
    const keys: (keyof StandardDeductionFacts2025)[] = [
      'canBeClaimedAsDependent', 'taxpayerAge65OrOlder', 'spouseAge65OrOlder',
      'taxpayerBlind', 'spouseBlind', 'spouseItemizes',
      'nonresidentAlienDuringYear', 'itemizing',
    ]
    if (keys.some(key => typeof facts[key] !== 'boolean')) {
      blockers.push('All eligibility answers must be explicit booleans.')
    } else {
      if (facts.canBeClaimedAsDependent) blockers.push('Dependent earned-income worksheet is required.')
      if (facts.itemizing) blockers.push('Taxpayer elected itemized deductions.')
      if (facts.nonresidentAlienDuringYear) blockers.push('Nonresident/dual-status rules require separate review.')
      if (status === 'marriedSeparate' && facts.spouseItemizes) {
        blockers.push('Spouse itemizes on a separate return.')
      }
      if (status === 'marriedSeparate' && (facts.spouseAge65OrOlder || facts.spouseBlind)) {
        blockers.push('Spouse age/blindness deduction on separate return requires spouse income/dependency review.')
      }
      if (!['marriedJoint', 'marriedSeparate'].includes(status) &&
          (facts.spouseAge65OrOlder || facts.spouseBlind)) {
        blockers.push('Spouse age/blindness boxes are inconsistent with filing status.')
      }
      if (status === 'qualifyingSurvivingSpouse' && (facts.spouseAge65OrOlder || facts.spouseBlind)) {
        blockers.push('Surviving spouse cannot count deceased spouse age/blindness boxes.')
      }
    }
  }
  if (!facts || blockers.length) return {
    year: 2025, filingReady: false, amount: null, basicAmount,
    additionalAgeBlindness: null, blockers,
  }
  const spouseBoxes = status === 'marriedJoint' ?
    Number(facts.spouseAge65OrOlder) + Number(facts.spouseBlind) : 0
  const boxes = Number(facts.taxpayerAge65OrOlder) + Number(facts.taxpayerBlind) + spouseBoxes
  const perBox = status === 'single' || status === 'headOfHousehold' ? 2000 : 1600
  const additionalAgeBlindness = boxes * perBox
  return {
    year: 2025, filingReady: false, amount: basicAmount + additionalAgeBlindness,
    basicAmount, additionalAgeBlindness, blockers,
  }
}
