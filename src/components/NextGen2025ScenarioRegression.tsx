import { useState } from 'react'
import { REGRESSION_SCENARIOS_2025, compareScenarios2025, scenarioRegressionCsv2025 } from '../nextgen/taxYears/scenarioRegression2025'
export default function NextGen2025ScenarioRegression({year}:{year:string}) {
 const [baseline,setBaseline]=useState('balanced')
 const [candidate,setCandidate]=useState('mismatch')
 if(year!=='2025')return null
 const b=REGRESSION_SCENARIOS_2025.find(s=>s.id===baseline)!
 const c=REGRESSION_SCENARIOS_2025.find(s=>s.id===candidate)!
 const result=compareScenarios2025(b,c)
 const exportCsv=()=>{const blob=new Blob([scenarioRegressionCsv2025(result)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nextgen-phase33-scenario-regression.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card" aria-label="2025 scenario regression comparison">
 <span className="v2-eyebrow">PHASE 33 / SCENARIO REGRESSION</span><h2>2025 Form 1040 — compare fictional scenarios</h2>
 <p>Compare two deterministic test scenarios and inspect newly introduced or resolved arithmetic blockers. Values are isolated from your return and never posted. Filing remains disabled.</p>
 <div className="v2-form-grid"><label>Baseline scenario<select value={baseline} onChange={e=>setBaseline(e.target.value)}>{REGRESSION_SCENARIOS_2025.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Candidate scenario<select value={candidate} onChange={e=>setCandidate(e.target.value)}>{REGRESSION_SCENARIOS_2025.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
 <div className="v2-note"><strong>FILING DISABLED.</strong> Baseline: {result.baseline.passed} checks passed, {result.baseline.blockers} blockers, {result.baseline.missing} missing. Candidate: {result.candidate.passed} checks passed, {result.candidate.blockers} blockers, {result.candidate.missing} missing.</div>
 <h3>New blockers ({result.regressions.length})</h3><ul className="v2-blockers">{result.regressions.length?result.regressions.map(k=><li key={k}>{k}</li>):<li>None introduced</li>}</ul>
 <h3>Resolved blockers ({result.improvements.length})</h3><ul className="v2-blockers">{result.improvements.length?result.improvements.map(k=><li key={k}>{k}</li>):<li>None resolved</li>}</ul>
 <h3>Changed Form 1040 lines ({result.changes.length})</h3><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Line</th><th>Baseline</th><th>Candidate</th><th>Delta</th></tr></thead><tbody>{result.changes.map(d=><tr key={d.key}><td>{d.label}</td><td>{d.baseline===null?'Missing':(d.baseline/100).toFixed(2)}</td><td>{d.candidate===null?'Missing':(d.candidate/100).toFixed(2)}</td><td>{d.delta===null?'N/A':(d.delta/100).toFixed(2)}</td></tr>)}</tbody></table></div>
 <button type="button" className="v2-secondary" onClick={exportCsv}>Export Phase 33 comparison CSV</button>
 </section>
}
