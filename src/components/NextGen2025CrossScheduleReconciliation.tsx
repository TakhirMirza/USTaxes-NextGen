import { useState } from 'react'
import { LineKey2025, RECONCILIATION_LINES_2025, ReconciliationInput2025, reconcileCrossSchedules2025, reconciliationReportCsv2025 } from '../nextgen/taxYears/crossScheduleReconciliation2025'
const format=(n:number|null)=>n===null?'Missing':(n/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function NextGen2025CrossScheduleReconciliation({year}:{year:string}){
 const [values,setValues]=useState<ReconciliationInput2025>({})
 if(year!=='2025')return null
 const report=reconcileCrossSchedules2025(values)
 const download=()=>{const blob=new Blob([reconciliationReportCsv2025(report)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-2025-cross-schedule-reconciliation.csv';a.click();URL.revokeObjectURL(url)}
 const groups=[...new Set(RECONCILIATION_LINES_2025.map(x=>x.group))]
 return <section className="v2-card" aria-label="2025 cross-schedule reconciliation">
  <span className="v2-eyebrow">PHASE 31 / FEDERAL RECONCILIATION</span>
  <h2>Schedule C / SE / 1 / 2 → Form 1040 audit</h2>
  <p>Manual fictional-data worksheet to verify arithmetic and source-line equality. Enter 0 explicitly where a line is genuinely zero. Values are not saved or posted to the tax return.</p>
  <div className="v2-note"><strong>FILING BLOCKED.</strong> {report.matched} / {report.checked} evaluated relationships match; {report.missing} source amounts missing. This audit never authorizes filing.</div>
  {groups.map(group=><div key={group}><h3>{group}</h3><div className="v2-form-grid">{RECONCILIATION_LINES_2025.filter(x=>x.group===group).map(({key,label})=><label key={key}>{label}<input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 0.00" value={values[key]||''} onChange={e=>setValues(old=>({...old,[key as LineKey2025]:e.target.value}))}/></label>)}</div></div>)}
  <h3>Reconciliation results</h3><div className="v2-review-grid">{report.lines.map(line=><div key={line.key}><span>{line.label}</span><strong>{format(line.valueCents)}</strong></div>)}</div>
  <h3>Findings ({report.findings.length})</h3><ul className="v2-blockers">{report.findings.map(f=><li key={f.code}>{f.code}: {f.message}</li>)}</ul>
  <button type="button" className="v2-secondary" onClick={download}>Export audit CSV</button>{' '}<button type="button" className="v2-secondary" onClick={()=>setValues({})}>Clear fictional worksheet</button>
 </section>
}
