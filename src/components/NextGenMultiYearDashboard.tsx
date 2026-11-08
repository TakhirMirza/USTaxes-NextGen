import { useEffect, useState } from 'react'
import { DASHBOARD_YEARS, dashboardCsv, dashboardFixtures, summarizeYears } from '../nextgen/taxYears/multiYearDashboard'
import type { YearSummary } from '../nextgen/taxYears/multiYearDashboard'
import { storeKey } from '../nextgen/taxYears/unifiedReturnStore'
import './NextGenMultiYearDashboard.css'
const emptyRows=()=>summarizeYears(()=>null)
function download(text:string,name:string,type:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export default function NextGenMultiYearDashboard({activeYear,dirty}:{activeYear:string;dirty:boolean}){
 const [rows,setRows]=useState<YearSummary[]>(emptyRows)
 const [selectedYear,setSelectedYear]=useState(activeYear)
 const [message,setMessage]=useState('')
 const refresh=()=>{try{setRows(summarizeYears(key=>localStorage.getItem(key)));setMessage('Local fictional return inventory refreshed.')}catch{setMessage('Browser storage is unavailable. No return data was changed.')}}
 useEffect(()=>{setSelectedYear(activeYear);refresh()},[activeYear])
 useEffect(()=>{const onStorage=(e:StorageEvent)=>{if(e.key?.startsWith('ustaxes-nextgen-fictional-return-v1:'))refresh()};window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage)},[])
 const selected=rows.find(r=>r.year===selectedYear)
 const tests=dashboardFixtures()
 const exportYear=()=>{try{const raw=localStorage.getItem(storeKey(selectedYear));if(raw===null){setMessage('No saved fictional return exists for that year.');return}if(!selected?.valid){setMessage('Invalid stored data: export is disabled.');return}download(raw,`fictional-return-${selectedYear}-backup.json`,'application/json');setMessage('Exported fictional JSON backup.')}catch{setMessage('Export failed: browser storage unavailable.')}}
 const deleteYear=()=>{if(selectedYear===activeYear&&dirty){setMessage('Save, export, or discard unsaved edits in the active editor before deleting its stored copy.');return}if(!selected?.exists){setMessage('Nothing to delete for that year.');return}if(!confirm(`Permanently delete the locally stored FICTIONAL ${selectedYear} return? This cannot be undone without a JSON backup.`))return;try{localStorage.removeItem(storeKey(selectedYear));refresh();setMessage(`Deleted locally saved fictional ${selectedYear} return. If the active editor is open, use Reload saved before editing further.`)}catch{setMessage('Delete failed: browser storage unavailable.')}}
 return <section className="ng-multi-year" aria-label="Phase 54 multi-year fictional return dashboard">
  <span className="v2-eyebrow">PHASE 54 / MULTI-YEAR DASHBOARD</span>
  <h4>Fictional returns across 2025–2028</h4>
  <p>Read-only inventory of this browser's local fictional return stores. Future-year tax rules are <strong>not implemented</strong>. No tax return is filing-ready. Do not enter real taxpayer information.</p>
  <div className="ng-my-metrics"><span>{rows.filter(r=>r.valid).length} saved valid years</span><span>{rows.reduce((n,r)=>n+r.documents,0)} fictional documents</span><span>{rows.reduce((n,r)=>n+r.blockers,0)} source blockers</span><span>0 filing-ready years</span></div>
  <div className="ng-my-table"><table><thead><tr><th>Tax year</th><th>Local status</th><th>Sources</th><th>Blockers</th><th>Preview lines</th><th>Revision</th></tr></thead><tbody>{rows.map(r=><tr key={r.year} className={r.year===activeYear?'ng-my-active':''}><td><button type="button" aria-pressed={selectedYear===r.year} onClick={()=>setSelectedYear(r.year)}>{r.year}{r.year===activeYear?' (editor)':''}</button></td><td>{r.status}</td><td>{r.documents}</td><td>{r.blockers}</td><td>{r.previewLines}</td><td>{r.revision}</td></tr>)}</tbody></table></div>
  <div className="ng-my-detail"><strong>{selectedYear}: {selected?.message}</strong><p>Last saved: {selected?.updatedAt||'not recorded'}. {selectedYear===activeYear?'The editor below is open for this year.':'This year is shown as an inventory entry only; use the application tax-year selector to edit it.'}</p></div>
  <div className="ng-my-actions"><button type="button" onClick={refresh}>Refresh inventory</button><button type="button" onClick={()=>download(dashboardCsv(rows),'fictional-multi-year-summary.csv','text/csv;charset=utf-8')}>Export summary CSV</button><button type="button" onClick={exportYear} disabled={!selected?.valid}>Backup selected JSON</button><button type="button" onClick={deleteYear} disabled={!selected?.exists}>Delete selected local copy</button></div>
  {message&&<p role="status">{message}</p>}
  <details><summary>Phase 54 regression fixtures ({tests.filter(t=>t.passed).length}/{tests.length})</summary><ul>{tests.map(t=><li key={t.name}>{t.passed?'PASS':'FAIL'} — {t.name}</li>)}</ul></details>
 </section>
}
