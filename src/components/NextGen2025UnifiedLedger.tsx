import {useMemo,useState} from 'react'
import {UnifiedLedgerInput2025,buildUnifiedLedger2025,unifiedLedgerCsv2025,unifiedLedgerFixtures2025} from '../nextgen/taxYears/unifiedSourceLedger2025'
import './NextGen2025UnifiedLedger.css'
export default function NextGen2025UnifiedLedger({input}:{input:UnifiedLedgerInput2025}){
 const rows=useMemo(()=>buildUnifiedLedger2025(input),[input])
 const fixtures=useMemo(unifiedLedgerFixtures2025,[])
 const [open,setOpen]=useState(false)
 const [onlyIssues,setOnlyIssues]=useState(true)
 const shown=rows.filter(r=>!onlyIssues||r.state!=='verified')
 const download=()=>{const b=new Blob([unifiedLedgerCsv2025(rows)],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='nextgen-2025-unified-source-ledger.csv';a.click();URL.revokeObjectURL(u)}
 const amount=(n:number|null)=>n===null?'Not established':(n/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
 return <section className="v2-card ng-unified" aria-label="Unified federal source ledger"><span className="v2-eyebrow">PHASE 18 / UNIFIED FEDERAL DATA</span><h2>Form 1040 source-of-truth ledger</h2><p>Trace draft W-2 and 1099-INT amounts to mapped Form 1040 lines, review dependencies and identify discrepancies. Missing information is never silently treated as zero.</p>
 <div className="ng-unified-stats"><div><small>Verified</small><strong>{rows.filter(r=>r.state==='verified').length}</strong></div><div><small>Pending</small><strong>{rows.filter(r=>r.state==='pending').length}</strong></div><div><small>Conflicts</small><strong>{rows.filter(r=>r.state==='conflict').length}</strong></div><div><small>Regression</small><strong>{fixtures.filter(x=>x.pass).length}/{fixtures.length}</strong></div></div>
 <div className="ng-unified-actions"><button type="button" className="v2-secondary" onClick={()=>setOpen(v=>!v)}>{open?'Hide':'Inspect'} source ledger</button><button type="button" className="v2-secondary" onClick={download}>Export ledger CSV</button></div>
 {open&&<><label className="ng-unified-filter"><input type="checkbox" checked={onlyIssues} onChange={e=>setOnlyIssues(e.target.checked)}/> Show unresolved and conflicting lines only</label><div className="ng-unified-lines">{shown.length===0?<p>No lines in selected filter.</p>:shown.map(r=><article key={r.id}><div><strong>{r.id} · {r.label}</strong><span className={`ng-unified-tag ${r.state}`}>{r.state}</span></div><p>{r.source} · {amount(r.cents)}</p><small>{r.reason}</small>{r.dependencies.length>0&&<small>Dependencies: {r.dependencies.join(' → ')}</small>}</article>)}</div></>}
 {fixtures.some(x=>!x.pass)&&<p role="alert">Regression checks failed: {fixtures.filter(x=>!x.pass).map(x=>x.name).join(', ')}</p>}
 <p className="ng-unified-warning">Development preview only. Not an IRS-certified calculation or filing system. Do not enter real taxpayer data.</p></section>
}
