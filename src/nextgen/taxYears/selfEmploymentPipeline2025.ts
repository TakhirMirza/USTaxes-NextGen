import { ScheduleCDraft } from './scheduleCWorksheet2025'
import { evaluateScheduleCBridge2025 } from './scheduleCBridge2025'
import { assessScheduleSEPreview2025 } from './scheduleSEPreview2025'

export type PipelineNode2025 = { id:string; source:string; target:string; amountCents:number|null; state:'candidate'|'blocked'; reason:string }
export type Pipeline2025 = { status:'blocked'|'illustrative'; nodes:PipelineNode2025[]; blockers:string[]; warnings:string[]; completeSourceCount:number }
export type PipelineAssumptions2025 = { noW2WagesConfirmed:boolean; noOtherSelfEmploymentConfirmed:boolean; ordinaryMethodConfirmed:boolean }
/** A deliberately non-posting, cross-schedule dependency and traceability report.
 * This report must NEVER feed the authoritative Form 1040 computation. */
export function assessSelfEmploymentPipeline2025(draft:ScheduleCDraft, assumptions:PipelineAssumptions2025):Pipeline2025 {
 const c=evaluateScheduleCBridge2025(draft)
 const se=assessScheduleSEPreview2025(draft,assumptions)
 const blockers:string[]=[]
 const warnings:string[]=[]
 const add=(value:string)=>{if(!blockers.includes(value))blockers.push(value)}
 for(const f of c.findings){if(f.severity==='blocker' && f.id!=='schedule-se' && f.id!=='schedule-1' && f.id!=='se-deduction')add(`${f.id}: ${f.detail}`);else if(f.severity==='review')warnings.push(`${f.id}: ${f.detail}`)}
 for(const f of se.findings){if(f.severity==='blocker')add(`${f.code}: ${f.message}`);else warnings.push(`${f.code}: ${f.message}`)}
 const valid=c.netProfitCandidateCents!==null&&se.status==='illustrative'&&blockers.length===0
 const node=(id:string,source:string,target:string,amountCents:number|null,reason:string):PipelineNode2025=>({id,source,target,amountCents,state:valid&&amountCents!==null?'candidate':'blocked',reason})
 const nodes:PipelineNode2025[]=[
  node('c-profit','Schedule C net profit','Schedule 1, line 3',c.netProfitCandidateCents,'Schedule C source review, deductions, and business eligibility required'),
  node('se-earnings','Schedule C net profit','Schedule SE net earnings',se.netEarningsCents,'92.35% illustrative net earnings, ordinary method only'),
  node('se-tax','Schedule SE net earnings','Schedule 2, line 4',se.illustrativeTotalCents,'Illustrative Social Security and Medicare components; no posting'),
  node('se-deduction','Schedule SE tax','Schedule 1, line 15',se.illustrativeHalfDeductionCents,'Illustrative 50% adjustment; no posting'),
  node('schedule1-income','Schedule 1, line 3','Schedule 1, line 10 → Form 1040, line 8',null,'Other Schedule 1 income must be reconciled before line 10'),
  node('schedule1-adjustment','Schedule 1, line 15','Schedule 1, line 26 → Form 1040, line 10',null,'All other Schedule 1 adjustments must be reconciled'),
  node('schedule2-total','Schedule 2, line 4','Schedule 2, line 21 → Form 1040, line 23',null,'Other taxes and Schedule 2 totals must be reconciled')
 ]
 add('Form 1040 posting is disabled: full Schedule 1 and Schedule 2 line totals are not reconciled.')
 add('The source data and calculation assumptions are illustrative; IRS tax-year 2025 rules and rounding require independent validation.')
 return {status:'blocked',nodes,blockers,warnings,completeSourceCount:nodes.filter(n=>n.amountCents!==null).length}
}
const csvCell=(v:string)=>'"'+(/^[=+@\-\t\r]/.test(v)?"'":'')+v.replace(/"/g,'""')+'"'
export function selfEmploymentPipelineCsv2025(report:Pipeline2025):string {
 const rows=[['Kind','Source','Target','Amount USD','Status / detail'],...report.nodes.map(n=>['Dependency',n.source,n.target,n.amountCents===null?'unavailable':(n.amountCents/100).toFixed(2),`${n.state}: ${n.reason}`]),...report.blockers.map(x=>['Blocker','','','',x]),...report.warnings.map(x=>['Review','','','',x])]
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'
}
