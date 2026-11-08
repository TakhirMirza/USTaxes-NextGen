import {useMemo,useState} from 'react'
import {GateInput2025,checkScheduleDependencies2025,dependencyGateCsv2025,scheduleDependencyFixtures2025} from '../nextgen/taxYears/scheduleDependencyGate2025'
import './NextGen2025ScheduleDependencies.css'
export default function NextGen2025ScheduleDependencies({input}:{input:GateInput2025}) {
 const result=useMemo(()=>checkScheduleDependencies2025(input),[input])
 const fixtures=useMemo(scheduleDependencyFixtures2025,[])
 const [expanded,setExpanded]=useState(false)
 const [filter,setFilter]=useState<'all'|'attention'>('attention')
 const visible=result.nodes.filter(n=>filter==='all'||n.state!=='matched')
 const money=(v:number|null)=>v===null?'Not established':(v/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
 const exportCsv=()=>{const blob=new Blob([dependencyGateCsv2025(result)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-2025-schedule-dependency-audit.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card ng-dependency" aria-label="2025 schedules dependency review">
  <span className="v2-eyebrow">PHASE 17 / SCHEDULES 1–3 DEPENDENCY GRAPH</span>
  <h2>Federal form dependency review</h2>
  <p>Follow how Schedule 1, Schedule 2 and Schedule 3 affect Form 1040. Arithmetic matches are limited checks—not completed tax calculations. Missing schedule amounts remain unknown, never zero.</p>
  <div className="ng-dependency-summary"><div><small>Arithmetic matches</small><strong>{result.matches}</strong></div><div><small>Differences</small><strong>{result.mismatches}</strong></div><div><small>Pending / excluded</small><strong>{result.pending+result.unsupported}</strong></div><div><small>Regression checks</small><strong>{fixtures.filter(f=>f.pass).length}/{fixtures.length}</strong></div></div>
  <div className="ng-dependency-actions"><button className="v2-secondary" type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?'Hide':'Show'} dependencies</button><button className="v2-secondary" type="button" onClick={exportCsv}>Export dependency CSV</button></div>
  {expanded&&<><div className="ng-dependency-actions"><button className="v2-secondary" type="button" aria-pressed={filter==='attention'} onClick={()=>setFilter('attention')}>Needs attention</button><button className="v2-secondary" type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All lines</button></div><div className="ng-dependency-list">{visible.map(n=><article key={n.id} className="ng-dependency-item"><div><strong>{n.id} · {n.title}</strong><span className={'ng-dependency-status '+n.state}>{n.state}</span></div><small>Depends on: {n.upstream.join(' → ')}</small><p>{n.explanation}</p>{n.expectedCents!==null&&<small>Restricted expected: {money(n.expectedCents)} · Draft: {money(n.actualCents)}</small>}</article>)}</div></>}
  {fixtures.some(f=>!f.pass)&&<p className="ng-dependency-error">Regression failure: {fixtures.filter(f=>!f.pass).map(f=>f.name).join(', ')}</p>}
  <p className="ng-dependency-disclaimer"><strong>Development-only preview. Filing disabled.</strong> Do not enter real taxpayer identifiers or financial records.</p>
 </section>
}
