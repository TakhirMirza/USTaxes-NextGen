import { useState } from 'react'
import { emptyScheduleCDraft2025, ScheduleCDraft } from '../nextgen/taxYears/scheduleCWorksheet2025'
import { assessScheduleSEPreview2025, scheduleSEPreviewCsv2025 } from '../nextgen/taxYears/scheduleSEPreview2025'
const KEY='ustaxes-nextgen-schedule-c-2025-draft-v1'
function readDraft():ScheduleCDraft { try { const raw=window.sessionStorage.getItem(KEY);if(raw){const obj=JSON.parse(raw) as Partial<ScheduleCDraft>;if(obj&&obj.fields&&typeof obj.fields==='object')return {...emptyScheduleCDraft2025(),...obj,fields:{...emptyScheduleCDraft2025().fields,...obj.fields}}}}catch{/* no browser storage */}return emptyScheduleCDraft2025() }
const usd=(n:number|null)=>n===null?'Unavailable':(n/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function NextGen2025ScheduleSE({year}:{year:string}) {
 const [draft,setDraft]=useState<ScheduleCDraft>(readDraft)
 const [noW2,setNoW2]=useState(false)
 const [noOther,setNoOther]=useState(false)
 const [ordinary,setOrdinary]=useState(false)
 if(year!=='2025')return null
 const report=assessScheduleSEPreview2025(draft,{noW2WagesConfirmed:noW2,noOtherSelfEmploymentConfirmed:noOther,ordinaryMethodConfirmed:ordinary})
 const download=()=>{const blob=new Blob([scheduleSEPreviewCsv2025(report)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-2025-schedule-se-illustration.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card" aria-label="Schedule SE preliminary calculation preview">
  <span className="v2-eyebrow">PHASE 29 / SELF-EMPLOYMENT TAX</span>
  <h2>Schedule SE — limited calculation preview</h2>
  <p>Illustrative arithmetic for fictional, uncomplicated single-business scenarios. No amount is transferred to Schedule 1, Schedule 2, or Form 1040.</p>
  <div className="v2-check-grid">
   <label className="v2-check"><input type="checkbox" checked={noW2} onChange={e=>setNoW2(e.target.checked)}/>This fictional scenario has no W-2 wages or other Social Security-covered wages.</label>
   <label className="v2-check"><input type="checkbox" checked={noOther} onChange={e=>setNoOther(e.target.checked)}/>No other self-employment, farming, or partnership income.</label>
   <label className="v2-check"><input type="checkbox" checked={ordinary} onChange={e=>setOrdinary(e.target.checked)}/>Ordinary SE method only; no special methods or exceptions.</label>
  </div>
  <div className="v2-review-grid"><div><span>Schedule C candidate</span><strong>{usd(report.netProfitCents)}</strong></div><div><span>92.35% net earnings (illustrative)</span><strong>{usd(report.netEarningsCents)}</strong></div><div><span>12.4% Social Security (illustrative)</span><strong>{usd(report.illustrativeSSTaxCents)}</strong></div><div><span>2.9% Medicare (illustrative)</span><strong>{usd(report.illustrativeMedicareTaxCents)}</strong></div><div><span>Combined SE tax (illustrative)</span><strong>{usd(report.illustrativeTotalCents)}</strong></div><div><span>Half deduction (illustrative)</span><strong>{usd(report.illustrativeHalfDeductionCents)}</strong></div></div>
  <div className="v2-note"><strong>{report.status==='blocked'?'BLOCKED':'ILLUSTRATIVE ONLY'} — NOT FILING READY.</strong> Schedule SE, Schedule 1, Schedule 2 and Form 1040 authoritative posting remain disabled. Rates, eligibility, wage base, special taxes and official IRS rounding require independent validation.</div>
  <ul className="v2-blockers">{report.findings.map(f=><li key={f.code}><strong>{f.severity.toUpperCase()} — {f.code}</strong><div>{f.message}</div></li>)}</ul>
  <button type="button" className="v2-secondary" onClick={()=>setDraft(readDraft())}>Refresh Schedule C values</button>{' '}<button type="button" className="v2-secondary" onClick={download}>Export illustration CSV</button>
 </section>
}
