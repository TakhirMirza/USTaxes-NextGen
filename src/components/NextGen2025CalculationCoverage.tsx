import { useMemo, useState } from 'react'
import { assessCalculationCoverage2025, calculationCoverageCsv2025 } from '../nextgen/taxYears/calculationCoverage2025'
export default function NextGen2025CalculationCoverage({year}:{year:string}) {
 const report=useMemo(()=>assessCalculationCoverage2025(),[])
 const [group,setGroup]=useState('All')
 if(year!=='2025')return null
 const groups=['All',...new Set(report.rows.map(r=>r.group))]
 const visible=report.rows.filter(r=>group==='All'||r.group===group)
 const download=()=>{const blob=new Blob([calculationCoverageCsv2025(visible)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='phase34-2025-arithmetic-coverage.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card" aria-label="2025 calculation coverage matrix">
  <span className="v2-eyebrow">PHASE 34 / CALCULATION COVERAGE</span><h2>2025 arithmetic validation matrix</h2>
  <p>Automated positive, one-dollar mutation and missing-value probes for each Form 1040 arithmetic rule. Results are computed locally against fictional fixtures; no personal tax information is read.</p>
  <div className="v2-note"><strong>Arithmetic rule coverage: {report.covered}/{report.rows.length}</strong> · Partial: {report.partial} · Uncovered: {report.uncovered} · Fields: {report.fields} · Fictional scenarios: {report.scenarios}. <strong>Filing remains disabled.</strong></div>
  <label>Filter by calculation area <select value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g}>{g}</option>)}</select></label>
  <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Area</th><th>Check</th><th>1040 target</th><th>Positive</th><th>Mutation</th><th>Missing</th><th>Coverage</th></tr></thead><tbody>{visible.map(r=><tr key={r.code}><td>{r.group}</td><td>{r.code}</td><td>{r.target}</td><td>{r.positive?'Pass':'Fail'}</td><td>{r.negative?'Pass':'Fail'}</td><td>{r.missing?'Pass':'Fail'}</td><td>{r.state}</td></tr>)}</tbody></table></div>
  <p><strong>Important:</strong> This matrix verifies the arithmetic validator's responses to controlled inputs. It does not prove IRS rule correctness, tax-year compliance, filing eligibility, or coverage of every schedule.</p>
  <button type="button" className="v2-secondary" onClick={download}>Export Phase 34 coverage CSV</button>
 </section>
}
