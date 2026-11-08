import { DraftWorkspace } from './draftWorkspace'

export type ScenarioFinding = { code: string; severity: 'error' | 'warning' | 'info'; message: string; step: 'profile' | 'income' | 'deductions' | 'review' }
const validMoney = (value: string): boolean => /^\d+(?:\.\d{1,2})?$/.test(value.trim()) && Number.isSafeInteger(Math.round(Number(value) * 100))

/** Preview-only diagnostics: a clean scenario is never a filing authorization. */
export function assessScenarioQuality(draft: DraftWorkspace): ScenarioFinding[] {
  const issues: ScenarioFinding[] = []
  const add = (code: string, severity: ScenarioFinding['severity'], message: string, step: ScenarioFinding['step']) => issues.push({ code, severity, message, step })
  if (draft.year !== '2025') add('YEAR_UNSUPPORTED', 'error', `Tax year ${draft.year} has no validated computation rules.`, 'profile')
  if (draft.hasDependents === 'unknown') add('DEPENDENTS_UNREVIEWED', 'warning', 'Dependent status has not been reviewed.', 'profile')
  if (draft.hasDependents === 'yes') add('DEPENDENTS_UNSUPPORTED', 'error', 'Dependent eligibility and associated credits are not implemented.', 'profile')
  if (draft.incomeKinds.length === 0) add('INCOME_UNSELECTED', 'warning', 'No income categories have been selected; confirm whether this is intentional.', 'income')
  if (draft.incomeKinds.includes('W-2 wages')) {
    if (!draft.wages.length) add('W2_MISSING', 'error', 'W-2 is selected but no W-2 records exist.', 'income')
    draft.wages.forEach((w, i) => {
      if (!w.employer.trim()) add(`W2_${i + 1}_EMPLOYER`, 'error', `W-2 #${i + 1}: employer label is missing.`, 'income')
      if (!validMoney(w.wages)) add(`W2_${i + 1}_WAGES`, 'error', `W-2 #${i + 1}: wages must be a nonnegative dollar amount with at most two decimals.`, 'income')
      if (!validMoney(w.withholding)) add(`W2_${i + 1}_WITHHOLDING`, 'error', `W-2 #${i + 1}: withholding must be a nonnegative dollar amount with at most two decimals.`, 'income')
      if (validMoney(w.wages) && validMoney(w.withholding) && Number(w.withholding) > Number(w.wages)) add(`W2_${i + 1}_WITHHOLDING_REVIEW`, 'warning', `W-2 #${i + 1}: withholding exceeds wages; verify the source document.`, 'income')
    })
  }
  if (draft.incomeKinds.includes('1099-INT interest')) {
    if (!validMoney(draft.interest)) add('INTEREST_INVALID', 'error', '1099-INT taxable interest is missing or invalid.', 'income')
    if (!draft.payer.trim()) add('INTEREST_PAYER', 'warning', '1099-INT payer label is missing.', 'income')
  }
  const supported = new Set(['W-2 wages', '1099-INT interest'])
  draft.incomeKinds.filter(kind => !supported.has(kind)).forEach(kind => add(`UNSUPPORTED_${kind}`, 'error', `${kind} is not fully supported by the restricted tax engine.`, 'income'))
  if (draft.deduction === 'unknown') add('DEDUCTION_UNREVIEWED', 'warning', 'Deduction selection has not been reviewed.', 'deductions')
  if (draft.deduction === 'itemized') add('ITEMIZED_UNSUPPORTED', 'error', 'Schedule A itemized deductions are not fully implemented.', 'deductions')
  if (draft.deduction === 'standard' && !draft.basicDeductionConfirmed) add('STANDARD_UNCONFIRMED', 'warning', 'Standard deduction eligibility has not been independently confirmed.', 'deductions')
  if (!draft.noOtherItemsConfirmed) add('OTHER_ITEMS_UNREVIEWED', 'warning', 'Other income, adjustments, credits and taxes have not been ruled out.', 'review')
  if (!draft.ordinaryTaxMethodConfirmed) add('TAX_METHOD_UNREVIEWED', 'warning', 'Special tax computation methods have not been ruled out.', 'review')
  add('FILING_DISABLED', 'info', 'This is a development preview. Secure storage, verified form generation and IRS filing are not available.', 'review')
  return issues
}
