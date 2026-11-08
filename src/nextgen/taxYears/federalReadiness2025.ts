/** Conservative, non-filing 2025 workflow readiness assessment. No tax amounts are computed here. */
export type ReadinessArea2025 = 'profile' | 'income' | 'deductions' | 'review'
export type ReadinessFinding2025 = { id: string; area: ReadinessArea2025; severity: 'blocker' | 'review'; title: string; action: string }
export type ReadinessInput2025 = {
  year: string; filingStatus: string; hasDependents: string; deduction: string
  profileUnresolved: string[]; simplifiedDeductionEligible: boolean
  incomeKinds: string[]; wageEntriesValid: boolean; interestValid: boolean
  basicDeductionConfirmed: boolean; noOtherItemsConfirmed: boolean
  sourceIssueCount: number; reconciliationIssueCount: number
}
const supported = new Set(['W-2 wages', '1099-INT interest'])
export function assessFederalReadiness2025(v: ReadinessInput2025): ReadinessFinding2025[] {
  const issues: ReadinessFinding2025[] = []
  const add = (id: string, area: ReadinessArea2025, severity: 'blocker' | 'review', title: string, action: string) => issues.push({ id, area, severity, title, action })
  if (v.year !== '2025') add('year', 'profile', 'blocker', 'Tax year is not supported', 'Select 2025; future years need separately verified IRS rules.')
  if (!['single', 'joint', 'separate', 'head', 'survivor'].includes(v.filingStatus)) add('status', 'profile', 'blocker', 'Filing status is invalid', 'Review filing status.')
  if (v.filingStatus === 'head' || v.filingStatus === 'survivor') add('complex-status', 'profile', 'blocker', 'Filing status needs additional eligibility verification', 'Head of household and qualifying surviving spouse eligibility are not automated.')
  if (v.hasDependents !== 'no') add('dependents', 'profile', 'blocker', 'Dependents require review', 'Complete dependent eligibility and credit rules; unknown cannot be assumed no.')
  for (const [i, detail] of v.profileUnresolved.entries()) add(`profile-${i}`, 'profile', 'blocker', detail, 'Answer all relevant age, blindness, and dependent-claimability questions.')
  if (!v.incomeKinds.length) add('income-selection', 'income', 'review', 'No income source selected', 'Confirm whether a return is required and whether income is missing.')
  for (const kind of v.incomeKinds.filter(k => !supported.has(k))) add(`unsupported-${kind}`, 'income', 'blocker', `${kind} is not supported by simplified mapping`, 'Use a separately verified form-specific workflow before including this source.')
  if (v.incomeKinds.includes('W-2 wages') && !v.wageEntriesValid) add('w2', 'income', 'blocker', 'W-2 source is incomplete or invalid', 'Review every employer label, wages and withholding amount.')
  if (v.incomeKinds.includes('1099-INT interest') && !v.interestValid) add('interest', 'income', 'blocker', '1099-INT taxable interest is invalid', 'Enter a nonnegative amount with at most two decimal places.')
  if (v.sourceIssueCount > 0) add('source-audit', 'income', 'blocker', 'Source validation has unresolved findings', 'Open the Source Integrity section of Review.')
  if (v.deduction !== 'standard') add('deduction-choice', 'deductions', 'blocker', 'Simplified standard deduction is not selected', 'Itemized and unknown deductions require separate verified calculations.')
  if (!v.simplifiedDeductionEligible) add('deduction-facts', 'deductions', 'blocker', 'Simplified standard deduction facts are not established', 'Review age, blindness and dependent claimability; do not infer eligibility.')
  if (!v.basicDeductionConfirmed) add('deduction-confirmation', 'deductions', 'blocker', 'Deduction review is not confirmed', 'Complete the deduction review after checking the facts.')
  if (!v.noOtherItemsConfirmed) add('scope-confirmation', 'review', 'blocker', 'Restricted return scope is not confirmed', 'Verify no additional income, adjustments, credits or taxes apply.')
  if (v.reconciliationIssueCount > 0) add('reconciliation', 'review', 'blocker', 'Form 1040 source reconciliation has findings', 'Review source-to-line mapping before relying on any preview.')
  add('filing-disabled', 'review', 'blocker', 'Filing is not implemented', 'Identity verification, secure storage, full IRS calculations, PDF and e-file require separate development.')
  return issues
}
export function federalReadinessCsv2025(findings: ReadinessFinding2025[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""').replace(/[\r\n]/g, ' ')}"`
  return ['id,area,severity,title,action', ...findings.map(f => [f.id, f.area, f.severity, f.title, f.action].map(esc).join(','))].join('\n')
}
