import { useMemo, useState } from 'react'
import type { UnifiedReturn } from '../nextgen/taxYears/unifiedReturnStore'
import { buildBridge, bridgeCsv, bridgeFixtures } from '../nextgen/taxYears/unifiedCalculationBridge'
import './NextGenUnifiedCalculationBridge.css'
function download(content:string,name:string){const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export default function NextGenUnifiedCalculationBridge({book,dirty}:{book:UnifiedReturn;dirty:boolean}){
 const report=useMemo(()=>buildBridge(book),[book]);const tests=useMemo(()=>bridgeFixtures(),[])
 const [filter,setFilter]=useState<'all'|'ready'|'blocked'|'unsupported'>('all')
 const rows=report.nodes.filter(n=>filter==='all'||n.state===filter)
 return <section className="ng-bridge" aria-label="Phase 52 fictional calculation bridge">
  <span className="v2-eyebrow">PHASE 52 / SOURCE-TO-FORM ORCHESTRATION</span>
  <h4>Unified calculation bridge — {book.taxYear}</h4>
  <p><strong>Fictional development data only.</strong> Live preview of the Phase 51 editor. It does not modify the official calculation pipeline, IRS forms or filing. No tax-law or refund calculation is performed.</p>
  <div className="ng-bridge-metrics"><span>{report.sourceCount} documents</span><span>{report.nodes.filter(n=>n.state==='ready').length} arithmetic previews</span><span>{report.nodes.filter(n=>n.state!=='ready').length} blocked / unsupported</span><span>Revision {report.revision}</span><span>{dirty?'Unsaved editor changes':'Editor unchanged'}</span><span>{tests.filter(t=>t.passed).length}/{tests.length} checks</span></div>
  <div className="ng-bridge-actions"><label>Node status <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All nodes</option><option value="ready">Arithmetic preview</option><option value="blocked">Missing source</option><option value="unsupported">Official calculation unavailable</option></select></label><button type="button" onClick={()=>download(bridgeCsv(report),`fictional-bridge-${book.taxYear}.csv`)}>Export bridge CSV</button></div>
  <div className="ng-bridge-scroll"><table><thead><tr><th>Target</th><th>Calculation</th><th>State</th><th>Fictional amount</th><th>Source IDs</th><th>Reason</th></tr></thead><tbody>{rows.map(n=><tr key={n.id}><td>{n.target}</td><td>{n.label}</td><td>{n.state}</td><td>{n.amount??'Unavailable'}</td><td>{n.sourceIds.join(', ')||'—'}</td><td>{n.explanation}</td></tr>)}</tbody></table></div>
  <details><summary>Dependency graph ({report.nodes.length} nodes)</summary><ul>{report.nodes.map(n=><li key={n.id}><strong>{n.id}</strong> → {n.target}; depends on {n.dependencies.join(', ')||'no implemented sources'}</li>)}</ul></details>
  <details><summary>Blocking conditions ({report.blockers.length})</summary><ul>{report.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul></details>
  <details><summary>Regression fixtures ({tests.filter(t=>t.passed).length}/{tests.length})</summary><ul>{tests.map(t=><li key={t.name}>{t.passed?'PASS':'FAIL'} — {t.name}</li>)}</ul></details>
 </section>
}
