/**
 * 2025 Form 1040 integration boundary: assembles draft, document withholding,
 * and arithmetic reconciliation without manufacturing missing tax facts.
 * This is a review aid, NEVER a filing-ready return.
 */
import { CreditEvidence2025, CreditEvidenceReview2025, review2025CreditEvidence } from './creditEvidence2025'
import { SourceReviewDeclaration2025, SourceDocumentReview2025, review2025SourceDocuments } from './sourceDocumentReview2025'
import { validate2025SourceEntries } from './sourceEntryValidation2025'
import { FilingStatus2025 } from './preview2025'
import { calculate2025StandardDeduction, StandardDeductionAmount2025 } from './standardDeductionAmount2025'
import { review2025StandardDeduction, StandardDeductionFacts2025, StandardDeductionReview2025 } from './standardDeductionReview2025'
import { W2Entry2025, Interest1099Entry2025 } from './income2025'
import { Schedule1Entry2025 } from './schedule1Worksheet2025'
import { Schedule1ACandidate2025, Schedule1AStaging2025, stage2025Schedule1ACandidates } from './schedule1AWorksheet2025'
import { calculate2025SeniorDeduction, SeniorDeductionFacts2025, SeniorDeductionResult2025 } from './schedule1ASeniorDeduction2025'
import { review2025Schedule1AConsistency, Schedule1AConsistency2025 } from './schedule1AConsistency2025'
import { review2025SeniorEligibilityEvidence, SeniorEligibilityEvidence2025, SeniorEvidenceReview2025 } from './seniorEligibilityEvidence2025'
import { makeRestricted2025Draft, RestrictedDraft2025 } from './form1040Draft2025'
import { summarize2025Withholding, attach2025Withholding, WithholdingBreakdown2025 } from './withholdingBridge2025'
import { reconcile2025Form1040Arithmetic, Form1040Reconciliation2025, Form1040ReconciliationInputs2025 } from './form1040Reconciliation2025'

export interface Form1040PipelineFacts2025 {
  w2: W2Entry2025[]
  interest1099: Interest1099Entry2025[]
  filingStatus: FilingStatus2025
  standardDeductionFacts?: StandardDeductionFacts2025
  sourceReview?: SourceReviewDeclaration2025
  schedule1?: readonly Schedule1Entry2025[]
  /** Explicitly reviewed candidate entries; [] means reviewed and none identified. */
  schedule1A?: readonly Schedule1ACandidate2025[]
  /** Optional independently reviewed senior facts; never authorizes line 13b. */
  seniorDeductionFacts?: SeniorDeductionFacts2025
  seniorEligibilityEvidence?: SeniorEligibilityEvidence2025
  /** Only a preparer may affirm these conditions after reviewing all tax documents. */
  ordinaryMethodConfirmed?: boolean
  specialMethodNotRequiredConfirmed?: boolean
  /** Both must be explicit; zero means reviewed and confirmed absent. */
  other1099Withholding?: number
  otherWithholding?: number
  /** Independent tax/credit/payment facts, not derived from the restricted draft. */
  creditEvidence?: readonly CreditEvidence2025[]
  reconciliation?: Form1040ReconciliationInputs2025
}
export interface Form1040PipelineResult2025 {
  year: 2025
  filingReady: false
  draft: RestrictedDraft2025
  standardDeductionReview: StandardDeductionReview2025
  standardDeductionAmount: StandardDeductionAmount2025
  sourceDocumentReview: SourceDocumentReview2025 | null
  schedule1A: Schedule1AStaging2025 | null
  seniorDeduction: SeniorDeductionResult2025 | null
  seniorEvidenceReview: SeniorEvidenceReview2025 | null
  schedule1AConsistency: Schedule1AConsistency2025
  withholding: WithholdingBreakdown2025 | null
  creditEvidenceReview: CreditEvidenceReview2025 | null
  reconciliation: Form1040Reconciliation2025 | null
  blockers: string[]
}

export function build2025Form1040Review(facts: Form1040PipelineFacts2025): Form1040PipelineResult2025 {
  validate2025SourceEntries(facts.w2, facts.interest1099)
  const standardDeductionReview = review2025StandardDeduction(facts.filingStatus, facts.standardDeductionFacts)
  const standardDeductionAmount = calculate2025StandardDeduction(facts.filingStatus, facts.standardDeductionFacts)
  const draft = makeRestricted2025Draft(
    facts.w2, facts.interest1099, facts.filingStatus,
    facts.ordinaryMethodConfirmed === true,
    facts.specialMethodNotRequiredConfirmed === true,
    facts.schedule1,
    standardDeductionAmount.amount === null ? undefined : standardDeductionAmount.amount,
  )
  const blockers: string[] = [
    'Restricted draft excludes unmodeled income, deductions, credits and other schedules.',
    'IRS filing eligibility and PDF/e-file have not been implemented.',
  ]
  if (standardDeductionAmount.amount === null) {
    blockers.push('2025 standard deduction cannot be determined: ' + standardDeductionAmount.blockers.join('; '))
  }
  if (standardDeductionAmount.amount === null && !standardDeductionReview.basicAmountUsableWithoutFurtherWorksheet) {
    blockers.push('Form 1040 line 12e standard deduction is illustrative only: ' + standardDeductionReview.reasons.join('; '))
  }
  const sourceDocumentReview = facts.sourceReview === undefined ? null :
    review2025SourceDocuments(facts.sourceReview, { w2: facts.w2.length, '1099int': facts.interest1099.length })
  if (!sourceDocumentReview) blockers.push('Income source document inventory has not been reviewed.')
  else {
    if (!sourceDocumentReview.completeInventory) blockers.push('Income source categories not reviewed: ' + sourceDocumentReview.missingCategories.join(', '))
    if (sourceDocumentReview.categoriesRequiringSeparateCalculation.length) blockers.push('Unmodeled income sources require separate calculations: ' + sourceDocumentReview.categoriesRequiringSeparateCalculation.join(', '))
  }
  if (facts.schedule1 === undefined) blockers.push('Schedule 1 has not been explicitly reviewed.')
  const schedule1A = facts.schedule1A === undefined ? null : stage2025Schedule1ACandidates(facts.schedule1A)
  const seniorDeduction = facts.seniorDeductionFacts === undefined ? null :
    calculate2025SeniorDeduction(facts.seniorDeductionFacts)
  const seniorFacts = facts.seniorDeductionFacts
  const seniorEvidenceReview = seniorDeduction === null || seniorFacts === undefined ? null :
    review2025SeniorEligibilityEvidence(facts.seniorEligibilityEvidence,
      seniorFacts.married,
      seniorFacts.spouseEligible)
  const schedule1AConsistency = review2025Schedule1AConsistency(schedule1A, seniorDeduction)
  if (!schedule1AConsistency.consistent) {
    blockers.push('Schedule 1-A consistency: ' + schedule1AConsistency.issues.join('; '))
  }
  if (seniorEvidenceReview && !seniorEvidenceReview.complete) {
    blockers.push('Senior deduction evidence: ' + seniorEvidenceReview.blockers.join('; '))
  }
  if (seniorDeduction && seniorFacts !== undefined && seniorFacts.filingStatus !== facts.filingStatus) {
    blockers.push('Senior deduction filing status differs from Form 1040 filing status.')
  }
  if (seniorDeduction && seniorDeduction.blockers.length) {
    blockers.push('Senior deduction review: ' + seniorDeduction.blockers.join('; '))
  }
  if (seniorDeduction && seniorDeduction.calculatedCandidate !== null && seniorDeduction.calculatedCandidate > 0) {
    blockers.push('Senior deduction is a candidate only; Schedule 1-A line 13b has not been verified.')
  }
  if (schedule1A === null) {
    blockers.push('Schedule 1-A has not been explicitly reviewed.')
  } else if (schedule1A.unverifiedCandidateTotal > 0) {
    blockers.push('Schedule 1-A candidate amounts require independent eligibility and limitation calculations; line 13b remains unavailable.')
  }
  // A computed tax on an illustrative taxable-income figure must not be
  // presented as a usable line 16, even if the tax rate/table lookup succeeds.
  // A missing Schedule 1 review or an unverified Schedule 1-A candidate changes
  // the possible tax base; an unreviewed standard deduction does likewise.
  const taxBaseReasons: string[] = []
  if (!schedule1AConsistency.consistent) taxBaseReasons.push('Schedule 1-A senior candidate and worksheet are inconsistent')
  if (standardDeductionAmount.amount !== draft.lines['12e']) {
    taxBaseReasons.push('draft standard deduction does not match the calculated 2025 amount')
  }
  if (standardDeductionAmount.amount === null) {
    taxBaseReasons.push('standard deduction eligibility or amount is unresolved')
  }
  if (facts.schedule1 === undefined) taxBaseReasons.push('Schedule 1 has not been reviewed')
  if (seniorDeduction && seniorFacts !== undefined && seniorFacts.filingStatus !== facts.filingStatus) {
    taxBaseReasons.push('senior deduction filing status conflicts with Form 1040')
  }
  if (seniorEvidenceReview && !seniorEvidenceReview.complete) {
    taxBaseReasons.push('senior deduction identity or residency evidence is unresolved')
  }
  if (seniorDeduction && seniorDeduction.blockers.length) {
    taxBaseReasons.push('senior deduction eligibility is unresolved')
  }
  if (seniorDeduction && seniorDeduction.calculatedCandidate !== null && seniorDeduction.calculatedCandidate > 0) {
    taxBaseReasons.push('senior Schedule 1-A deduction is not included in taxable income')
  }
  if (schedule1A === null) taxBaseReasons.push('Schedule 1-A has not been reviewed')
  else if (schedule1A.unverifiedCandidateTotal > 0) {
    taxBaseReasons.push('Schedule 1-A line 13b deduction has not been determined')
  }
  if (sourceDocumentReview === null || !sourceDocumentReview.completeInventory ||
      sourceDocumentReview.categoriesRequiringSeparateCalculation.length > 0) {
    taxBaseReasons.push('the complete income inventory and tax base are not confirmed')
  }
  if (taxBaseReasons.length) {
    draft.line16 = {
      kind: 'blocked', filingReady: false,
      reason: 'Taxable income is illustrative: ' + taxBaseReasons.join('; ') + '.',
    }
  }
  if (draft.line16.kind === 'blocked') blockers.push('Form 1040 line 16 is blocked: ' + draft.line16.reason)
  if (draft.line16.kind === 'unverified-import-candidate') blockers.push('Line 16 uses an unverified imported tax-table candidate.')

  let withholding: WithholdingBreakdown2025 | null = null
  if (facts.other1099Withholding === undefined || facts.otherWithholding === undefined) {
    blockers.push('Other 1099 withholding and other withholding must each be explicitly confirmed, including zero.')
  } else {
    withholding = summarize2025Withholding(facts.w2, facts.interest1099,
      facts.other1099Withholding, facts.otherWithholding)
  }

  const creditEvidenceReview = facts.creditEvidence === undefined ? null : review2025CreditEvidence(facts.creditEvidence)
  if (!creditEvidenceReview) blockers.push('Tax credit evidence has not been reviewed.')
  else if (!creditEvidenceReview.complete) blockers.push('Tax credit evidence incomplete: ' + creditEvidenceReview.blockers.join('; '))
  let reconciliation: Form1040Reconciliation2025 | null = null
  if (!facts.reconciliation) {
    blockers.push('Independent reconciliation inputs have not been provided.')
  } else if (!withholding) {
    blockers.push('Reconciliation is blocked until document withholding is fully confirmed.')
  } else {
    const input = attach2025Withholding(facts.reconciliation, withholding)
    // Never auto-fill line 16 from the restricted draft. It is not a verified tax determination.
    // Arithmetic inputs are independently supplied. Cross-check them against
    // reviewed credit worksheets before displaying a reconciliation.
    const creditLineMap = {
      'child-and-dependent': 'line19ChildOtherDependentCredit',
      'schedule3-nonrefundable': 'line20Schedule3NonrefundableCredits',
      'earned-income': 'line27aEarnedIncomeCredit',
      'additional-child': 'line28AdditionalChildTaxCredit',
      'american-opportunity': 'line29AmericanOpportunityCredit',
      'adoption-refundable': 'line30RefundableAdoptionCredit',
      'schedule3-refundable': 'line31Schedule3RefundableCredits',
    } as const
    if (creditEvidenceReview?.complete) {
      for (const kind of Object.keys(creditLineMap) as Array<keyof typeof creditLineMap>) {
        const key = creditLineMap[kind]
        if (input[key] !== creditEvidenceReview.amounts[kind]) {
          blockers.push('Credit worksheet mismatch: ' + kind + ' differs from reconciliation input ' + key)
        }
      }
    }
    reconciliation = reconcile2025Form1040Arithmetic(input)
    if (!reconciliation.completeArithmetic) blockers.push('Reconciliation missing: ' + reconciliation.missingInputs.join(', '))
    if (reconciliation.lines['35a'] === null || reconciliation.lines['36'] === null) {
      blockers.push('Refund and next-year estimated-tax elections are not both explicit.')
    }
  }
  return { year: 2025, filingReady: false, draft, standardDeductionReview, standardDeductionAmount, sourceDocumentReview, schedule1A, seniorDeduction, seniorEvidenceReview, schedule1AConsistency, withholding, creditEvidenceReview, reconciliation, blockers }
}
