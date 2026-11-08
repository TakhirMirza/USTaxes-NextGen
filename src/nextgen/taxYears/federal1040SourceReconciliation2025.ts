/** Development-only 2025 cross-check: draft documents -> source integrity -> restricted Form 1040 mapping.
 * No liability computation, filing authorization, personal data export or inferred eligibility.
 */
import type { DraftWorkspace } from '../navigation/draftWorkspace'
import { reviewFederalSources2025 } from './federalSourceIntegrity2025'
import { map2025SourcesTo1040 } from './taxEngineCore2025'
import type { FilingStatus2025 } from './preview2025'

export type ReconciliationIssue2025 = { code: string; severity: 'blocked' | 'warning'; message: string }
export type Reconciliation2025 = {
  year: '2025'; status: 'blocked' | 'matched'; filingReady: false
  lines: Record<'1a' | '2b' | '9' | '11a' | '15' | '25a' | '25d', number | null>
  issues: ReconciliationIssue2025[]
  checks: { id: string; passed: boolean }[]
}
const filingStatus: Record<string, FilingStatus2025> = {
  single: 'single', joint: 'marriedJoint', separate: 'marriedSeparate',
  head: 'headOfHousehold', survivor: 'qualifyingSurvivingSpouse'
}
const cents = (amount: number | null): number | null => amount === null ? null : Number.isSafeInteger(Math.round(amount * 100)) && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6 ? Math.round(amount * 100) : null

export function reconcile2025DraftTo1040(draft: DraftWorkspace): Reconciliation2025 {
  const issues: ReconciliationIssue2025[] = []
  const block = (code: string, message: string) => issues.push({ code, severity: 'blocked', message })
  const warn = (code: string, message: string) => issues.push({ code, severity: 'warning', message })
  const integrity = reviewFederalSources2025(draft)
  integrity.findings.filter(f => f.severity === 'error').forEach(f => block(`SOURCE_${f.code}`, f.message))
  integrity.findings.filter(f => f.severity === 'warning').forEach(f => warn(`SOURCE_${f.code}`, f.message))
  if (draft.year !== '2025') block('UNSUPPORTED_YEAR', 'Only 2025 source-to-1040 reconciliation is supported.')
  if (!filingStatus[draft.filingStatus]) block('INVALID_STATUS', 'Unsupported filing status.')
  if (draft.hasDependents !== 'no') block('DEPENDENT_SCOPE', 'Dependents must be independently reviewed; this limited bridge does not support them.')
  if (draft.deduction !== 'standard') block('DEDUCTION_SCOPE', 'Only the basic standard deduction is supported by this bridge.')
  if (!draft.incomeKinds.every(k => k === 'W-2 wages' || k === '1099-INT interest')) block('INCOME_SCOPE', 'Other income categories require additional schedules and cannot be silently omitted.')
  if (!draft.basicDeductionConfirmed || !draft.noOtherItemsConfirmed || !draft.ordinaryTaxMethodConfirmed) block('UNVERIFIED_FACTS', 'Required eligibility, other-item and tax-method confirmations are incomplete.')
  const w2Selected = draft.incomeKinds.includes('W-2 wages')
  const intSelected = draft.incomeKinds.includes('1099-INT interest')
  const mapped = map2025SourcesTo1040({
    year: Number(draft.year), filingStatus: filingStatus[draft.filingStatus] || 'single',
    w2: w2Selected ? draft.wages.map(w => ({ id: String(w.id), employer: w.employer, box1: w.wages, box2: w.withholding })) : [],
    interest: intSelected ? [{ id: 'draft-interest-1', payer: draft.payer, box1: draft.interest }] : [],
    standardDeductionFactsConfirmed: draft.basicDeductionConfirmed,
    taxpayerUnder65AndNotBlind: false, spouseUnder65AndNotBlind: false,
    notClaimableAsDependent: false, noOtherIncomeAdjustmentsCreditsOrTaxes: draft.noOtherItemsConfirmed
  })
  // The draft does not collect age, blindness, or claimability facts. Mapping remains blocked
  // until those facts are explicitly modeled, rather than interpreting a checkbox as proof.
  mapped.blockers.forEach((message, i) => block(`MAPPING_${i + 1}`, message))
  const expected = integrity.totals
  const checks = [
    { id: 'W2_1A', passed: mapped.status === 'mapped' && cents(mapped.lines['1a']) === (expected.wagesCents ?? 0) },
    { id: 'INTEREST_2B', passed: mapped.status === 'mapped' && cents(mapped.lines['2b']) === (expected.interestCents ?? 0) },
    { id: 'WITHHOLDING_25A', passed: mapped.status === 'mapped' && cents(mapped.lines['25a']) === (expected.withholdingCents ?? 0) },
    { id: 'WITHHOLDING_25D', passed: mapped.status === 'mapped' && cents(mapped.lines['25d']) === cents(mapped.lines['25a']) },
    { id: 'TOTAL_INCOME_9', passed: mapped.status === 'mapped' && cents(mapped.lines['9']) === (expected.wagesCents ?? 0) + (expected.interestCents ?? 0) },
    { id: 'AGI_11A', passed: mapped.status === 'mapped' && cents(mapped.lines['11a']) === cents(mapped.lines['9']) }
  ]
  checks.filter(c => !c.passed).forEach(c => block(`CHECK_${c.id}`, `Source-to-1040 cross-check ${c.id} is not established.`))
  const status = issues.some(i => i.severity === 'blocked') ? 'blocked' : 'matched'
  return { year: '2025', status, filingReady: false, issues, checks,
    lines: { '1a': status === 'matched' ? mapped.lines['1a'] : null,
      '2b': status === 'matched' ? mapped.lines['2b'] : null,
      '9': status === 'matched' ? mapped.lines['9'] : null,
      '11a': status === 'matched' ? mapped.lines['11a'] : null,
      '15': status === 'matched' ? mapped.lines['15'] : null,
      '25a': status === 'matched' ? mapped.lines['25a'] : null,
      '25d': status === 'matched' ? mapped.lines['25d'] : null } }
}
/** No names, monetary values, source identifiers or other draft PII in this diagnostic export. */
export function reconciliationCsv2025(report: Reconciliation2025): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`
  return [['type','code','result'].map(q).join(','),
    ...report.checks.map(c => ['check', c.id, c.passed ? 'pass' : 'blocked'].map(q).join(',')),
    ...report.issues.map(i => ['issue', i.code, i.severity].map(q).join(','))].join('\r\n') + '\r\n'
}
