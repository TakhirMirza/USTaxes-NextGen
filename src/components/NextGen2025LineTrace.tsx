import { useMemo, useState } from 'react'
import { TraceInput2025, traceFederal1040Lines2025, traceFederal1040Csv2025, runLineTraceFixtures2025 } from '../nextgen/taxYears/federal1040LineTrace2025'
import './NextGen2025LineTrace.css'
export default function NextGen2025LineTrace({input}:{input:TraceInput2025}){
 const [expanded,setExpanded]=useState(false)
 const report=useMemo(()=>traceFederal1040Lines2025(input),[input])
 const fixtures=useMemo(()=>runLineTraceFixtures2025(),[])
 const download=()=>{const blob=new Blob([traceFederal1040Csv2025(report)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-2025-line-trace.csv';a.click();URL.revokeObjectURL(url)}
 const fmt=(cents:number|null)=>cents===null?'Not verified':(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
 return <section className="v2-card ng-line-trace" aria-label="2025 Form 1040 source line trace"><span className="v2-eyebrow">PHASE 15 / FORM 1040 TRACEABILITY</span><h2>Source-to-line reconciliation</h2><p>Compare fictional source-document totals against draft Form 1040 lines. Missing values are never converted into zero. This is a restricted arithmetic audit, not a tax filing certification.</p>
 <div className="ng-trace-summary"><div><small>Matches</small><strong>{report.matches}</strong></div><div><small>Differences</small><strong>{report.mismatches}</strong></div><div><small>Unverified</small><strong>{report.unverified}</strong></div><div><small>Fixture tests</small><strong>{fixtures.filter(f=>f.passed).length}/{fixtures.length}</strong></div></div>
 <div className="ng-trace-actions"><button type="button" className="v2-secondary" onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide':'Show'} line details</button><button type="button" className="v2-secondary" onClick={download}>Export line audit CSV</button></div>
 {expanded&&<div className="ng-trace-table-wrap"><table className="ng-trace-table"><thead><tr><th>1040 line</th><th>Source</th><th>Expected</th><th>Draft</th><th>Check</th></tr></thead><tbody>{report.rows.map(r=><tr key={r.line}><td>{r.line}</td><td>{r.origin}<small>{r.note}</small></td><td>{fmt(r.expected)}</td><td>{fmt(r.actual)}</td><td><strong className={'ng-trace-'+r.status}>{r.status}</strong></td></tr>)}</tbody></table></div>}
 <p className="ng-trace-note">Filing disabled. Source mapping and regression checks cannot establish tax-law eligibility, verify the IRS tax table, or authorize e-filing.</p></section>
}
