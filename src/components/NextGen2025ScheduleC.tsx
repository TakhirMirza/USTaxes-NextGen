import { ReactElement, useState } from 'react'
import { assessScheduleC2025, emptyScheduleCDraft2025, scheduleCExportCsv2025, scheduleCFields, ScheduleCDraft, ScheduleCField } from '../nextgen/taxYears/scheduleCWorksheet2025'
const STORAGE_KEY='ustaxes-nextgen-schedule-c-2025-draft-v1'
function load():ScheduleCDraft { try { const raw=window.sessionStorage.getItem(STORAGE_KEY); if(raw){const parsed=JSON.parse(raw) as Partial<ScheduleCDraft>;if(parsed&&typeof parsed.fields==='object'&&parsed.fields)return {...emptyScheduleCDraft2025(),...parsed,fields:{...emptyScheduleCDraft2025().fields,...parsed.fields},reviewed:false} } }catch{/* ignore corrupt data */}return emptyScheduleCDraft2025() }
const usd=(cents:number)=> (cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function NextGen2025ScheduleC({year}:{year:string}):ReactElement {
 const [draft,setDraft]=useState<ScheduleCDraft>(load)
 const [expanded,setExpanded]=useState(false)
 const result=assessScheduleC2025(draft)
 const save=(next:ScheduleCDraft)=>{setDraft(next);try{window.sessionStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{/* private mode */}}
 const change=(key:ScheduleCField,value:string)=>save({...draft,reviewed:false,fields:{...draft.fields,[key]:value}})
 const exportCsv=()=>{const blob=new Blob([scheduleCExportCsv2025(draft)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-2025-schedule-c-worksheet.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card" aria-label="Schedule C business income worksheet">
  <div className="v2-section-head"><div><span className="v2-eyebrow">2025 / BUSINESS INCOME</span><h2>Schedule C — business worksheet</h2><p>Draft income and expenses for sole proprietors. Not connected to Form 1040 or Schedule SE; fictional data only.</p></div></div>
  {year!=='2025'?<div className="v2-note">This worksheet supports 2025 only. Select 2025 to edit.</div>:<>
  <button type="button" className="v2-secondary" onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide Schedule C editor':'Open Schedule C editor'}</button>
  {expanded&&<>
   <div className="v2-form-grid"><label>Business label (non-identifying)<input value={draft.businessLabel} onChange={e=>save({...draft,businessLabel:e.target.value,reviewed:false})} placeholder="Example business" /></label></div>
   {(['income','expense'] as const).map(group=><div key={group}><h3>{group==='income'?'Business receipts and cost of goods':'Business expenses'}</h3><div className="v2-form-grid">{scheduleCFields.filter(f=>f.group===group).map(f=><label key={f.key}>{f.label}<input inputMode="decimal" value={draft.fields[f.key]} onChange={e=>change(f.key,e.target.value)} placeholder="0.00" />{f.note&&<small>{f.note}</small>}</label>)}</div></div>)}
   <div className="v2-note">Gross profit / other income: {usd(result.grossProfitCents)}. Expenses excluding meals: {usd(result.otherExpensesCents)}. Preliminary net before meals: <strong>{usd(result.netBeforeMealsCents)}</strong>.</div>
   {result.mealsEntered&&<div className="v2-note">Meals require an eligibility and limitation calculation. The amount entered is excluded from the preliminary net figure.</div>}
   {result.errors.length>0&&<ul>{result.errors.map(e=><li key={e}>{e}</li>)}</ul>}
   <label><input type="checkbox" checked={draft.reviewed} onChange={e=>save({...draft,reviewed:e.target.checked})}/> I reviewed the source amounts (not tax eligibility)</label>
   <div><button type="button" className="v2-secondary" onClick={exportCsv}>Export worksheet CSV</button> <button type="button" className="v2-secondary" onClick={()=>save(emptyScheduleCDraft2025())}>Clear worksheet</button></div>
  </>}
  <div className="v2-note"><strong>Status: {result.complete?'Source amounts reviewed — tax mapping blocked':'Draft / incomplete'}.</strong> Self-employment tax, qualified deductions, inventory, depreciation, home office, loss limitations, Schedule 1 and Schedule SE require separate validated implementations. This worksheet never authorizes filing.</div>
  </>}
 </section>
}
