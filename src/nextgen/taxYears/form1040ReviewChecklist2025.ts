/** Independent review checklist. This is NOT a filing eligibility certification. */
import { Form1040PipelineResult2025 } from './form1040Pipeline2025'

export type ReviewCheck2025 = {
  id: string
  label: string
  status: 'reviewed' | 'blocked'
  explanation: string
}

export function get2025ReviewChecklist(result: Form1040PipelineResult2025): ReviewCheck2025[] {
  const hasSchedule1A = result.schedule1A !== null
  const schedule1ACandidates = result.schedule1A?.unverifiedCandidateTotal || 0
  const taxDetermined = result.draft.line16.kind === 'ordinary-worksheet'
  // Published sample cells are reference examples, not a complete tax determination.
  const arithmetic = result.reconciliation?.completeArithmetic === true
  const elections = result.reconciliation.lines['35a'] !== null &&
    result.reconciliation.lines['35a'] !== undefined &&
    result.reconciliation.lines['36'] !== null &&
    result.reconciliation.lines['36'] !== undefined
  return [
    { id: 'schedule1', label: 'Schedule 1 review', status: result.blockers.some(x => x.includes('Schedule 1 has not been explicitly reviewed')) ? 'blocked' : 'reviewed', explanation: 'Explicit review of other income and adjustments; not proof of tax-law completeness.' },
    { id: 'schedule1a', label: 'Schedule 1-A review', status: hasSchedule1A && schedule1ACandidates === 0 ? 'reviewed' : 'blocked', explanation: !hasSchedule1A ? 'Not reviewed.' : schedule1ACandidates ? 'Candidate deductions require eligibility and phaseout calculations.' : 'No candidate deductions were reported; not an eligibility certification.' },
    { id: 'withholding', label: 'Withholding reconciliation', status: result.withholding ? 'reviewed' : 'blocked', explanation: 'W-2 and 1099 amounts must be reconciled to all source documents.' },
    { id: 'line16', label: 'Line 16 calculation', status: taxDetermined ? 'reviewed' : 'blocked', explanation: 'Only the restricted ordinary worksheet is counted as reviewed; published sample cells and imported candidates are not a completed tax determination.' },
    { id: 'arithmetic', label: 'Form 1040 arithmetic', status: arithmetic ? 'reviewed' : 'blocked', explanation: 'Arithmetic completion does not verify underlying tax facts.' },
    { id: 'elections', label: 'Refund and estimated-tax elections', status: elections ? 'reviewed' : 'blocked', explanation: 'Both elections must be explicitly entered, including zero.' },
    { id: 'filing', label: 'Filing authorization', status: 'blocked', explanation: 'Official IRS data, comprehensive eligibility rules, PDF and e-file are not validated.' },
  ]
}
