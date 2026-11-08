import type { DraftWorkspace } from '../navigation/draftWorkspace'

export type CoverageItem2025 = {
  id: string
  title: string
  status: 'preview' | 'blocked' | 'not-implemented'
  step: 'profile' | 'income' | 'deductions' | 'review'
  detail: string
}
/** A capability inventory, NOT a determination that a tax return can be filed. */
export function buildFederalCoverageMatrix2025(draft: DraftWorkspace): CoverageItem2025[] {
  const previewYear = draft.year === '2025'
  const income = draft.incomeKinds
  const item = (id: string, title: string, status: CoverageItem2025['status'], step: CoverageItem2025['step'], detail: string): CoverageItem2025 => ({ id, title, status, step, detail })
  return [
    item('year', 'Tax year rule set', previewYear ? 'preview' : 'blocked', 'profile', previewYear ? '2025 restricted calculation rules only.' : `No validated federal rules for ${draft.year}.`),
    item('identity', 'Taxpayer identity and filing status', 'blocked', 'profile', 'Filing status can be selected; eligibility, identity, residency and signatures are not verified.'),
    item('dependents', 'Dependents and related credits', 'not-implemented', 'profile', 'Dependent eligibility and dependent-related credits require independent implementation.'),
    item('w2', 'Form W-2 wages and withholding', previewYear && income.includes('W-2 wages') ? 'preview' : 'blocked', 'income', 'Restricted Box 1 / Box 2 mapping; not a full W-2 validation.'),
    item('interest', 'Form 1099-INT taxable interest', previewYear && income.includes('1099-INT interest') ? 'preview' : 'blocked', 'income', 'Restricted Box 1 taxable interest only; other 1099-INT boxes are not covered.'),
    item('dividends', 'Form 1099-DIV and qualified dividends', 'not-implemented', 'income', 'Dividend classifications and preferential tax methods are not implemented.'),
    item('capital', 'Capital gains / Schedule D', 'not-implemented', 'income', 'Basis, holding period, adjustments and special tax methods are not implemented.'),
    item('business', 'Self-employment / Schedules C and SE', 'not-implemented', 'income', 'Business expenses, net profit and self-employment tax are not implemented.'),
    item('retirement', 'Retirement and Social Security income', 'not-implemented', 'income', 'Taxable distribution and benefit calculations are not implemented.'),
    item('rental', 'Rental / Schedule E', 'not-implemented', 'income', 'Rental income, depreciation and passive activity rules are not implemented.'),
    item('schedule1', 'Schedule 1 additional income and adjustments', 'blocked', 'income', 'Candidate worksheet exists; eligibility and authoritative posting remain gated.'),
    item('deduction', 'Standard deduction', previewYear && draft.deduction === 'standard' && draft.basicDeductionConfirmed ? 'preview' : 'blocked', 'deductions', 'Restricted standard deduction scenario only; eligibility requires independent verification.'),
    item('scheduleA', 'Schedule A itemized deductions', 'not-implemented', 'deductions', 'Substantiation, limits and election rules are not implemented.'),
    item('schedule2', 'Schedule 2 additional taxes', 'blocked', 'review', 'Candidate review exists; additional tax calculation is not authoritative.'),
    item('schedule3', 'Schedule 3 credits and payments', 'blocked', 'review', 'Candidate review exists; credit eligibility and payment ordering are not authoritative.'),
    item('1040', 'Form 1040 complete line calculation', 'blocked', 'review', 'Partial source mapping and reconciliation; complete lines 1–37 not verified.'),
    item('tax', 'Form 1040 line 16 tax', 'blocked', 'review', 'Restricted worksheet preview; tax table and special methods need validation.'),
    item('refund', 'Refund or amount owed', 'blocked', 'review', 'No final refund or balance may be represented as verified.'),
    item('filing', 'PDF filing and IRS e-file', 'not-implemented', 'review', 'Production filing, signatures, identity verification and secure handling are disabled.')
  ]
}

export function federalCoverageCsv2025(items: CoverageItem2025[]): string {
  const csv = (v: string): string => `"${v.replace(/"/g, '""')}"`
  return [['id', 'title', 'status', 'step', 'detail'].map(csv).join(','), ...items.map(i => [i.id, i.title, i.status, i.step, i.detail].map(csv).join(','))].join('\r\n') + '\r\n'
}
