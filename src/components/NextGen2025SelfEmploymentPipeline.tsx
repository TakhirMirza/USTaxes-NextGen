import { useState } from 'react'
import { emptyScheduleCDraft2025, ScheduleCDraft } from '../nextgen/taxYears/scheduleCWorksheet2025'
import { assessSelfEmploymentPipeline2025, selfEmploymentPipelineCsv2025 } from '../nextgen/taxYears/selfEmploymentPipeline2025'
const KEY='ustaxes-nextgen-schedule-c-2025-draft-v1'
function readDraft():ScheduleCDraft {try {const raw=window.sessionStorage.getItem(KEY);if(raw){const obj=JSON.parse(raw) as Partial<ScheduleCDraft>;if(obj&&obj.fields&&typeof obj.fields==='object')return {...emptyScheduleCDraft2025(),...obj,fields:{...emptyScheduleCDraft2025().fields,...obj.fields}}}}catch{/* untrusted or unavailable session draft */}return emptyScheduleCDraft2025()}
const usd=(n:number|null)=>n===null?'Pending / blocked':(n/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function NextGen2025SelfEmploymentPipeline({year}:{year:string}) {
 const [draft,setDraft]=useState<ScheduleCDraft>(readDraft)
 const [noW2,setNoW2]=useState(false)
 const [noOther,setNoOther]=useState(false)
 const [ordinary,setOrdinary]=useState(false)
 if(year!=='2025')return null
 const report=assessSelfEmploymentPipeline2025(draft,{noW2WagesConfirmed:noW2,noOtherSelfEmploymentConfirmed:noOther,ordinaryMethodConfirmed:ordinary})
 const download=()=>{const blob=new Blob([selfEmploymentPipelineCsv2025(report)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-2025-self-employment-dependency-audit.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card" aria-label="Self-employment multi-schedule integration audit">
  <span className="v2-eyebrow">PHASE 30 / CROSS-SCHEDULE INTEGRATION</span>
  <h2>Schedule C → SE → Schedule 1 / 2 → Form 1040</h2>
  <p>End-to-end source traceability for fictional 2025 cases. Values are <strong>non-posting candidates</strong>, not final tax amounts. Missing aggregate totals remain blocked instead of being silently inferred.</p>
  <div className="v2-check-grid">
   <label className="v2-check"><input type="checkbox" checked={noW2} onChange={e=>setNoW2(e.target.checked)}/>No W-2 or Social Security-covered wages in this test scenario.</label>
   <label className="v2-check"><input type="checkbox" checked={noOther} onChange={e=>setNoOther(e.target.checked)}/>No other business, partnership, or farming income.</label>
   <label className="v2-check"><input type="checkbox" checked={ordinary} onChange={e=>setOrdinary(e.target.checked)}/>Ordinary Schedule SE method only; no special exceptions.</label>
  </div>
  <div className="v2-note"><strong>FILING BLOCKED.</strong> {report.completeSourceCount} / {report.nodes.length} traceable source amounts available. No Schedule 1/2 totals or Form 1040 tax/refund is modified by this report.</div>
  <div className="v2-review-grid">{report.nodes.map(n=><div key={n.id}><span>{n.source} → {n.target}</span><strong>{usd(n.amountCents)}</strong><small>{n.reason}</small></div>)}</div>
  <h3>Required resolution before posting</h3><ul className="v2-blockers">{report.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>
  <h3>Independent review notes</h3><ul className="v2-blockers">{report.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
  <button type="button" className="v2-secondary" onClick={()=>setDraft(readDraft())}>Refresh Schedule C source</button>{' '}<button type="button" className="v2-secondary" onClick={download}>Export full dependency audit CSV</button>
 </section>
}
