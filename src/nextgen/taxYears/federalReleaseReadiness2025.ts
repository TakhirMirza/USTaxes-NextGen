import { IntegrityInput2025 } from './federalCalculationIntegrity2025'
import { runFederalQualityAssurance2025 } from './federalQualityAssurance2025'
import { buildFederalExceptionRegister2025 } from './federalExceptionRegister2025'

export type ReleaseFinding2025 = { id:string; category:'source'|'validation'|'tax-rule'|'payment'|'security'|'submission'; severity:'blocker'|'unverified'; message:string; action:string }
export type ReleaseReadiness2025 = { year:number; status:'NOT_READY'; findings:ReleaseFinding2025[]; qaPassed:number; qaFailed:number; qaUnverified:number; generatedAt:string }
/** Strict fail-closed release gate: never infer approval from passing technical tests. */
export function evaluateFederalReleaseReadiness2025(input:IntegrityInput2025):ReleaseReadiness2025 {
 const qa=runFederalQualityAssurance2025(input)
 const exceptions=buildFederalExceptionRegister2025(input)
 const findings:ReleaseFinding2025[]=[]
 const add=(id:string,category:ReleaseFinding2025['category'],severity:ReleaseFinding2025['severity'],message:string,action:string)=>findings.push({id,category,severity,message,action})
 if(input.year!==2025) add('UNSUPPORTED_YEAR','tax-rule','blocker','This release gate supports tax year 2025 only.','Select a supported tax-year engine.')
 if(qa.failed) add('QA_FAILURES','validation','blocker',`${qa.failed} QA checks failed.`,'Resolve failed QA checks in Review.')
 if(exceptions.counts.blocker) add('SOURCE_BLOCKERS','source','blocker',`${exceptions.counts.blocker} source reconciliation blockers remain.`,'Reconcile income documents and Form 1040 sources.')
 if(exceptions.counts.coverage) add('COVERAGE_GAPS','source','unverified',`${exceptions.counts.coverage} document coverage gaps remain.`,'Review missing document and schedule coverage.')
 if(qa.unverified) add('QA_UNVERIFIED','validation','unverified',`${qa.unverified} QA checks are unverified.`,'Complete independent checks and rerun diagnostics.')
 add('IRS_RULE_VERIFICATION','tax-rule','unverified','2025 IRS tax calculations, tables, credits, and special methods are not independently certified.','Verify applicable official IRS instructions and tax rules.')
 add('PAYMENT_MAPPING','payment','blocker','Independent reconciliation of all withholding and payments is incomplete.','Map and reconcile Form 1040 lines 25–33 with authoritative sources.')
 add('PRIVACY_SECURITY','security','blocker','No verified production security/privacy controls for sensitive taxpayer data.','Complete security assessment and protect all taxpayer information before production use.')
 add('IRS_SUBMISSION','submission','blocker','No approved IRS e-file integration or filing authorization.','Do not submit or present the return as filing-ready.')
 return {year:input.year,status:'NOT_READY',findings,qaPassed:qa.passed,qaFailed:qa.failed,qaUnverified:qa.unverified,generatedAt:new Date().toISOString()}
}
export function releaseReadinessCsv2025(report:ReleaseReadiness2025):string {
 const q=(s:string)=>`"${s.replace(/"/g,'""')}"`
 return [['Finding ID','Category','Severity','Description','Required action'],...report.findings.map(f=>[f.id,f.category,f.severity,f.message,f.action])].map(row=>row.map(q).join(',')).join('\r\n')
}
