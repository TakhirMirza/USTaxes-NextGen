import { ReactElement, useMemo, useState } from 'react'
import { BridgeInput2025, buildForm1040IncomeBridge2025, incomeBridgeCsv2025 } from '../nextgen/taxYears/form1040IncomeBridge2025'
import './NextGen2025IncomeBridge.css'
interface Props { input: BridgeInput2025; onNavigate: (step: 'income' | 'review') => void }
const dollars = (cents: number | null): string => cents === null ? 'Unresolved' : (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export default function NextGen2025IncomeBridge({ input, onNavigate }: Props): ReactElement {
  const [showOnlyIssues, setShowOnlyIssues] = useState(false)
  const result = useMemo(() => buildForm1040IncomeBridge2025(input), [input])
  const exportCsv = (): void => {
    const blob = new Blob([incomeBridgeCsv2025(result)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'nextgen-2025-income-bridge-status.csv'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section className="v2-card ng-income-bridge" aria-label="2025 federal income bridge preview">
    <span className="v2-eyebrow">FORM 1040 / 2025 / INCOME BRIDGE</span>
    <h2>Federal income reconciliation — source worksheet</h2>
    <p>Deterministic source-to-line preview. It does not calculate complete total income, adjusted gross income, tax, or refund. Unknown amounts stay unknown.</p>
    <div className="ng-income-bridge-stats"><div><small>Source lines</small><strong>{result.lines.length}</strong></div><div><small>Unresolved / invalid</small><strong>{result.lines.filter(l => l.status === 'unresolved' || l.status === 'invalid').length}</strong></div><div><small>Filing</small><strong>Disabled</strong></div></div>
    <div className="ng-income-bridge-actions"><button type="button" onClick={() => onNavigate('income')}>Review W-2 / 1099-INT</button><button type="button" className="v2-secondary" onClick={() => onNavigate('review')}>Open return review</button><button type="button" className="v2-secondary" onClick={exportCsv}>Export status CSV</button><label><input type="checkbox" checked={showOnlyIssues} onChange={e => setShowOnlyIssues(e.target.checked)}/> Unresolved only</label></div>
    <div className="ng-income-bridge-scroll"><table><thead><tr><th>Line</th><th>Source worksheet</th><th>Draft subtotal</th><th>Status</th></tr></thead><tbody>{result.lines.filter(l => !showOnlyIssues || l.status === 'invalid' || l.status === 'unresolved').map(l => <tr key={l.line}><td><strong>{l.line}</strong></td><td>{l.label}<small>{l.note}</small></td><td>{dollars(l.cents)}</td><td>{l.status}</td></tr>)}</tbody></table></div>
    <details><summary>Review {result.findings.length} source findings</summary><ul className="v2-blockers">{result.findings.map(f => <li key={f.code}><strong>{f.severity.toUpperCase()} — {f.code}</strong><div>{f.message}</div></li>)}</ul></details>
    <p className="ng-income-bridge-disclaimer">Preview subtotals are intentionally NOT Form 1040 line 9 or 11. Other income categories, eligibility rules, deductions, tax rates, and IRS instructions must be implemented and independently validated before actual filing.</p>
  </section>
}
