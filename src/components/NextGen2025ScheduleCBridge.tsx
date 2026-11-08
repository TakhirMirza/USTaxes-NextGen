import { useState } from 'react'
import { emptyScheduleCDraft2025, ScheduleCDraft } from '../nextgen/taxYears/scheduleCWorksheet2025'
import { evaluateScheduleCBridge2025, scheduleCBridgeCsv2025 } from '../nextgen/taxYears/scheduleCBridge2025'
const KEY='ustaxes-nextgen-schedule-c-2025-draft-v1'
function readDraft():ScheduleCDraft {
 try { const raw=window.sessionStorage.getItem(KEY);if(raw){const obj=JSON.parse(raw) as Partial<ScheduleCDraft>;if(obj&&obj.fields&&typeof obj.fields==='object')return {...emptyScheduleCDraft2025(),...obj,fields:{...emptyScheduleCDraft2025().fields,...obj.fields}} }}catch{/* inaccessible or invalid */}
 return emptyScheduleCDraft2025()
}
const money=(cents:number|null)=>cents===null?'Not available':(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function NextGen2025ScheduleCBridge({year}:{year:string}) {
 const [expanded,setExpanded]=useState(false)
 const [draft,setDraft]=useState<ScheduleCDraft>(readDraft)
 if(year!=='2025')return null
 const report=evaluateScheduleCBridge2025(draft)
 const refresh=()=>setDraft(readDraft())
 const download=()=>{const blob=new Blob([scheduleCBridgeCsv2025(report)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='nextgen-2025-schedule-c-bridge-review.csv';anchor.click();URL.revokeObjectURL(url)}
 return <section className="v2-card" aria-label="Schedule C Schedule 1 and Schedule SE bridge">
 <span className="v2-eyebrow">PHASE 28 / BUSINESS INCOME DEPENDENCY</span>
 <h2>Schedule C → Schedule 1 → Form 1040 / Schedule SE</h2>
 <p>Reconcile a fictional Schedule C worksheet with downstream federal forms. This is a read-only candidate preview: no values are posted to the authoritative tax calculation.</p>
 <div className="v2-review-grid"><div><span>Schedule C preliminary result</span><strong>{money(report.netProfitCandidateCents)}</strong></div><div><span>Schedule 1 line 3 candidate</span><strong>{money(report.schedule1Line3CandidateCents)}</strong></div><div><span>Form 1040 line 8</span><strong>BLOCKED</strong></div><div><span>Schedule SE</span><strong>{report.scheduleSERequiredReview?'Review required':'Not established'}</strong></div></div>
 <div className="v2-note"><strong>Filing readiness: NOT READY.</strong> Schedule SE tax, its adjustment, Schedule 1 reconciliation, and full Form 1040 posting are not implemented. A successful build does not validate these rules.</div>
 <div><button type="button" className="v2-secondary" onClick={refresh}>Refresh from Schedule C worksheet</button>{' '}<button type="button" className="v2-secondary" onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide dependency findings':'Show dependency findings'}</button>{' '}<button type="button" className="v2-secondary" onClick={download}>Export bridge CSV</button></div>
 {expanded&&<ul className="v2-blockers">{report.findings.map(f=><li key={f.id}><strong>{f.severity.toUpperCase()} — {f.title}</strong><div>{f.detail}</div></li>)}</ul>}
 </section>
}
