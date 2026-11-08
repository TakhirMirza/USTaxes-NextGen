import type { BridgeInput } from '../nextgen/taxYears/unifiedDocumentBridge2025'
import { reconcileUnifiedDocuments2025 } from '../nextgen/taxYears/unifiedDocumentBridge2025'
const money = (cents: number | null) => cents === null ? 'Not entered' : (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export default function NextGen2025DocumentBridge({ input, onNavigate }: { input: BridgeInput; onNavigate: (step: 'income' | 'deductions') => void }) {
  const result = reconcileUnifiedDocuments2025(input)
  const download = () => {
    const csv = [['Severity', 'Code', 'Destination', 'Finding'], ...result.findings.map(f => [f.severity, f.code, f.destination, f.detail])]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'nextgen-2025-document-bridge-findings.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <section className="v2-card" aria-label="Unified document bridge"><span className="v2-eyebrow">PHASE 22 / DOCUMENT-TO-1040 BRIDGE</span><h2>W-2, 1099-INT and Schedule A/B — unified reconciliation</h2><p>Development-only reconciliation of fictional source documents. Schedule B interest is compared to 1099-INT, never added to it. Schedule A entries are not treated as allowable deductions.</p>
    <div className="v2-review-grid"><div><span>W-2 wages (source total)</span><strong>{money(result.wageCents)}</strong></div><div><span>W-2 withholding (source total)</span><strong>{money(result.withholdingCents)}</strong></div><div><span>1099-INT draft</span><strong>{money(result.interest1040Cents)}</strong></div><div><span>Schedule B interest (comparison only)</span><strong>{money(result.interestBCents)}</strong></div><div><span>Schedule A raw expenses (not deductible total)</span><strong>{money(result.rawScheduleACents)}</strong></div><div><span>Blocking checks</span><strong>{result.blocked}</strong></div></div>
    <div className="v2-note"><strong>Filing disabled.</strong> Passing this comparison does not establish tax liability, eligibility, Schedule B filing requirements, or filing readiness.</div>
    {result.findings.length > 0 ? <ul className="v2-blockers">{result.findings.map(f => <li key={f.code}><strong>{f.severity.toUpperCase()} — {f.code}</strong><div>{f.detail}</div><button type="button" className="v2-text-button" onClick={() => onNavigate(f.destination)}>Open {f.destination}</button></li>)}</ul> : <p>No bridge inconsistencies detected for the entered draft. Unsupported rules remain blocked.</p>}
    <button type="button" className="v2-secondary" onClick={download}>Export privacy-safe findings CSV</button>
  </section>
}
