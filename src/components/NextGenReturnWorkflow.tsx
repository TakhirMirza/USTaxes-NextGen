import { useState } from 'react'
import type { UnifiedReturn } from '../nextgen/taxYears/unifiedReturnStore'
import { buildWorkflow, workflowCsv, workflowFixtures } from '../nextgen/taxYears/returnWorkflow'
import './NextGenReturnWorkflow.css'
function download(text:string,name:string){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export default function NextGenReturnWorkflow({book,dirty,selectedId,onSelectDocument}:{book:UnifiedReturn;dirty:boolean;selectedId:string;onSelectDocument:(id:string)=>void}){
 const report=buildWorkflow(book),checks=workflowFixtures()
 const [filter,setFilter]=useState<'all'|'needs-attention'|'complete'|'not-implemented'>('all')
 const [reviewed,setReviewed]=useState<string[]>([])
 const steps=report.steps.filter(s=>filter==='all'||s.state===filter)
 const toggle=(id:string)=>setReviewed(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
 return <section className="ng-workflow" aria-label="Phase 53 fictional return workflow">
  <span className="v2-eyebrow">PHASE 53 / GUIDED RETURN WORKFLOW</span>
  <h4>Unified document-to-return review</h4>
  <p><strong>Fictional data only.</strong> Review markers are temporary UI acknowledgements, not proof of corrected data. No IRS filing readiness or tax calculation is asserted.</p>
  <div className="ng-workflow-metrics"><span>{report.reviewedSources}/{report.totalSources} complete fictional sources</span><span>{report.sourceIssues.filter(i=>i.severity==='blocker').length} source blockers</span><span>{report.unavailableTargets} blocked/unsupported targets</span><span>{dirty?'Unsaved changes':'Saved/unchanged'}</span><span>Filing unavailable</span></div>
  <div className="ng-workflow-actions"><label>Filter steps <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All steps</option><option value="needs-attention">Needs attention</option><option value="complete">Complete source fields</option><option value="not-implemented">Not implemented</option></select></label><button type="button" onClick={()=>download(workflowCsv(report),`fictional-workflow-${book.taxYear}.csv`)}>Export workflow CSV</button></div>
  <ol className="ng-workflow-steps">{steps.map(s=><li key={s.id}><div className="ng-workflow-stephead"><strong>{s.title}</strong><span>{s.state}</span></div><p>{s.detail}</p><small>{s.action}</small>{s.documentIds.length>0&&<div className="ng-workflow-actions">{s.documentIds.map(id=><button key={id} type="button" aria-pressed={selectedId===id} onClick={()=>{onSelectDocument(id);document.querySelector('.ng-unified-grid')?.scrollIntoView({behavior:'smooth',block:'start'})}}>Edit source {id}</button>)}</div>}<label className="ng-workflow-reviewed"><input type="checkbox" checked={reviewed.includes(s.id)} onChange={()=>toggle(s.id)}/> I reviewed this step (not resolved)</label></li>)}</ol>
  <details><summary>Phase 53 regression checks ({checks.filter(x=>x.passed).length}/{checks.length})</summary><ul>{checks.map(c=><li key={c.name}>{c.passed?'PASS':'FAIL'} — {c.name}</li>)}</ul></details>
 </section>
}
