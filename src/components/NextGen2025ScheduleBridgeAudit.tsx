import { ReactElement, useMemo, useState } from 'react'
import type { Schedule1040Candidates2025 } from '../nextgen/taxYears/schedules1040Bridge2025'
import { auditScheduleBridge2025, scheduleBridgeAuditCsv2025 } from '../nextgen/taxYears/scheduleBridgeAudit2025'
import './NextGen2025ScheduleBridgeAudit.css'
interface Props { year: string; candidates: Schedule1040Candidates2025; reconciled: boolean; blockers: readonly string[]; onNavigate: (step: 'income' | 'review') => void }
const dollars = (cents: number | null): string => cents === null ? 'Not established' : Number.isSafeInteger(cents) ? (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'Invalid amount'
export default function NextGen2025ScheduleBridgeAudit({ year, candidates, reconciled, blockers, onNavigate }: Props): ReactElement {
  const [onlyIssues, setOnlyIssues] = useState(false)
  const audit = useMemo(() => auditScheduleBridge2025(year, candidates, reconciled, blockers), [year, candidates, reconciled, blockers])
  const exportCsv = (): void => {
    const blob = new Blob([scheduleBridgeAuditCsv2025(audit)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'nextgen-2025-schedule-bridge-audit.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="v2-card ng-schedule-bridge" aria-label="Schedule 1 2 3 reconciliation controls">
    <span className="v2-eyebrow">FEDERAL SCHEDULES / 2025 / CONTROL CENTER</span>
    <h2>Schedules 1, 2 &amp; 3 — Form 1040 bridge</h2>
    <p>Read-only reconciliation of schedule candidates. Missing values are not treated as zero. This workspace never posts values into a filed return.</p>
    <div className="ng-schedule-bridge-summary"><div><small>Blocking findings</small><strong>{audit.blockerCount}</strong></div><div><small>Review items</small><strong>{audit.reviewCount}</strong></div><div><small>1040 lines tracked</small><strong>{audit.rows.length}</strong></div><div><small>Posting</small><strong>Disabled</strong></div></div>
    <div className="ng-schedule-bridge-actions"><button type="button" onClick={() => onNavigate('income')}>Review schedule sources</button><button type="button" className="v2-secondary" onClick={() => onNavigate('review')}>Open federal review</button><button type="button" className="v2-secondary" onClick={exportCsv}>Export privacy-safe CSV</button><label><input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)}/> Show unresolved only</label></div>
    <div className="ng-schedule-bridge-table-wrap"><table><thead><tr><th>Source</th><th>1040 line</th><th>Candidate</th><th>Status</th></tr></thead><tbody>{audit.rows.filter(r => !onlyIssues || r.status !== 'pass').map(r => <tr key={r.line}><td><strong>{r.schedule}</strong><small>{r.description}</small></td><td>{r.line}</td><td>{dollars(r.valueCents)}</td><td>{r.status === 'pass' ? 'Entered (not posted)' : r.status === 'blocker' ? 'Invalid' : 'Unresolved'}</td></tr>)}</tbody></table></div>
    <details><summary>Review {audit.findings.length} control findings</summary><ul className="v2-blockers">{audit.findings.map(f => <li key={f.code}><strong>{f.severity.toUpperCase()} — {f.title}</strong><div>{f.detail}</div></li>)}</ul></details>
    <p className="ng-schedule-bridge-footnote">Tax-year-specific IRS form instructions, limitations, eligibility, arithmetic, and filing approval require independent validation. No filing-ready calculation is implied.</p>
  </section>
}
