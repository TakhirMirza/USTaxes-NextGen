import { IntegrityInput2025 } from '../nextgen/taxYears/federalCalculationIntegrity2025'
import { evaluateFederalReleaseReadiness2025, releaseReadinessCsv2025 } from '../nextgen/taxYears/federalReleaseReadiness2025'
export default function NextGen2025ReleaseReadiness({input}:{input:IntegrityInput2025}) {
 const report=evaluateFederalReleaseReadiness2025(input)
 const exportCsv=()=>{const blob=new Blob([releaseReadinessCsv2025(report)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='nextgen-2025-release-readiness.csv';link.click();URL.revokeObjectURL(url)}
 const blockers=report.findings.filter(f=>f.severity==='blocker').length
 return <section className="v2-card" aria-label="2025 federal return release readiness">
 <span className="v2-eyebrow">PHASE 26 / RELEASE READINESS</span><h2>Federal return — release readiness gate</h2>
 <p>Fail-closed pre-release checklist. Technical build success and passing diagnostics do not establish IRS filing eligibility.</p>
 <div className="v2-review-grid"><div><span>Release status</span><strong>{report.status}</strong></div><div><span>Release blockers</span><strong>{blockers}</strong></div><div><span>Unverified items</span><strong>{report.findings.length-blockers}</strong></div><div><span>QA passed / failed</span><strong>{report.qaPassed} / {report.qaFailed}</strong></div></div>
 <details><summary>Required actions ({report.findings.length})</summary><ul className="v2-blockers">{report.findings.map(f=><li key={f.id}><strong>{f.severity.toUpperCase()} — {f.category}: {f.id}</strong><div>{f.message}</div><div>Next: {f.action}</div></li>)}</ul></details>
 <button type="button" className="v2-secondary" onClick={exportCsv}>Export release gate CSV (no taxpayer amounts)</button>
 <div className="v2-note"><strong>Development-only preview. NOT READY for filing.</strong> This check does not certify tax law compliance, authorize IRS e-file, or approve handling real taxpayer data.</div>
 </section>
}
