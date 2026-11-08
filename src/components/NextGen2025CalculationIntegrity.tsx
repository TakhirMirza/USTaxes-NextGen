import { auditFederalCalculationIntegrity2025, integrityFindingsCsv2025, IntegrityInput2025 } from '../nextgen/taxYears/federalCalculationIntegrity2025'
export default function NextGen2025CalculationIntegrity({ input, onNavigate }: { input: IntegrityInput2025; onNavigate: (step: 'income' | 'deductions') => void }) {
 const report = auditFederalCalculationIntegrity2025(input)
 const exportCsv = () => {
   const url = URL.createObjectURL(new Blob([integrityFindingsCsv2025(report.issues)], { type: 'text/csv;charset=utf-8' }))
   const a = document.createElement('a'); a.href = url; a.download = 'nextgen-2025-calculation-integrity.csv'; a.click(); URL.revokeObjectURL(url)
 }
 return <section className="v2-card" aria-label="Federal calculation integrity audit">
   <span className="v2-eyebrow">PHASE 23 / FEDERAL CALCULATION INTEGRITY</span><h2>Form 1040 — source and calculation integrity</h2>
   <p>Independent comparison of W-2, withholding and 1099-INT source totals with mapped Form 1040 preview lines. Schedule B is never added twice. This is a diagnostic audit, not a tax return.</p>
   <div className="v2-review-grid"><div><span>Cross-form checks</span><strong>{report.checked}</strong></div><div><span>Blocking findings</span><strong>{report.blocked}</strong></div><div><span>Review notices</span><strong>{report.reviewed}</strong></div><div><span>IRS filing</span><strong>DISABLED</strong></div></div>
   <div className="v2-note"><strong>Not filing ready.</strong> Passing source consistency checks does not validate tax brackets, eligibility, credits, payment totals, refund or e-file readiness.</div>
   <details><summary>View {report.issues.length} findings</summary><ul className="v2-blockers">{report.issues.map((i, n) => <li key={`${i.id}-${n}`}><strong>{i.severity.toUpperCase()} — {i.id}</strong><div>{i.message}</div>{i.source !== 'Form 1040' && <button type="button" className="v2-text-button" onClick={() => onNavigate(i.source === 'deductions' || i.source === 'Schedule A' ? 'deductions' : 'income')}>Review source</button>}</li>)}</ul></details>
   <button type="button" className="v2-secondary" onClick={exportCsv}>Export findings CSV (no taxpayer amounts)</button>
 </section>
}
