import type { DraftWorkspace } from '../navigation/draftWorkspace'

export type IntegrityFinding2025 = {
  code: string
  severity: 'error' | 'warning' | 'info'
  source: 'profile' | 'income' | 'deductions' | 'review'
  message: string
}
export type IntegrityReport2025 = {
  taxYear: string
  scope: 'fictional-development-preview'
  filingReady: false
  totals: { wagesCents: number | null; withholdingCents: number | null; interestCents: number | null }
  findings: IntegrityFinding2025[]
}

/** Parse nonnegative dollar strings into integer cents; never silently round excess precision. */
export function parseCents2025(input: string): number | null {
  const value = input.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

/** Cross-document integrity only. This module does not calculate or certify tax liability. */
export function reviewFederalSources2025(draft: DraftWorkspace): IntegrityReport2025 {
  const findings: IntegrityFinding2025[] = []
  const add = (code: string, severity: IntegrityFinding2025['severity'], source: IntegrityFinding2025['source'], message: string): void => {
    findings.push({ code, severity, source, message })
  }
  if (draft.year !== '2025') add('YEAR_UNSUPPORTED', 'error', 'profile', 'Only tax year 2025 has development-preview rules.')
  if (draft.incomeKinds.length === 0) add('INCOME_SELECTION_EMPTY', 'warning', 'income', 'No income category has been selected; verify that this is intentional.')
  if (new Set(draft.incomeKinds).size !== draft.incomeKinds.length) add('INCOME_SELECTION_DUPLICATE', 'error', 'income', 'Income category selection contains duplicates.')
  if (new Set(draft.wages.map(w => w.id)).size !== draft.wages.length) add('W2_DUPLICATE_ID', 'error', 'income', 'W-2 entries contain duplicate internal identifiers.')
  if (!draft.incomeKinds.includes('W-2 wages') && draft.wages.some(w => w.employer.trim() || w.wages.trim() || w.withholding.trim())) add('W2_NOT_SELECTED', 'warning', 'income', 'W-2 entries contain data, but W-2 wages are not selected.')
  if (!draft.incomeKinds.includes('1099-INT interest') && (draft.interest.trim() || draft.payer.trim())) add('INTEREST_NOT_SELECTED', 'warning', 'income', '1099-INT fields contain data, but interest income is not selected.')
  if (draft.hasDependents === 'unknown') add('DEPENDENTS_UNREVIEWED', 'warning', 'profile', 'Dependent status has not been reviewed.')
  if (draft.hasDependents === 'yes') add('DEPENDENTS_UNSUPPORTED', 'error', 'profile', 'Dependent-related tax rules are not supported.')
  if (draft.deduction !== 'standard' || !draft.basicDeductionConfirmed) add('DEDUCTION_UNVERIFIED', 'warning', 'deductions', 'Standard deduction eligibility is not independently established.')
  const wageSelected = draft.incomeKinds.includes('W-2 wages')
  const interestSelected = draft.incomeKinds.includes('1099-INT interest')
  let wagesCents: number | null = wageSelected ? 0 : null
  let withholdingCents: number | null = wageSelected ? 0 : null
  if (wageSelected && draft.wages.length === 0) {
    add('W2_MISSING', 'error', 'income', 'W-2 income is selected, but no W-2 entries exist.')
    wagesCents = null; withholdingCents = null
  }
  if (wageSelected) draft.wages.forEach((w, index) => {
    const label = `W-2 #${index + 1}`
    const amount = parseCents2025(w.wages)
    const withheld = parseCents2025(w.withholding)
    if (!w.employer.trim()) add(`W2_${index + 1}_EMPLOYER`, 'error', 'income', `${label}: employer label is missing.`)
    if (amount === null) add(`W2_${index + 1}_WAGES`, 'error', 'income', `${label}: Box 1 must contain a valid nonnegative amount with at most two decimals.`)
    if (withheld === null) add(`W2_${index + 1}_WITHHOLDING`, 'error', 'income', `${label}: Box 2 must contain a valid nonnegative amount with at most two decimals.`)
    if (amount === 0 && withheld !== null && withheld > 0) add(`W2_${index + 1}_ZERO_WAGES`, 'warning', 'income', `${label}: withholding is present but Box 1 wages are zero.`)
    if (amount !== null && withheld !== null && withheld > amount) add(`W2_${index + 1}_HIGH_WITHHOLDING`, 'warning', 'income', `${label}: Box 2 exceeds Box 1; verify against the original document.`)
    if (wagesCents !== null) wagesCents = amount === null || !Number.isSafeInteger(wagesCents + amount) ? null : wagesCents + amount
    if (withholdingCents !== null) withholdingCents = withheld === null || !Number.isSafeInteger(withholdingCents + withheld) ? null : withholdingCents + withheld
  })
  let interestCents: number | null = null
  if (interestSelected) {
    interestCents = parseCents2025(draft.interest)
    if (interestCents === null) add('INTEREST_INVALID', 'error', 'income', '1099-INT Box 1 is missing or invalid.')
    if (!draft.payer.trim()) add('INTEREST_PAYER_MISSING', 'warning', 'income', '1099-INT payer label is missing.')
  }
  const unsupported = draft.incomeKinds.filter(kind => kind !== 'W-2 wages' && kind !== '1099-INT interest')
  if (unsupported.length) add('UNSUPPORTED_INCOME', 'error', 'income', `${unsupported.length} selected income category/categories require additional tax modules.`)
  if (!draft.noOtherItemsConfirmed) add('OTHER_ITEMS_UNREVIEWED', 'warning', 'review', 'Additional income, adjustments, credits and taxes have not been ruled out.')
  if (!draft.ordinaryTaxMethodConfirmed) add('TAX_METHOD_UNREVIEWED', 'warning', 'review', 'Special federal tax computation methods have not been ruled out.')
  add('FILING_DISABLED', 'info', 'review', 'This is a fictional-data development preview. PDF filing and e-file are disabled.')
  return { taxYear: draft.year, scope: 'fictional-development-preview', filingReady: false, totals: { wagesCents, withholdingCents, interestCents }, findings }
}

/** Diagnostic CSV intentionally excludes amounts, employer names and payer names. */
export function federalSourceIntegrityCsv2025(report: IntegrityReport2025): string {
  const quote = (s: string): string => `"${s.replace(/"/g, '""')}"`
  return [['code', 'severity', 'source', 'message'].map(quote).join(','), ...report.findings.map(f => [f.code, f.severity, f.source, f.message].map(quote).join(','))].join('\r\n') + '\r\n'
}
