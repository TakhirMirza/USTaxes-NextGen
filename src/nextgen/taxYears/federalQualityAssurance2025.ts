import { auditFederalCalculationIntegrity2025, IntegrityInput2025 } from './federalCalculationIntegrity2025'
import { buildFederalExceptionRegister2025 } from './federalExceptionRegister2025'

export type QaCheck2025 = { id: string; status: 'pass' | 'fail' | 'unverified'; description: string; detail: string }
export type QaReport2025 = { checks: QaCheck2025[]; passed: number; failed: number; unverified: number; filingReady: false }
/** Read-only quality gate. Synthetic mutation tests must never alter the user's scenario. */
export function runFederalQualityAssurance2025(input: IntegrityInput2025): QaReport2025 {
  const integrity = auditFederalCalculationIntegrity2025(input)
  const exceptions = buildFederalExceptionRegister2025(input)
  const checks: QaCheck2025[] = []
  const add = (id: string, status: QaCheck2025['status'], description: string, detail: string) => checks.push({id,status,description,detail})
  add('YEAR_2025',input.year === 2025 ? 'pass':'fail','Supported tax year',input.year === 2025 ? '2025 source model selected.':'This diagnostic suite supports 2025 only.')
  add('SOURCE_INTEGRITY',integrity.blocked === 0 ? 'pass':'fail','Source-to-1040 consistency',`${integrity.blocked} blocking source findings; ${integrity.reviewed} review notices.`)
  add('EXCEPTION_REGISTER',exceptions.counts.blocker === 0 ? 'pass':'fail','Exception register reconciliation',`${exceptions.counts.blocker} blockers, ${exceptions.counts.coverage} coverage gaps, ${exceptions.counts.review} review notices.`)
  const baselineIds = new Set(integrity.issues.map(i=>i.id))
  const wagesPresent = input.wageEntries.some(w=>w.employer.trim() || w.wages.trim() || w.withholding.trim())
  if (wagesPresent && input.mappedWagesDollars !== null && Number.isFinite(input.mappedWagesDollars)) {
    const mutated = auditFederalCalculationIntegrity2025({...input,mappedWagesDollars:input.mappedWagesDollars + 1})
    const detected = mutated.issues.some(i=>i.id === 'WAGES_MISMATCH' && !baselineIds.has(i.id))
    add('MUTATION_WAGES',detected?'pass':'fail','Synthetic wage mismatch detection',detected?'A $1 discrepancy in an isolated test copy was detected.':'Mismatch detector did not produce a new wage finding; inspect existing source errors.')
  } else add('MUTATION_WAGES','unverified','Synthetic wage mismatch detection','Requires valid, selected W-2 wages and a mapped line 1a.')
  if (input.interestSelected && input.mappedInterestDollars !== null && Number.isFinite(input.mappedInterestDollars)) {
    const mutated = auditFederalCalculationIntegrity2025({...input,mappedInterestDollars:input.mappedInterestDollars + 1})
    const detected = mutated.issues.some(i=>i.id === 'INTEREST_MISMATCH' && !baselineIds.has(i.id))
    add('MUTATION_INTEREST',detected?'pass':'fail','Synthetic interest mismatch detection',detected?'A $1 discrepancy in an isolated test copy was detected.':'Mismatch detector did not produce a new interest finding; inspect existing source errors.')
  } else add('MUTATION_INTEREST','unverified','Synthetic interest mismatch detection','Requires selected 1099-INT and a mapped line 2b.')
  add('IRS_RULES','unverified','Independent IRS 2025 rule verification','Tax tables, filing status, deductions, credits and special tax methods are not certified by these tests.')
  add('PAYMENT_RECONCILIATION','unverified','Complete payment reconciliation','Line 25a withholding and all other payments are not independently mapped in this diagnostic input.')
  add('FILING_AUTHORIZATION','unverified','Submission authorization','No e-file, certified return, or filing authorization is implemented.')
  return {checks,passed:checks.filter(c=>c.status==='pass').length,failed:checks.filter(c=>c.status==='fail').length,unverified:checks.filter(c=>c.status==='unverified').length,filingReady:false}
}
export function federalQaCsv2025(report: QaReport2025): string {
 const quote=(s:string)=>`"${s.replace(/"/g,'""')}"`
 return [['Check','Status','Description','Detail'],...report.checks.map(c=>[c.id,c.status,c.description,c.detail])].map(row=>row.map(quote).join(',')).join('\r\n')
}
