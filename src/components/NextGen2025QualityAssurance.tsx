import { IntegrityInput2025 } from '../nextgen/taxYears/federalCalculationIntegrity2025'
import { federalQaCsv2025, runFederalQualityAssurance2025 } from '../nextgen/taxYears/federalQualityAssurance2025'
export default function NextGen2025QualityAssurance({input}:{input:IntegrityInput2025}) {
 const report=runFederalQualityAssurance2025(input)
 const exportReport=()=>{const url=URL.createObjectURL(new Blob([federalQaCsv2025(report)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='nextgen-2025-quality-assurance.csv';a.click();URL.revokeObjectURL(url)}
 return <section className="v2-card" aria-label="2025 federal return quality assurance">
  <span className="v2-eyebrow">PHASE 25 / QUALITY ASSURANCE</span><h2>Federal return — validation and regression diagnostics</h2>
  <p>Cross-module checks plus isolated synthetic mismatch tests. The tests never modify your entered scenario. Passing technical checks is not IRS approval.</p>
  <div className="v2-review-grid"><div><span>Passed</span><strong>{report.passed}</strong></div><div><span>Failed</span><strong>{report.failed}</strong></div><div><span>Unverified</span><strong>{report.unverified}</strong></div><div><span>Filing</span><strong>NOT READY</strong></div></div>
  <details><summary>View {report.checks.length} quality checks</summary><ul className="v2-blockers">{report.checks.map(c=><li key={c.id}><strong>{c.status.toUpperCase()} — {c.id}</strong><div>{c.description}: {c.detail}</div></li>)}</ul></details>
  <button type="button" className="v2-secondary" onClick={exportReport}>Export QA report CSV (no taxpayer amounts)</button>
  <div className="v2-note"><strong>Development preview only.</strong> Incomplete IRS rules and unverified payment coverage always prevent filing readiness.</div>
 </section>
}
