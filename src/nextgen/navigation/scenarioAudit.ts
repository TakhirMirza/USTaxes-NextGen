import type { DraftWorkspace } from './draftWorkspace'
import { assessScenarioQuality } from './scenarioQuality'

/** Privacy-conscious, deterministic audit of a fictional development scenario.
 * Never includes employer/payer names, amounts, or personal identifiers.
 */
export type ScenarioAudit = {
  schema: 'nextgen-scenario-audit-v1'
  taxYear: string
  readiness: 'blocked' | 'review-required'
  filingEnabled: false
  summary: { errors: number; warnings: number; information: number }
  coverage: { incomeCategoriesSelected: number; w2Count: number; interestSelected: boolean; deductionsReviewed: boolean; dependentsReviewed: boolean }
  findings: ReturnType<typeof assessScenarioQuality>
}

export function createScenarioAudit(draft: DraftWorkspace): ScenarioAudit {
  const findings = assessScenarioQuality(draft)
  return {
    schema: 'nextgen-scenario-audit-v1',
    taxYear: draft.year,
    readiness: findings.some(f => f.severity === 'error') ? 'blocked' : 'review-required',
    filingEnabled: false,
    summary: {
      errors: findings.filter(f => f.severity === 'error').length,
      warnings: findings.filter(f => f.severity === 'warning').length,
      information: findings.filter(f => f.severity === 'info').length
    },
    coverage: {
      incomeCategoriesSelected: draft.incomeKinds.length,
      w2Count: draft.incomeKinds.includes('W-2 wages') ? draft.wages.length : 0,
      interestSelected: draft.incomeKinds.includes('1099-INT interest'),
      deductionsReviewed: draft.deduction !== 'unknown',
      dependentsReviewed: draft.hasDependents !== 'unknown'
    },
    findings
  }
}

export function scenarioAuditCsv(audit: ScenarioAudit): string {
  const cell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`
  return [
    ['severity', 'code', 'step', 'message'].map(cell).join(','),
    ...audit.findings.map(f => [f.severity, f.code, f.step, f.message].map(cell).join(','))
  ].join('\r\n') + '\r\n'
}
