/**
 * Schedule 1-A (2025), Part IV — qualified passenger vehicle loan interest.
 * Based on user-supplied IRS 2025 Form 1040 instructions, printed pp. 109–110.
 * Evidence-gated candidate only: NOT an authorized Form 1040 line 13b amount.
 */
import { FilingStatus2025 } from './preview2025'

export interface VehicleLoanInterest2025 {
  vin: string
  interestPaid2025: number
  interestDeductedElsewhere: number
  /** Confirm original loan was originated after December 31, 2024. */
  originatedAfter2024: boolean
  loanOriginatedByTaxpayer: boolean
  loanUsedToPurchaseVehicleNotLease: boolean
  securedByFirstLien: boolean
  originalUseBeganWithTaxpayer: boolean
  eligibleVehicleTypeAndWeight: boolean
  finalAssemblyInUnitedStatesVerified: boolean
  predominantlyPersonalUse: boolean
  qualifiedLoanAndRefinancingReviewed: boolean
}
export interface VehicleInterestFacts2025 {
  filingStatus: FilingStatus2025
  modifiedAdjustedGrossIncome: number
  loans: readonly VehicleLoanInterest2025[]
}
export interface VehicleInterestCandidate2025 {
  year: 2025
  filingReady: false
  verifiedInterestTotal: number | null
  cappedInterest: number | null
  phaseoutReduction: number | null
  calculatedCandidate: number | null
  form1040Line13b: null
  blockers: string[]
}
const statuses: FilingStatus2025[] = ['single','marriedJoint','marriedSeparate','headOfHousehold','qualifyingSurvivingSpouse']
type VehicleLoanBooleanFlag = {
  [K in keyof VehicleLoanInterest2025]: VehicleLoanInterest2025[K] extends boolean ? K : never
}[keyof VehicleLoanInterest2025]
const requiredFlags: VehicleLoanBooleanFlag[] = [
  'originatedAfter2024','loanOriginatedByTaxpayer','loanUsedToPurchaseVehicleNotLease',
  'securedByFirstLien','originalUseBeganWithTaxpayer','eligibleVehicleTypeAndWeight',
  'finalAssemblyInUnitedStatesVerified','predominantlyPersonalUse',
  'qualifiedLoanAndRefinancingReviewed',
]
function cents(amount: number, label: string): number {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12 ||
      !Number.isSafeInteger(Math.round(amount * 100)) ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    throw new RangeError(`${label} must be nonnegative with at most two decimal places`)
  }
  return Math.round(amount * 100)
}
export function calculate2025VehicleInterestCandidate(facts: VehicleInterestFacts2025): VehicleInterestCandidate2025 {
  const magiCents = cents(facts.modifiedAdjustedGrossIncome, 'MAGI')
  if (!statuses.includes(facts.filingStatus)) throw new RangeError('Unsupported filing status')
  if (!Array.isArray(facts.loans)) throw new TypeError('Loans must be an array')
  const blockers: string[] = []
  let totalCents = 0
  const vins = new Set<string>()
  facts.loans.forEach((loan, index) => {
    const label = `Loan ${index + 1}`
    const paid = cents(loan.interestPaid2025, `${label} interest`)
    const elsewhere = cents(loan.interestDeductedElsewhere, `${label} already deducted interest`)
    if (elsewhere > paid) blockers.push(`${label}: interest deducted elsewhere exceeds interest paid.`)
    if (typeof loan.vin !== 'string' || !/^[A-HJ-NPR-Z0-9]{17}$/.test(loan.vin.toUpperCase())) {
      blockers.push(`${label}: valid 17-character VIN is required.`)
    } else {
      const vin = loan.vin.toUpperCase()
      if (vins.has(vin)) blockers.push(`${label}: duplicate VIN; aggregate interest per vehicle first.`)
      vins.add(vin)
    }
    requiredFlags.forEach(flag => {
      if (typeof loan[flag] !== 'boolean') throw new TypeError(`${label}: ${flag} must be boolean`)
      if (!loan[flag]) blockers.push(`${label}: ${flag} not verified.`)
    })
    totalCents += Math.max(0, paid - elsewhere)
    if (!Number.isSafeInteger(totalCents)) throw new RangeError('Interest total exceeds safe precision')
  })
  if (!facts.loans.length) blockers.push('No qualifying vehicle loan records supplied.')
  if (blockers.length) return {year:2025,filingReady:false,verifiedInterestTotal:null,cappedInterest:null,phaseoutReduction:null,calculatedCandidate:null,form1040Line13b:null,blockers}
  const cappedCents = Math.min(totalCents, 1000000)
  const thresholdCents = facts.filingStatus === 'marriedJoint' ? 20000000 : 10000000
  const excessCents = Math.max(0, magiCents - thresholdCents)
  // Schedule 1-A Part IV: $200 reduction per $1,000 (or fraction) over threshold.
  const reductionCents = Math.ceil(excessCents / 100000) * 20000
  return {year:2025,filingReady:false,verifiedInterestTotal:totalCents/100,
    cappedInterest:cappedCents/100,phaseoutReduction:reductionCents/100,
    calculatedCandidate:Math.max(0,cappedCents-reductionCents)/100,
    form1040Line13b:null,blockers}
}
