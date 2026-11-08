import { useState } from 'react'
import { buildUnifiedFederalGraph, unifiedGraphCsv } from '../nextgen/taxYears/unifiedFederalGraph'
import { Schedule1040Candidates2025 } from '../nextgen/taxYears/schedules1040Bridge2025'
export default function NextGen2025UnifiedGraph({ year, wages, withholding, interest, schedule, deduction, incomeReviewed, schedulesReviewed, deductionReviewed }: {
 year: string; wages: number | null; withholding: number | null; interest: number | null; schedule: Schedule1040Candidates2025; deduction: number | null; incomeReviewed: boolean; schedulesReviewed: boolean; deductionReviewed: boolean
}) {
 const [detail, setDetail] = useState<'all' | 'issues' | 'none'>('issues')
 const report = buildUnifiedFederalGraph({ taxYear: Number(year), wages, withholding, interest, schedule1Income: schedule.line8, schedule1Adjustments: schedule.line10, schedule2Tax: schedule.line17, schedule3Credits: schedule.line20, deduction, otherIncomeReviewed: incomeReviewed, schedulesReviewed, deductionReviewed })
 const visible = detail === 'none' ? [] : report.order.filter(k => detail === 'all' || report.nodes[k].status !== 'available')
 const exportCsv = () => { const url = URL.createObjectURL(new Blob([unifiedGraphCsv(report)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'nextgen-phase35-unified-graph.csv'; a.click(); URL.revokeObjectURL(url) }
 return <section className="v2-card" aria-label="Phase 35 unified federal dependency graph">
  <span className="v2-eyebrow">PHASE 35 / UNIFIED FEDERAL CALCULATION GRAPH</span>
  <h2>Federal source-to-line calculation engine</h2>
  <p>One deterministic dependency graph for W-2, 1099-INT, Schedules 1–3 and Form 1040. Amounts are read-only candidates in integer cents; missing inputs remain missing. This does not calculate tax liability, refund, or authorize filing.</p>
  <div className="v2-stat-grid"><div className="v2-stat"><span>Graph nodes</span><strong>{report.order.length}</strong></div><div className="v2-stat"><span>Available candidates</span><strong>{report.available}</strong></div><div className="v2-stat"><span>Unresolved</span><strong>{report.blocked}</strong></div><div className="v2-stat"><span>Filing</span><strong>Disabled</strong></div></div>
  <div className="v2-form-grid"><button type="button" className="v2-secondary" onClick={() => setDetail(detail === 'issues' ? 'all' : 'issues')}>{detail === 'issues' ? 'Show all graph nodes' : 'Show unresolved only'}</button><button type="button" className="v2-secondary" onClick={() => setDetail(detail === 'none' ? 'issues' : 'none')}>{detail === 'none' ? 'Show graph details' : 'Collapse graph details'}</button><button type="button" className="v2-secondary" onClick={exportCsv}>Export dependency graph CSV</button></div>
  {visible.length > 0 && <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr><th>Form / line</th><th>Candidate</th><th>Status</th><th>Source / finding</th></tr></thead><tbody>{visible.map(key => { const node = report.nodes[key]; return <tr key={key}><td style={{padding:'9px',borderBottom:'1px solid #e2e8f0'}}>{key}</td><td>{node.cents === null ? 'Unknown' : (node.cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}</td><td>{node.status}</td><td>{node.reasons.join('; ') || node.sources.join(' → ')}</td></tr> })}</tbody></table></div>}
  <div className="v2-note"><strong>Development-only calculation graph.</strong> No automatic tax, credit, eligibility, or filing decision. 2026–2028 require separate validated rules; unsupported years remain blocked.</div>
 </section>
}
