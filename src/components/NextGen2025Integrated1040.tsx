import {useMemo,useState} from 'react'
import {Integrated1040Input2025,auditIntegrated1040,integrated1040Csv,integrated1040Fixtures} from '../nextgen/taxYears/integrated1040Review2025'
import './NextGen2025Integrated1040.css'
export default function NextGen2025Integrated1040({input}:{input:Integrated1040Input2025}){
 const report=useMemo(()=>auditIntegrated1040(input),[input]);const fixtures=useMemo(integrated1040Fixtures,[]);const [expanded,setExpanded]=useState(false)
 const fmt=(v:number|null)=>v===null?'Not verified':(v/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
 const download=()=>{const blob=new Blob([integrated1040Csv(report)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-2025-integrated-1040-audit.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card ng-integrated" aria-label="Form 1040 integrated audit"><span className="v2-eyebrow">PHASE 16 / FEDERAL 1040 INTEGRATION</span><h2>Unified Form 1040 integrity review</h2><p>Cross-checks limited source totals, adjusted gross income and taxable income against the draft Form 1040. Missing Schedule 1–3 amounts and credits remain unverified, never silently set to zero.</p>
 <div className="ng-integrated-stats"><div><small>Arithmetic matches</small><strong>{report.passed}</strong></div><div><small>Differences</small><strong>{report.differences}</strong></div><div><small>Unverified</small><strong>{report.unverified}</strong></div><div><small>Fixture tests</small><strong>{fixtures.filter(x=>x.pass).length}/{fixtures.length}</strong></div></div>
 <div className="ng-integrated-actions"><button type="button" className="v2-secondary" onClick={()=>setExpanded(x=>!x)}>{expanded?'Hide':'Show'} all 1040 line checks</button><button type="button" className="v2-secondary" onClick={download}>Export audit CSV</button></div>
 {expanded&&<div className="ng-integrated-scroll"><table><thead><tr><th>Line</th><th>Check</th><th>Expected</th><th>Draft</th><th>Status</th></tr></thead><tbody>{report.rows.map(r=><tr key={r.line}><td>{r.line}</td><td>{r.description}<small>{r.reason}</small></td><td>{fmt(r.expectedCents)}</td><td>{fmt(r.actualCents)}</td><td>{r.status}</td></tr>)}</tbody></table></div>}
 {fixtures.some(x=>!x.pass)&&<p className="ng-integrated-alert">Regression fixtures failed: {fixtures.filter(x=>!x.pass).map(x=>x.name).join(', ')}</p>}
 <p className="ng-integrated-warning"><strong>Filing disabled.</strong> This audit does not validate tax-law eligibility, tax tables, refundable credits or Schedule 2 additional taxes. No real taxpayer information should be entered.</p></section>
}
