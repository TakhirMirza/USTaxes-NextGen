/**
 * Schedule 1-A (2025), Part II — qualified tips candidate only.
 * Source: user-supplied 2025 IRS Form 1040 instructions, printed pp. 101–105.
 * Not a complete eligibility determination or filing-ready calculation.
 */
import { FilingStatus2025 } from './preview2025'

export interface QualifiedTipsFacts2025 {
  filingStatus: FilingStatus2025
  married: boolean
  /** Employee tips supported by W-2/4070/4137 without double counting. */
  verifiedEmployeeTips: number
  /** Self-employed tips after per-business net-income limitations. */
  verifiedBusinessTipsAfterNetIncomeLimit: number
  modifiedAdjustedGrossIncome: number
  eligibleOccupationVerified: boolean
  voluntaryTipsAndRecordsVerified: boolean
  eligibleEarnersHaveValidSsn: boolean
  businessNetIncomeLimitsVerified: boolean
}
export interface QualifiedTipsCandidate2025 {
  year: 2025
  filingReady: false
  eligibleTips: number | null
  cappedTips: number | null
  phaseoutReduction: number | null
  calculatedCandidate: number | null
  form1040Line13b: null
  blockers: string[]
}
function checkMoney(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1e12 ||
      !Number.isSafeInteger(Math.round(value * 100)) ||
      Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) {
    throw new RangeError(`${label} must be nonnegative with at most two decimal places`)
  }
}
export function calculate2025QualifiedTipsCandidate(facts: QualifiedTipsFacts2025): QualifiedTipsCandidate2025 {
  checkMoney(facts.verifiedEmployeeTips, 'Employee tips')
  checkMoney(facts.verifiedBusinessTipsAfterNetIncomeLimit, 'Business tips')
  checkMoney(facts.modifiedAdjustedGrossIncome, 'MAGI')
  const flags: (keyof QualifiedTipsFacts2025)[] = [
    'married', 'eligibleOccupationVerified', 'voluntaryTipsAndRecordsVerified',
    'eligibleEarnersHaveValidSsn', 'businessNetIncomeLimitsVerified',
  ]
  if (flags.some(key => typeof facts[key] !== 'boolean')) throw new TypeError('Evidence flags must be booleans')
  const statuses: FilingStatus2025[] = ['single','marriedJoint','marriedSeparate','headOfHousehold','qualifyingSurvivingSpouse']
  if (!statuses.includes(facts.filingStatus)) throw new RangeError('Unsupported filing status')
  const joint = facts.filingStatus === 'marriedJoint'
  const blockers: string[] = []
  if (facts.married && !joint) blockers.push('Married taxpayers must file jointly to claim qualified tips deduction.')
  if (!facts.married && (joint || facts.filingStatus === 'marriedSeparate')) blockers.push('Marital status conflicts with filing status.')
  if (!facts.eligibleOccupationVerified) blockers.push('Eligible tipped occupation has not been verified.')
  if (!facts.voluntaryTipsAndRecordsVerified) blockers.push('Voluntary nature of tips and source records have not been verified.')
  if (!facts.eligibleEarnersHaveValidSsn) blockers.push('Valid SSN of eligible tip earner has not been verified.')
  if (facts.verifiedBusinessTipsAfterNetIncomeLimit > 0 && !facts.businessNetIncomeLimitsVerified) {
    blockers.push('Per-business net-income limitation for self-employed tips has not been verified.')
  }
  if (blockers.length) return {year:2025,filingReady:false,eligibleTips:null,cappedTips:null,phaseoutReduction:null,calculatedCandidate:null,form1040Line13b:null,blockers}
  const eligibleTips = (Math.round(facts.verifiedEmployeeTips*100) + Math.round(facts.verifiedBusinessTipsAfterNetIncomeLimit*100))/100
  const cappedTips = Math.min(25000,eligibleTips)
  const threshold = joint ? 300000 : 150000
  const excessCents = Math.max(0,Math.round(facts.modifiedAdjustedGrossIncome*100)-threshold*100)
  const phaseoutReduction = Math.ceil(excessCents/100000)*100
  return {year:2025,filingReady:false,eligibleTips,cappedTips,phaseoutReduction,
    calculatedCandidate:Math.max(0,cappedTips-phaseoutReduction),form1040Line13b:null,blockers}
}
